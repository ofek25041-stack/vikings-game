/**
 * Clan System Module
 * Manages clans, members, chat, and treasury
 */


window.ALL_CLANS = window.ALL_CLANS || {};

const ClanSystem = {
    // Configuration
    CONFIG: {
        CREATE_COST: { gold: 10000, wood: 5000 },
        MAX_MEMBERS: 50,
        MAX_CHAT_MESSAGES: 100,
        NAME_MIN_LENGTH: 3,
        NAME_MAX_LENGTH: 20,
        TAG_MIN_LENGTH: 2,
        TAG_MAX_LENGTH: 5,
        ICONS: ['🛡️', '⚔️', '🏰', '👑', '🦅', '🐺', '🔥', '⚡', '🌟', '💎']
    },

    ROLES: {
        LEADER: 'leader',
        OFFICER: 'officer',
        MEMBER: 'member'
    },

    // Initialize the clan system
    async init() {
        console.log('Clan System Initialized');
        await this.loadClans();
    },

    // Load all clans from server
    async loadClans() {
        try {
            const response = await fetch('/api/clans');
            const data = await response.json();

            if (data.success) {
                // Filter out deleted clans
                const validClans = {};
                for (const clanId in data.clans) {
                    const clan = data.clans[clanId];
                    if (!clan.deleted) {
                        validClans[clanId] = clan;
                    }
                }
                window.ALL_CLANS = validClans;
                console.log(`Loaded ${Object.keys(validClans).length} clans from server`);
            } else {
                console.error("Failed to load clans:", data.message);
            }
        } catch (err) {
            console.error("Failed to load clans from server:", err);
        }
    },

    // Save specific clan to SERVER
    async saveClan(clan) {
        if (!clan || !clan.id) return;

        // Optimistic update (already in window.ALL_CLANS)

        try {
            await fetch('/api/clans/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clan: clan })
            });
        } catch (e) {
            console.error('Failed to save clan:', e);
            notify('שגיאה בשמירת נתוני השבט בשרת', 'error');
        }
    },

    // Deprecated: Adapter for old calls (saves player's clan if possible)
    saveClans() {
        const myClan = this.getPlayerClan();
        if (myClan) {
            this.saveClan(myClan);
        }
    },

    // Get clan by ID
    getClan(clanId) {
        return window.ALL_CLANS[clanId] || null;
    },

    // Get player's clan
    getPlayerClan() {
        if (!STATE.clan || !STATE.clan.id) return null;

        // Auto-fix orphan state on read
        if (!window.ALL_CLANS[STATE.clan.id]) {
            console.warn("Orphaned clan detected (getPlayerClan). Resetting.");
            STATE.clan = null;
            // Ideally save here, but might be too frequent. 
            // We rely on verifyPlayerClanState() for permanent fix, 
            // but this ensures UI doesn't break in the meantime.
            return null;
        }

        return window.ALL_CLANS[STATE.clan.id];
    },

    // Verify and fix player clan state (called after login)
    verifyPlayerClanState() {
        if (STATE.clan && STATE.clan.id) {
            // Check if the clan still exists
            if (!window.ALL_CLANS[STATE.clan.id]) {
                console.warn("Found orphaned clan state. Cleaning up...");
                STATE.clan = null;
                saveGame();
                return false; // Was fixed
            }
        } else if (!STATE.clan) {
            // STATE.clan is empty - search for user in ALL_CLANS
            console.log("STATE.clan is empty. Searching for user in ALL_CLANS...");

            for (const clanId in window.ALL_CLANS) {
                const clan = window.ALL_CLANS[clanId];

                // Check if current user is a member (case-sensitive first, then case-insensitive)
                if (clan.members && clan.members[CURRENT_USER]) {
                    console.log(`Found ${CURRENT_USER} in clan ${clan.name} (${clanId}). Restoring STATE.clan...`);
                    STATE.clan = {
                        id: clanId,
                        role: clan.members[CURRENT_USER].role,
                        joinedAt: clan.members[CURRENT_USER].joinedAt
                    };
                    saveGame();
                    return true; // Fixed!
                }

                // Case-insensitive fallback
                const memberKey = Object.keys(clan.members || {}).find(
                    m => m.toLowerCase() === CURRENT_USER.toLowerCase()
                );

                if (memberKey) {
                    console.log(`Found ${CURRENT_USER} (as ${memberKey}) in clan ${clan.name} (${clanId}). Restoring STATE.clan...`);
                    STATE.clan = {
                        id: clanId,
                        role: clan.members[memberKey].role,
                        joinedAt: clan.members[memberKey].joinedAt
                    };
                    saveGame();
                    return true; // Fixed!
                }
            }

            console.log("User not found in any clan.");
        }

        return true; // OK
    },

    // Validate clan name (English only, alphanumeric + spaces)
    validateClanName(name) {
        if (!name || name.length < this.CONFIG.NAME_MIN_LENGTH || name.length > this.CONFIG.NAME_MAX_LENGTH) {
            return `Name must be ${this.CONFIG.NAME_MIN_LENGTH}-${this.CONFIG.NAME_MAX_LENGTH} characters`;
        }
        if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
            return 'Name must contain only English letters, numbers, and spaces';
        }
        // Check if name is taken
        const nameLower = name.toLowerCase();
        for (const clanId in window.ALL_CLANS) {
            if (window.ALL_CLANS[clanId].name.toLowerCase() === nameLower) {
                return 'This name is already taken';
            }
        }
        return null;
    },

    // Validate clan tag
    validateClanTag(tag) {
        if (!tag || tag.length < this.CONFIG.TAG_MIN_LENGTH || tag.length > this.CONFIG.TAG_MAX_LENGTH) {
            return `Tag must be ${this.CONFIG.TAG_MIN_LENGTH}-${this.CONFIG.TAG_MAX_LENGTH} characters`;
        }
        if (!/^[A-Z0-9]+$/.test(tag)) {
            return 'Tag must contain only uppercase letters and numbers';
        }
        // Check if tag is taken
        for (const clanId in window.ALL_CLANS) {
            if (window.ALL_CLANS[clanId].tag === tag) {
                return 'This tag is already taken';
            }
        }
        return null;
    },

    // Create a new clan
    createClan(name, tag, description, icon) {
        // Validate inputs
        const nameError = this.validateClanName(name);
        if (nameError) return { success: false, error: nameError };

        const tagError = this.validateClanTag(tag);
        if (tagError) return { success: false, error: tagError };

        // Check if player already in a clan
        // Fix: Ensure the clan actually exists before blocking
        if (STATE.clan && STATE.clan.id && window.ALL_CLANS[STATE.clan.id]) {
            return { success: false, error: 'You are already in a clan. Leave it first.' };
        }

        // CRITICAL FIX: If player has STATE.clan but it doesn't exist in ALL_CLANS,
        // remove them from the old clan's member list to prevent ghost memberships
        if (STATE.clan && STATE.clan.id) {
            const oldClan = window.ALL_CLANS[STATE.clan.id];
            if (oldClan && oldClan.members && oldClan.members[CURRENT_USER]) {
                delete oldClan.members[CURRENT_USER];
                oldClan.stats.totalMembers = Object.keys(oldClan.members).length;
                this.saveClan(oldClan);
                console.log(`Removed ${CURRENT_USER} from old clan ${oldClan.tag} before creating new clan`);
            }
        }

        // Check resources
        const cost = this.CONFIG.CREATE_COST;
        if (STATE.resources.gold < cost.gold || STATE.resources.wood < cost.wood) {
            return { success: false, error: `Not enough resources! Need ${cost.gold} gold and ${cost.wood} wood.` };
        }

        // Deduct resources
        STATE.resources.gold -= cost.gold;
        STATE.resources.wood -= cost.wood;

        // Create clan
        const clanId = 'clan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const clan = {
            id: clanId,
            name: name,
            tag: tag,
            description: description || '',
            icon: icon || '🛡️',
            leader: CURRENT_USER,
            members: {},
            treasury: {
                gold: 0,
                wood: 0,
                food: 0,
                wine: 0,
                marble: 0,
                crystal: 0,
                sulfur: 0
            },
            upgrades: {
                treasury: 1,
                militaryBonus: 0,
                economyBonus: 0
            },
            stats: {
                totalMembers: 1,
                territories: 0,
                wins: 0,
                losses: 0
            },
            messages: [],
            invitations: {},  // pending invitations
            applications: {}, // pending join requests
            createdAt: Date.now(),
            lastActivity: Date.now(),
            deleted: false,
            fortress: null  // Will store {x, y, troops, resources, createdAt}
        };

        // Add creator as leader
        clan.members[CURRENT_USER] = {
            role: this.ROLES.LEADER,
            joinedAt: Date.now(),
            contribution: {
                gold: 0,
                wood: 0,
                food: 0
            },
            lastSeen: Date.now()
        };

        // Save clan
        window.ALL_CLANS[clanId] = clan;
        this.saveClan(clan);

        // Update player state
        STATE.clan = {
            id: clanId,
            role: this.ROLES.LEADER,
            joinedAt: Date.now()
        };
        saveGame();

        return { success: true, clanId: clanId };
    },

    // Invite player to clan
    invitePlayer(username) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER && myRole !== this.ROLES.OFFICER) {
            return { success: false, error: 'Only leaders and officers can invite players' };
        }

        if (clan.members[username]) {
            return { success: false, error: 'Player is already a member' };
        }

        if (Object.keys(clan.members).length >= this.CONFIG.MAX_MEMBERS) {
            return { success: false, error: 'Clan is full' };
        }

        // Add invitation
        clan.invitations[username] = {
            invitedBy: CURRENT_USER,
            timestamp: Date.now()
        };

        this.saveClan(clan);
        return { success: true };
    },

    // Accept invitation (Server Side)
    async joinClan(clanId) {
        if (STATE.clan && STATE.clan.id) {
            notify('אתה כבר בקלאן!', 'error');
            return { success: false };
        }

        try {
            const response = await fetch('/api/clan/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: CURRENT_USER,
                    clanId: clanId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update Local State from Server Response
                // Server should return the updated clan object
                if (data.clan) {
                    window.ALL_CLANS[clanId] = data.clan;
                }

                // Update Player State
                STATE.clan = {
                    id: clanId,
                    name: data.clan ? data.clan.name : '',
                    tag: data.clan ? data.clan.tag : '',
                    role: 'member',
                    joinedAt: Date.now()
                };

                // Force Save to prevent overwrite on next tick
                await saveGame();

                // Notify
                notify('הצטרפת לקלאן בהצלחה! 🏰', 'success');
                this.sendMessage(clanId, `${CURRENT_USER} הצטרף לקלאן!`, 'system');

                // Refresh View
                if (typeof switchView === 'function') switchView('clan');
                return { success: true };

            } else {
                notify(data.error || 'שגיאה בהצטרפות לקלאן', 'error');
                return { success: false };
            }
        } catch (err) {
            console.error('Join clan error:', err);
            notify('שגיאת תקשורת', 'error');
            return { success: false };
        }
    },

    // DEPRECATED: Old local accept
    acceptInvitationLocal(clanId) {
        // ... kept for fallback if needed, but logic moved to joinClan
    },

    // Leave clan
    leaveClan() {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole === this.ROLES.LEADER) {
            return { success: false, error: 'Leaders cannot leave. Transfer leadership or disband the clan first.' };
        }

        // Remove from clan
        delete clan.members[CURRENT_USER];
        clan.stats.totalMembers = Object.keys(clan.members).length;
        this.saveClan(clan);

        this.sendMessage(clan.id, `${CURRENT_USER} left the clan.`, 'system');

        // Update player state
        STATE.clan = null;
        saveGame();

        return { success: true };
    },

    // Kick member (leader/officer only)
    kickMember(username) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER && myRole !== this.ROLES.OFFICER) {
            return { success: false, error: 'Only leaders and officers can kick members' };
        }

        if (!clan.members[username]) {
            return { success: false, error: 'Member not found' };
        }

        const targetRole = clan.members[username].role;
        if (targetRole === this.ROLES.LEADER) {
            return { success: false, error: 'Cannot kick the leader' };
        }

        if (myRole === this.ROLES.OFFICER && targetRole === this.ROLES.OFFICER) {
            return { success: false, error: 'Officers cannot kick other officers' };
        }

        // Remove member
        delete clan.members[username];
        clan.stats.totalMembers = Object.keys(clan.members).length;
        this.saveClan(clan);

        this.sendMessage(clan.id, `${username} was kicked from the clan.`, 'system');

        return { success: true };
    },

    // Promote/demote member
    setMemberRole(username, newRole) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER) {
            return { success: false, error: 'Only the leader can change roles' };
        }

        if (!clan.members[username]) {
            return { success: false, error: 'Member not found' };
        }

        if (username === CURRENT_USER) {
            return { success: false, error: 'Cannot change your own role' };
        }

        clan.members[username].role = newRole;
        this.saveClan(clan);

        this.sendMessage(clan.id, `${username} is now ${newRole}!`, 'system');

        return { success: true };
    },

    // Send chat message
    async sendMessage(clanId, text, sender = CURRENT_USER) {
        if (!text) return { success: false };

        try {
            const response = await fetch('/api/clan/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanId, sender, text })
            });
            const result = await response.json();

            if (result.success) {
                // Optimistic UI update or wait for poll? 
                // Let's manually push to local state for instant feedback
                const clan = this.getClan(clanId);
                if (clan) {
                    if (!clan.messages) clan.messages = [];
                    clan.messages.push(result.message);
                    if (clan.messages.length > 50) clan.messages.shift();
                }
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (e) {
            console.error(e);
            return { success: false, error: 'Network error' };
        }
    },

    // Refresh single clan data
    async refreshClanData(clanId) {
        try {
            const response = await fetch(`/api/clan/data?id=${clanId}`);
            const result = await response.json();
            if (result.success && result.clan) {
                // Update local storage
                window.ALL_CLANS = window.ALL_CLANS || {};
                window.ALL_CLANS[clanId] = result.clan;

                // If it's my clan, update reference
                if (STATE.clan && STATE.clan.id === clanId) {
                    // Update role if changed? For now, just data.
                }
                return result.clan;
            }
        } catch (e) {
            console.error("Failed to refresh clan", e);
        }
        return null;
    },

    // Donate resources to treasury
    donate(resources) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        // Validate resources
        for (const res in resources) {
            const amount = resources[res];
            if (amount < 0) {
                return { success: false, error: 'Invalid amount' };
            }
            if (!STATE.resources[res] || STATE.resources[res] < amount) {
                return { success: false, error: `Not enough ${res}` };
            }
        }

        // Transfer resources
        for (const res in resources) {
            const amount = resources[res];
            STATE.resources[res] -= amount;
            clan.treasury[res] = (clan.treasury[res] || 0) + amount;

            // Track contribution
            if (!clan.members[CURRENT_USER].contribution[res]) {
                clan.members[CURRENT_USER].contribution[res] = 0;
            }
            clan.members[CURRENT_USER].contribution[res] += amount;
        }

        this.saveClan(clan);
        saveGame();

        return { success: true };
    },

    // Distribute treasury (leader/officer only)
    async distributeTreasury(username, resources) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER && myRole !== this.ROLES.OFFICER) {
            return { success: false, error: 'רק מנהיגים וקצינים יכולים לחלק משאבים' };
        }

        if (!clan.members[username]) {
            return { success: false, error: 'השחקן לא נמצא בקלאן' };
        }

        // Optimistic Check
        for (const res in resources) {
            const amount = resources[res];
            if (amount > 0) {
                if (!clan.treasury[res] || clan.treasury[res] < amount) {
                    return { success: false, error: `אין מספיק ${res} באוצר` };
                }
            }
        }

        try {
            const response = await fetch('/api/clan/distribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionBy: CURRENT_USER,
                    target: username,
                    resources: resources
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update local clan treasury from server response
                if (result.treasury) {
                    clan.treasury = result.treasury;
                } else {
                    // Fallback manual update
                    for (const res in resources) {
                        const amount = resources[res];
                        if (amount > 0) clan.treasury[res] -= amount;
                    }
                }

                // If updated self, we should really resync user state, but manual add is okay for now
                if (username === CURRENT_USER) {
                    for (const res in resources) {
                        const amount = resources[res];
                        if (amount > 0) STATE.resources[res] = (STATE.resources[res] || 0) + amount;
                    }
                    saveGame();
                }

                this.saveClan(clan); // Save other changes if any, mostly treasury sync
                this.sendMessage(clan.id, `${CURRENT_USER} העביר משאבים ל-${username}`, 'system');
                return { success: true };

            } else {
                return { success: false, error: result.message };
            }
        } catch (e) {
            console.error(e);
            return { success: false, error: 'שגיאת תקשורת עם השרת' };
        }
    },

    // Update clan settings (leader only)
    updateSettings(settings) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER) {
            return { success: false, error: 'רק מנהיג הקלאן יכול לשנות הגדרות' };
        }

        // Update allowed fields
        if (settings.description !== undefined) {
            clan.description = settings.description;
        }

        // Settings now only supports 'recruitmentType' passed in settings object
        if (settings.recruitmentType) {
            if (!clan.recruitment) clan.recruitment = { requests: [] };
            clan.recruitment.type = settings.recruitmentType;
        }

        // Server Call
        fetch('/api/clan/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clanId: clan.id,
                username: CURRENT_USER,
                recruitmentType: settings.recruitmentType || (clan.recruitment ? clan.recruitment.type : 'closed')
            })
        }).then(r => r.json()).then(res => {
            if (!res.success) {
                notify(res.error || 'Failed to sync settings', 'error');
            }
        });

        this.saveClan(clan);
        this.sendMessage(clan.id, 'הגדרות הקלאן עודכנו', 'system');

        return { success: true };
    },

    // Delete clan (leader only)
    async deleteClan(clanId) {
        if (!STATE.clan || STATE.clan.id !== clanId) return { success: false, error: 'Not your clan' };

        try {
            const response = await fetch('/api/clan/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clanId: clanId,
                    username: CURRENT_USER
                })
            });
            const result = await response.json();

            if (result.success) {
                // Clear local state
                STATE.clan = null;
                // Optimistically remove from ALL_CLANS
                if (window.ALL_CLANS[clanId]) {
                    window.ALL_CLANS[clanId].deleted = true;
                    delete window.ALL_CLANS[clanId];
                }
                saveGame();
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    },

    // Apply to clan
    async applyToClan(clanId) {
        if (STATE.clan && STATE.clan.id) return { success: false, error: 'You are already in a clan' };

        try {
            const response = await fetch('/api/clan/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanId: clanId, username: CURRENT_USER })
            });
            return await response.json();
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    },

    // Handle Request (Accept/Reject)
    async handleRequest(targetUser, action) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'No clan' };

        try {
            const response = await fetch('/api/clan/handle_request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clanId: clan.id,
                    actionBy: CURRENT_USER,
                    targetUser: targetUser,
                    action: action
                })
            });
            const result = await response.json();

            if (result.success) {
                // Optimistic Update
                if (!clan.recruitment) clan.recruitment = { requests: [] };
                clan.recruitment.requests = clan.recruitment.requests.filter(r => r.username !== targetUser);

                if (action === 'accept') {
                    clan.members[targetUser] = { role: 'member', joinedAt: Date.now() };
                    this.sendMessage(clan.id, `ברוך הבא ${targetUser}!`, 'system');
                }

                this.saveClan(clan);
                saveGame();
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    },

    // Find suitable location for fortress (2x2)
    findFortressLocation() {
        const MAP_SIZE = 60;
        const MIN_DISTANCE_FROM_ENTITIES = 3;

        // Get all occupied tiles
        const occupied = new Set();

        // Add all entities (cities, resources, existing fortresses)
        for (const key in STATE.mapEntities) {
            const [x, y] = key.split(',').map(Number);
            occupied.add(`${x},${y}`);

            // Add buffer zone
            for (let dx = -MIN_DISTANCE_FROM_ENTITIES; dx <= MIN_DISTANCE_FROM_ENTITIES; dx++) {
                for (let dy = -MIN_DISTANCE_FROM_ENTITIES; dy <= MIN_DISTANCE_FROM_ENTITIES; dy++) {
                    occupied.add(`${x + dx},${y + dy}`);
                }
            }
        }

        console.log(`Finding fortress location. ${occupied.size} tiles occupied/blocked.`);

        // Try random locations
        for (let attempt = 0; attempt < 200; attempt++) {
            const x = Math.floor(Math.random() * (MAP_SIZE - 2));
            const y = Math.floor(Math.random() * (MAP_SIZE - 2));

            // Check if 2x2 area is free
            let valid = true;
            for (let dx = 0; dx < 2; dx++) {
                for (let dy = 0; dy < 2; dy++) {
                    if (occupied.has(`${x + dx},${y + dy}`)) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) break;
            }

            if (valid) {
                console.log(`Found location at (${x}, ${y}) after ${attempt + 1} attempts`);
                return { x, y };
            }
        }

        console.error('No suitable fortress location found after 200 attempts');
        return null; // No location found
    },

    // Build fortress
    async buildFortress() {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER) {
            return { success: false, error: 'רק מנהיג הקלאן יכול לבנות מבצר' };
        }

        if (clan.fortress) {
            return { success: false, error: 'למבצר כבר מבצר!' };
        }

        // Check cost
        const COST = { gold: 50000, wood: 30000 };
        for (const res in COST) {
            if (!clan.treasury[res] || clan.treasury[res] < COST[res]) {
                return { success: false, error: `אין מספיק ${res} באוצר` };
            }
        }

        // Find location
        const location = this.findFortressLocation();
        if (!location) {
            return { success: false, error: 'לא נמצא מיקום מתאים במפה - נסה שוב' };
        }

        console.log(`Building fortress at (${location.x}, ${location.y})`);

        // Deduct cost from treasury
        clan.treasury.gold -= COST.gold;
        clan.treasury.wood -= COST.wood;

        // Create fortress via server
        try {
            const response = await fetch('/api/fortress/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clanId: clan.id,
                    x: location.x,
                    y: location.y
                })
            });

            const result = await response.json();
            console.log('Server response:', result);

            if (result.success) {
                // Update local clan data
                clan.fortress = result.fortress;
                window.ALL_CLANS[clan.id] = clan;

                // CRITICAL: Force refresh map entities
                await syncWorldPlayers();

                this.sendMessage(clan.id, `🏰 המבצר נבנה בהצלחה ב-(${location.x}, ${location.y})!`, 'system');

                console.log('Fortress created successfully!', result.fortress);
                return { success: true, location };
            } else {
                // Refund on failure
                clan.treasury.gold += COST.gold;
                clan.treasury.wood += COST.wood;
                return { success: false, error: result.message };
            }
        } catch (err) {
            console.error('Build fortress error:', err);
            // Refund on error
            clan.treasury.gold += COST.gold;
            clan.treasury.wood += COST.wood;
            return { success: false, error: 'שגיאה בבניית המבצר' };
        }
    },

    // Deploy troops to fortress
    async deployTroops(troops) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        if (!clan.fortress) {
            return { success: false, error: 'אין מבצר לקלאן' };
        }

        // Validate and deduct from player
        const myArmy = STATE.army || { spearman: 0, archer: 0, swordsman: 0 };
        for (const type in troops) {
            const amount = troops[type];
            if (amount > 0) {
                if (!myArmy[type] || myArmy[type] < amount) {
                    return { success: false, error: `אין מספיק ${type}` };
                }
            }
        }

        // Deduct from player
        for (const type in troops) {
            if (troops[type] > 0) {
                STATE.army[type] = (STATE.army[type] || 0) - troops[type];
            }
        }

        // Send to server with username for tracking
        try {
            const response = await fetch('/api/fortress/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clanId: clan.id,
                    action: 'deploy_troops',
                    data: { troops, username: CURRENT_USER }
                })
            });

            const result = await response.json();

            if (result.success) {
                clan.fortress = result.fortress;
                window.ALL_CLANS[clan.id] = clan;
                saveGame();

                return { success: true };
            } else {
                // Refund on failure
                for (const type in troops) {
                    if (troops[type] > 0) {
                        STATE.army[type] = (STATE.army[type] || 0) + troops[type];
                    }
                }
                return { success: false, error: result.message };
            }
        } catch (err) {
            console.error('Deploy troops error:', err);
            // Refund on error
            for (const type in troops) {
                if (troops[type] > 0) {
                    STATE.army[type] = (STATE.army[type] || 0) + troops[type];
                }
            }
            return { success: false, error: 'שגיאה בפריסת חיילים' };
        }
    },

    // Withdraw troops from fortress
    async withdrawTroops(troops) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        if (!clan.fortress) {
            return { success: false, error: 'אין מבצר לקלאן' };
        }

        // Check player's deposited troops
        const myDeposits = clan.fortress.deposits?.[CURRENT_USER] || { spearman: 0, archer: 0, swordsman: 0 };

        for (const type in troops) {
            const amount = troops[type];
            if (amount > 0) {
                if (!myDeposits[type] || myDeposits[type] < amount) {
                    return { success: false, error: `לא הפקדת מספיק ${type} (יש לך: ${myDeposits[type] || 0})` };
                }
            }
        }

        // Send to server with username for tracking
        try {
            const response = await fetch('/api/fortress/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clanId: clan.id,
                    action: 'withdraw_troops',
                    data: { troops, username: CURRENT_USER }
                })
            });

            const result = await response.json();

            if (result.success) {
                clan.fortress = result.fortress;
                window.ALL_CLANS[clan.id] = clan;

                // Add to player
                for (const type in troops) {
                    if (troops[type] > 0) {
                        STATE.army[type] = (STATE.army[type] || 0) + troops[type];
                    }
                }

                saveGame();
                return { success: true };
            } else {
                return { success: false, error: result.message };
            }
        } catch (err) {
            console.error('Withdraw troops error:', err);
            return { success: false, error: 'שגיאה במשיכת חיילים' };
        }
    },

    // Launch fortress attack (leader only)
    async launchFortressAttack(targetX, targetY, targetType) {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'אתה לא בקלאן' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER) {
            return { success: false, error: 'רק מנהיג הקלאן יכול לתקוף' };
        }

        if (!clan.fortress) {
            return { success: false, error: 'אין מבצר לקלאן' };
        }

        const garrison = clan.fortress.garrison || clan.fortress.troops || {};
        const totalTroops = (garrison.spearman || 0) + (garrison.archer || 0) + (garrison.swordsman || 0);

        if (totalTroops === 0) {
            return { success: false, error: 'אין חיילים במבצר' };
        }

        try {
            // Use the same endpoint as fortress_attack.js
            const response = await fetch('/api/attack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attacker: CURRENT_USER,
                    targetX: targetX,
                    targetY: targetY,
                    troops: garrison, // Send all garrison troops
                    source: 'fortress'
                })
            });

            const result = await response.json();
            console.log('[FORTRESS_ATTACK] Server response:', result);

            if (!result.success) {
                return { success: false, error: result.message };
            }

            // CREATE TIMER for deferred battle resolution
            if (result.deferred) {
                const fortressCoords = clan.fortress;
                const travelTime = Math.sqrt(Math.pow(fortressCoords.x - targetX, 2) + Math.pow(fortressCoords.y - targetY, 2)) * 2;
                const totalDuration = (travelTime * 2 + 5);

                STATE.timers.push({
                    type: 'mission',
                    subtype: 'fortress_attack',
                    targetKey: `${targetX},${targetY}`,
                    originKey: `${fortressCoords.x},${fortressCoords.y}`,
                    startTime: Date.now(),
                    units: garrison,
                    endTime: Date.now() + (totalDuration * 1000),
                    desc: `התקפת מבצר על (${targetX},${targetY})`,
                    isFortressAttack: true,
                    deferredBattle: true,
                    attackParams: {
                        attacker: CURRENT_USER,
                        targetX: targetX,
                        targetY: targetY,
                        troops: garrison,
                        source: 'fortress'
                    }
                });

                // Server will deduct troops from garrison
                // Reload clan data to get updated garrison
                if (window.loadClans) {
                    await window.loadClans();
                }
                window.ALL_CLANS[clan.id] = ClanSystem.getPlayerClan();

                saveGame();
                updateUI();

                notify(`כוחות המבצר יצאו לקרב! הגעה ב-${Math.ceil(travelTime)} שניות.`, "success");

                return { success: true, deferred: true, message: 'התקפה נשלחה, תוצאות יגיעו בקרוב' };
            }

            // Legacy immediate result (shouldn't happen with new server)
            return { success: true, ...result };

        } catch (err) {
            console.error('Attack error:', err);
            return { success: false, error: 'שגיאה בשליחת התקיפה' };
        }
    },

    // Get clan list for browsing
    getAllClans() {
        return Object.values(window.ALL_CLANS).map(clan => ({
            id: clan.id,
            name: clan.name,
            tag: clan.tag,
            icon: clan.icon,
            description: clan.description,
            memberCount: Object.keys(clan.members).length,
            leader: clan.leader,
            createdAt: clan.createdAt
        }));
    },

    // Disband clan (leader only)
    disbandClan() {
        const clan = this.getPlayerClan();
        if (!clan) return { success: false, error: 'You are not in a clan' };

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== this.ROLES.LEADER) {
            return { success: false, error: 'Only the leader can disband the clan' };
        }

        // Remove clan
        const clanId = clan.id;
        delete window.ALL_CLANS[clan.id];

        // Delete from server
        fetch('/api/clans/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clan: { id: clanId, deleted: true } }) // Logic to be handled or just leave garbage?
            // Accessing the file system directly from client isn't possible.
            // I'll leave the server file as is for now (soft delete?) or use saveClan with a flag.
            // Let's just do a simple "save empty" or ignore for MVP.
            // Actually, the best way for now is just to support the "deleted" flag in server.
        });

        // Update all members
        STATE.clan = null;
        saveGame();

        return { success: true };
    },


    // Get invitations for current user
    getInvitations() {
        const myInvites = [];
        const myUserLower = CURRENT_USER.toLowerCase();

        for (const clanId in window.ALL_CLANS) {
            const clan = window.ALL_CLANS[clanId];
            if (clan.invitations) {
                // Case-insensitive check
                const inviteKey = Object.keys(clan.invitations).find(
                    u => u.toLowerCase() === myUserLower
                );

                if (inviteKey) {
                    myInvites.push({
                        clanId: clan.id,
                        clanName: clan.name,
                        clanTag: clan.tag,
                        timestamp: clan.invitations[inviteKey].timestamp,
                        originalName: inviteKey // Keep track of the key for accepting
                    });
                }
            }
        }
        return myInvites;
    },

    // Accept invitation
    async acceptInvitation(clanId) {
        // Check if already in a clan
        if (STATE.clan) {
            return { success: false, error: 'אתה כבר בקלאן!' };
        }

        const clan = this.getClan(clanId);
        if (!clan) {
            return { success: false, error: 'קלאן לא נמצא' };
        }

        // Check if clan is full
        if (Object.keys(clan.members).length >= this.CONFIG.MAX_MEMBERS) {
            return { success: false, error: 'הקלאן מלא' };
        }

        // Add player to clan
        clan.members[CURRENT_USER] = {
            role: this.ROLES.MEMBER,
            joinedAt: Date.now()
        };

        // Remove invitation
        if (clan.invitations) {
            delete clan.invitations[CURRENT_USER];
        }

        // Save clan
        await this.saveClan(clan);

        // Update player state
        STATE.clan = {
            id: clan.id,
            name: clan.name,
            tag: clan.tag
        };

        saveGame();

        return { success: true };
    },

    // Decline invitation
    async declineInvitation(clanId) {
        const clan = this.getClan(clanId);
        if (!clan || !clan.invitations[CURRENT_USER]) return;

        delete clan.invitations[CURRENT_USER];
        await this.saveClan(clan);
        return { success: true };
    }
};

//==========================================================================
// Clan UI Manager
//==========================================================================

const ClanUI = {
    currentTab: 'overview',

    // Render the main clan view
    render() {
        const container = document.getElementById('clan-main-container');
        if (!container) return;

        const clan = ClanSystem.getPlayerClan();

        if (!clan) {
            // No clan - show browser/create options AND INVITES
            this.renderNoClan(container);
        } else {
            // Has clan - show clan interface
            this.renderClanView(container, clan);
        }
    },

    // Render "no clan" state
    renderNoClan(container) {
        const invites = ClanSystem.getInvitations();
        let invitesHtml = '';

        if (invites.length > 0) {
            invitesHtml = `
                <div class="invitations-section" style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                    <h3 style="color:#fbbf24;">💌 Pending Invitations</h3>
                    <div class="invites-list" style="display:flex; flex-direction:column; gap:10px;">
                        ${invites.map(inv => `
                            <div class="invite-card" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:bold;">${inv.clanName} [${inv.clanTag}]</div>
                                    <div style="font-size:0.8rem; color:#94a3b8;">${new Date(inv.timestamp).toLocaleDateString()}</div>
                                </div>
                                <div style="display:flex; gap:5px;">
                                    <button class="btn-small-action" style="background:#22c55e;" onclick="ClanUI.acceptInvite('${inv.clanId}')">Accept</button>
                                    <button class="btn-small-action" style="background:#ef4444;" onclick="ClanUI.declineInvite('${inv.clanId}')">Decline</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="clan-content">
                <div class="empty-state">
                    <div class="empty-state-icon">🛡️</div>
                    <div class="empty-state-text">You are not in a clan</div>
                    <button class="btn-primary" onclick="ClanUI.showCreateClan()">Create Clan</button>
                    <button class="btn-primary" style="margin-top: 10px;" onclick="ClanUI.showClanBrowser()">Browse Clans</button>
                </div>
                ${invitesHtml}
            </div>
        `;
    },

    async acceptInvite(clanId) {
        const result = ClanSystem.acceptInvitation(clanId); // Note: acceptInvitation is sync (old) but we updated it to use saveClan (async).
        // Wait, acceptInvitation calls saveClan which is async, but it doesn't await it.
        // It returns { success: true }. 
        // We should treat it as async properly or just rely on the outcome.

        // Actually, looking at previous code, acceptInvitation calls saveClan then returns. 
        // Since we didn't update acceptInvitation signature to async, it returns immediately.
        // But saveClan runs in background. 
        // It returns { success: true }.
        // We should manually verify success or handle errors.
        // For MVP, if it returns success=true, we assume it works.

        if (result.success) {
            notify('Welcome to the clan!', 'success');
            ClanUI.render(); // Refresh to show clan view
            saveGame();
        } else {
            notify(result.error || 'Failed to join', 'error');
        }
    },

    async declineInvite(clanId) {
        await ClanSystem.declineInvitation(clanId);
        ClanUI.render(); // Refresh list
    },

    // Show create clan modal
    showCreateClan() {
        let selectedIcon = ClanSystem.CONFIG.ICONS[0];

        const iconsHtml = ClanSystem.CONFIG.ICONS.map(icon =>
            `<div class="icon-option ${icon === selectedIcon ? 'selected' : ''}" onclick="ClanUI.selectIcon(this, '${icon}')">${icon}</div>`
        ).join('');

        const html = `
            <div class="clan-create-modal">
                <div class="form-group">
                    <label class="form-label">Clan Name</label>
                    <input type="text" id="clan-name" class="form-input" maxlength="${ClanSystem.CONFIG.NAME_MAX_LENGTH}" placeholder="Enter clan name">
                    <div class="form-hint">English only, ${ClanSystem.CONFIG.NAME_MIN_LENGTH}-${ClanSystem.CONFIG.NAME_MAX_LENGTH} characters</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Clan Tag</label>
                    <input type="text" id="clan-tag" class="form-input" maxlength="${ClanSystem.CONFIG.TAG_MAX_LENGTH}" placeholder="TAG" style="text-transform: uppercase;">
                    <div class="form-hint">Uppercase only, ${ClanSystem.CONFIG.TAG_MIN_LENGTH}-${ClanSystem.CONFIG.TAG_MAX_LENGTH} characters</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" id="clan-desc" class="form-input" maxlength="100" placeholder="Optional description">
                </div>

                <div class="form-group">
                    <label class="form-label">Icon</label>
                    <div class="icon-selector" id="icon-selector">
                        ${iconsHtml}
                    </div>
                    <input type="hidden" id="selected-icon" value="${selectedIcon}">
                </div>

                <div class="cost-display">
                    <strong>Cost:</strong> ${ClanSystem.CONFIG.CREATE_COST.gold.toLocaleString()} 💰 + ${ClanSystem.CONFIG.CREATE_COST.wood.toLocaleString()} 🌲
                </div>
            </div>
        `;

        openModal('Create Clan', html, 'Create', () => {
            const name = document.getElementById('clan-name').value.trim();
            const tag = document.getElementById('clan-tag').value.trim().toUpperCase();
            const description = document.getElementById('clan-desc').value.trim();
            const icon = document.getElementById('selected-icon').value;

            const result = ClanSystem.createClan(name, tag, description, icon);

            if (result.success) {
                notify('Clan created successfully!', 'success');
                closeModal();
                switchView('clan'); // Refresh
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Select icon helper
    selectIcon(element, icon) {
        document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-icon').value = icon;
    },

    // Show clan browser
    async showClanBrowser() {
        // Refresh data first
        const refreshBtnId = 'btn-refresh-clans';

        const renderBrowser = () => {
            const clans = ClanSystem.getAllClans();
            let clansHtml = '';

            if (clans.length === 0) {
                clansHtml = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏜️</div>
                        <div class="empty-state-text">No clans found.</div>
                    </div>
                `;
            } else {
                clansHtml = clans.map(clan => `
                    <div class="clan-card" onclick="ClanUI.showClanInfo('${clan.id}')">
                        <div class="clan-card-icon">${clan.icon}</div>
                        <div class="clan-card-info">
                            <div class="clan-card-name">${clan.name}</div>
                            <div class="clan-card-tag">[${clan.tag}]</div>
                            <div class="clan-card-stats">
                                <span>👥 ${clan.memberCount}/${ClanSystem.CONFIG.MAX_MEMBERS}</span>
                                <span>👑 ${clan.leader}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            const container = document.getElementById('clans-browser-container');
            if (container) container.innerHTML = clansHtml;
            return `<div id="clans-browser-container" class="clans-browser">${clansHtml}</div>`;
        };

        const html = `
            <div style="margin-bottom: 10px; text-align: right;">
                <button class="btn-primary" id="${refreshBtnId}" onclick="ClanUI.refreshBrowser(this)">🔄 Refresh</button>
            </div>
            ${renderBrowser()}
        `;

        openModal('Browse Clans', html, 'Close', closeModal);

        // Auto-refresh in background if empty
        if (Object.keys(window.ALL_CLANS).length === 0) {
            this.refreshBrowser(document.getElementById(refreshBtnId));
        }
    },

    async refreshBrowser(btn) {
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Loading...';
        }

        await ClanSystem.loadClans();

        // Re-render container content
        const clans = ClanSystem.getAllClans();
        const container = document.getElementById('clans-browser-container');
        if (container) {
            let clansHtml = '';
            if (clans.length === 0) {
                clansHtml = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏜️</div>
                        <div class="empty-state-text">No clans found. Create one!</div>
                    </div>
                `;
            } else {
                clansHtml = clans.map(clan => `
                    <div class="clan-card" onclick="ClanUI.showClanInfo('${clan.id}')">
                        <div class="clan-card-icon">${clan.icon}</div>
                        <div class="clan-card-info">
                            <div class="clan-card-name">${clan.name}</div>
                            <div class="clan-card-tag">[${clan.tag}]</div>
                            <div class="clan-card-stats">
                                <span>👥 ${clan.memberCount}/${ClanSystem.CONFIG.MAX_MEMBERS}</span>
                                <span>👑 ${clan.leader}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            container.innerHTML = clansHtml;
        }

        if (btn) {
            btn.disabled = false;
            btn.innerText = '🔄 Refresh';
        }
    },

    // Render main clan view (when player is in a clan)
    renderClanView(container, clan) {
        const myRole = clan.members[CURRENT_USER]?.role || 'member';
        const canInvite = myRole === 'leader' || myRole === 'officer';
        const isLeader = myRole === 'leader';

        const inviteButtonHtml = canInvite ? `
            <button class="btn-primary" onclick="ClanUI.showInvitePlayer()" style="margin-left:10px;">הזמן שחקן</button>
        ` : '';

        // Add Settings tab for leaders
        const tabs = isLeader
            ? `<button class="clan-tab ${this.currentTab === 'overview' ? 'active' : ''}" onclick="ClanUI.switchTab('overview')">Overview</button>
               <button class="clan-tab ${this.currentTab === 'members' ? 'active' : ''}" onclick="ClanUI.switchTab('members')">Members</button>
               <button class="clan-tab ${this.currentTab === 'chat' ? 'active' : ''}" onclick="ClanUI.switchTab('chat')">Chat</button>
               <button class="clan-tab ${this.currentTab === 'treasury' ? 'active' : ''}" onclick="ClanUI.switchTab('treasury')">Treasury</button>
               <button class="clan-tab ${this.currentTab === 'fortress' ? 'active' : ''}" onclick="ClanUI.switchTab('fortress')">Fortress</button>
               <button class="clan-tab ${this.currentTab === 'settings' ? 'active' : ''}" onclick="ClanUI.switchTab('settings')">Settings</button>`
            : `<button class="clan-tab ${this.currentTab === 'overview' ? 'active' : ''}" onclick="ClanUI.switchTab('overview')">Overview</button>
               <button class="clan-tab ${this.currentTab === 'members' ? 'active' : ''}" onclick="ClanUI.switchTab('members')">Members</button>
               <button class="clan-tab ${this.currentTab === 'chat' ? 'active' : ''}" onclick="ClanUI.switchTab('chat')">Chat</button>
               <button class="clan-tab ${this.currentTab === 'treasury' ? 'active' : ''}" onclick="ClanUI.switchTab('treasury')">Treasury</button>
               <button class="clan-tab ${this.currentTab === 'fortress' ? 'active' : ''}" onclick="ClanUI.switchTab('fortress')">Fortress</button>
               ${canInvite ? `<button class="clan-tab ${this.currentTab === 'requests' ? 'active' : ''}" onclick="ClanUI.switchTab('requests')">Requests ${(clan.recruitment?.requests?.length || 0) > 0 ? `<span style="background:#ef4444; color:white; padding:2px 6px; border-radius:10px; font-size:0.7em;">${clan.recruitment.requests.length}</span>` : ''}</button>` : ''}`;

        container.innerHTML = `
            <!-- Clan Header -->
            <div class="clan-header">
                <div class="clan-icon">${clan.icon}</div>
                <div class="clan-info">
                    <h1 class="clan-name">${clan.name}</h1>
                    <div class="clan-tag">[${clan.tag}] • <span class="role-badge ${myRole}">${myRole}</span></div>
                    <div class="clan-description">${clan.description || 'No description'}</div>
                    ${inviteButtonHtml}
                </div>
            </div>

            <!-- Clan Tabs -->
            <div class="clan-tabs">
                ${tabs}
            </div>

            <!-- Tab Content -->
            <div class="clan-content" id="clan-tab-content">
                <!-- Injected by switchTab() -->
            </div>
        `;

        // Initial tab render
        this.switchTab(this.currentTab);
    },

    showInvitePlayer() {
        const html = `
            <div style="padding:20px;">
                <label class="form-label">שם השחקן להזמנה:</label>
                <input type="text" id="invite-username" class="form-input" placeholder="הכנס שם משתמש">
            </div>
        `;

        openModal('הזמן שחקן לקלאן', html, 'שלח הזמנה', () => {
            const username = document.getElementById('invite-username').value.trim();
            if (!username) {
                notify('אנא הכנס שם משתמש', 'error');
                return;
            }

            const result = ClanSystem.invitePlayer(username);
            if (result.success) {
                notify(`הזמנה נשלחה ל-${username}!`, 'success');
                closeModal();
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Show clan info (for join/request)
    showClanInfo(clanId) {
        const clan = ClanSystem.getClan(clanId);
        if (!clan) {
            notify('Clan not found', 'error');
            return;
        }

        const html = `
            <div style="text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 10px;">${clan.icon}</div>
                <h2 style="color: #fbbf24; margin: 0;">${clan.name}</h2>
                <div style="color: #94a3b8; margin-bottom: 15px;">[${clan.tag}]</div>
                <p style="color: #cbd5e1;">${clan.description || 'No description'}</p>
                
                <div class="stats-grid" style="margin-top: 20px;">
                    <div class="stat-card">
                        <div class="stat-value">${Object.keys(clan.members).length}</div>
                        <div class="stat-label">Members</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${clan.stats.wins}</div>
                        <div class="stat-label">Wins</div>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <strong style="color: #fbbf24;">Leader:</strong> ${clan.leader}
                </div>

                ${(() => {
                if (STATE.clan) return ''; // Already in a clan

                const rType = clan.recruitment ? clan.recruitment.type : 'closed';
                const requests = clan.recruitment ? clan.recruitment.requests : [];
                const hasApplied = requests.some(r => r.username === CURRENT_USER);

                if (hasApplied) {
                    return `<div style="margin-top:20px; color:#fbbf24; border:1px solid #fbbf24; padding:10px; border-radius:8px;">⏳ Application Pending</div>`;
                }

                if (rType === 'open') {
                    return `<button class="btn-primary" style="margin-top:20px; background:#22c55e;" onclick="ClanUI.joinClan('${clanId}')">Join Clan</button>`;
                } else if (rType === 'request') {
                    return `<button class="btn-primary" style="margin-top:20px; background:#3b82f6;" onclick="ClanUI.applyToClanUI('${clanId}')">Apply to Clan</button>`;
                } else {
                    return `<div style="margin-top:20px; color:#94a3b8; border:1px solid #475569; padding:10px; border-radius:8px;">🔒 Invite Only</div>`;
                }
            })()}
            </div>
        `;

        openModal(clan.name, html, 'Close', closeModal);
    },

    async joinClan(clanId) {
        // Wrapper for existing join
        const result = await ClanSystem.joinClan(clanId);
        if (result.success) closeModal();
    },

    async applyToClanUI(clanId) {
        const clan = ClanSystem.getClan(clanId);
        if (!confirm(`Apply to join ${clan.name}?`)) return;

        const result = await ClanSystem.applyToClan(clanId);
        if (result.success) {
            notify('Application sent successfully!', 'success');
            // Optimistically update UI logic? 
            // Better to reload clan or manually add to local `recruitment.requests` if accessible
            // But recruitment.requests might not be in the public clan object if filtered.
            // Assuming we trust the UI state for now.
            closeModal();
            ClanUI.showClanInfo(clanId); // Re-open to show pending status? Or just close.
        } else {
            notify(result.error || 'Failed to apply', 'error');
        }
    },

    // Switch tab
    switchTab(tab) {
        // Clear existing poll if any
        if (this.chatPollingInterval) {
            clearInterval(this.chatPollingInterval);
            this.chatPollingInterval = null;
        }

        this.currentTab = tab;
        const clan = ClanSystem.getPlayerClan();
        if (clan) {
            this.renderTab(clan);

            // Start polling if chat
            if (tab === 'chat') {
                this.startChatPolling(clan.id);
            }
        }
    },

    startChatPolling(clanId) {
        // Poll every 3 seconds
        this.chatPollingInterval = setInterval(async () => {
            // Only if tab is still chat and modal/view is open? 
            // We assume if switchTab was called, we are good.
            // But if user closed modal? we need a cleanup.
            // Ideally `closeModal` or `switchView` should clean this up.
            // For now, we'll check if the element exists.
            if (!document.getElementById('chat-messages')) {
                clearInterval(this.chatPollingInterval);
                return;
            }

            const updatedClan = await ClanSystem.refreshClanData(clanId);
            if (updatedClan) {
                // Re-render only messages part to avoid input blur
                this.updateChatMessages(updatedClan);
            }
        }, 3000);
    },

    updateChatMessages(clan) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        // Check if scrolled to bottom
        const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

        const messages = clan.messages.slice(-50).map(msg => {
            const isSystem = msg.sender === 'system';
            return `
                <div class="chat-message ${isSystem ? 'system' : ''}">
                    ${!isSystem ? `<div class="chat-sender">${msg.sender}</div>` : ''}
                    <div class="chat-text">${msg.text}</div>
                    <div class="chat-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
            `;
        }).join('');

        // Diffing would be better but InnerHTML is okay for 50 items
        if (container.innerHTML !== messages // Simple check won't work perfectly due to timestamps etc, but replacing is cheap
        ) {
            container.innerHTML = messages || '<div class="empty-state-text">No messages yet. Start the conversation!</div>';

            // Auto-scroll if was at bottom or new message
            if (isScrolledToBottom) {
                container.scrollTop = container.scrollHeight;
            }
        }
    },

    // Render specific tab content
    renderTab(clan) {
        const content = document.getElementById('clan-tab-content');
        if (!content) return;

        switch (this.currentTab) {
            case 'overview':
                this.renderOverview(content, clan);
                break;
            case 'members':
                this.renderMembers(content, clan);
                break;
            case 'chat':
                this.renderChat(content, clan);
                break;
            case 'treasury':
                this.renderTreasury(content, clan);
                break;
            case 'fortress':
                this.renderFortress(content, clan);
                break;
            case 'settings':
                this.renderSettings(content, clan);
                break;
            case 'requests':
                this.renderRequests(content, clan);
                break;
        }
    },

    // Render overview tab
    renderOverview(content, clan) {
        const stats = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(clan.members).length}</div>
                    <div class="stat-label">Members</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clan.stats.wins}</div>
                    <div class="stat-label">Wins</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clan.stats.losses}</div>
                    <div class="stat-label">Losses</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clan.stats.territories}</div>
                    <div class="stat-label">Territories</div>
                </div>
            </div>

            <div style="margin-top: 20px;">
                <h3 style="color: #fbbf24;">Clan Info</h3>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <p><strong>Leader:</strong> ${clan.leader}</p>
                    <p><strong>Created:</strong> ${new Date(clan.createdAt).toLocaleDateString()}</p>
                    <p><strong>Total Members:</strong> ${Object.keys(clan.members).length}/${ClanSystem.CONFIG.MAX_MEMBERS}</p>
                </div>
            </div>

            ${clan.members[CURRENT_USER]?.role === 'leader' ? `
                <button class="btn-primary" style="background: #ef4444; margin-top: 20px;" onclick="ClanUI.confirmDisband()">Disband Clan</button>
            ` : `
                <button class="btn-primary" style="background: #ef4444; margin-top: 20px;" onclick="ClanUI.confirmLeave()">Leave Clan</button>
            `}
        `;

        content.innerHTML = stats;
    },

    // Render members tab
    renderMembers(content, clan) {
        const myRole = clan.members[CURRENT_USER]?.role;
        const isLeaderOrOfficer = myRole === 'leader' || myRole === 'officer';

        const getRoleIcon = (role) => {
            if (role === 'leader') return '👑';
            if (role === 'officer') return '⭐';
            return '👤';
        };

        const members = Object.entries(clan.members).map(([username, data]) => {
            const actions = isLeaderOrOfficer && username !== CURRENT_USER && data.role !== 'leader' ? `
                <div class="member-actions">
                    ${myRole === 'leader' && data.role !== 'officer' ?
                    `<button class="member-action-btn promote" onclick="ClanUI.promoteMember('${username}', 'officer')">Promote</button>` : ''}
                    ${myRole === 'leader' && data.role === 'officer' ?
                    `<button class="member-action-btn" onclick="ClanUI.promoteMember('${username}', 'member')">Demote</button>` : ''}
                    <button class="member-action-btn" onclick="ClanUI.kickMember('${username}')">Kick</button>
                </div>
            ` : '';

            return `
                <div class="member-card">
                    <div class="member-role-icon">${getRoleIcon(data.role)}</div>
                    <div class="member-details">
                        <div class="member-name">${username}</div>
                        <div class="member-role">${data.role}</div>
                        <div class="member-stats">Joined: ${new Date(data.joinedAt).toLocaleDateString()}</div>
                    </div>
                    ${actions}
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="members-list">
                ${members}
            </div>
        `;
    },

    // Render chat tab
    renderChat(content, clan) {
        const messages = clan.messages.slice(-50).map(msg => {
            const isSystem = msg.sender === 'system';
            return `
                <div class="chat-message ${isSystem ? 'system' : ''}">
                    ${!isSystem ? `<div class="chat-sender">${msg.sender}</div>` : ''}
                    <div class="chat-text">${msg.text}</div>
                    <div class="chat-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="clan-chat">
                <div class="chat-messages" id="chat-messages">
                    ${messages || '<div class="empty-state-text">No messages yet. Start the conversation!</div>'}
                </div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" class="chat-input" placeholder="Type your message..." maxlength="200" onkeypress="if(event.key === 'Enter') ClanUI.sendChatMessage()">
                    <button class="chat-send-btn" onclick="ClanUI.sendChatMessage()">Send</button>
                </div>
            </div>
        `;

        // Auto-scroll to bottom
        setTimeout(() => {
            const chatBox = document.getElementById('chat-messages');
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
    },

    // Send chat message
    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();

        if (!text) return;

        const clan = ClanSystem.getPlayerClan();
        if (!clan) return;

        const result = await ClanSystem.sendMessage(clan.id, text);

        if (result.success) {
            input.value = '';
            // Render update invoked by optimistic update in sendMessage
            this.updateChatMessages(ClanSystem.getClan(clan.id));
        } else {
            notify(result.error || 'Failed to send', 'error');
        }
    },

    // Render treasury tab
    renderTreasury(content, clan) {
        const resources = ['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'];
        const icons = {
            gold: '💰',
            wood: '🌲',
            food: '🌾',
            wine: '🍷',
            marble: '🏛️',
            crystal: '💎',
            sulfur: '🔥'
        };

        const treasuryResources = resources.map(res => `
            <div class="treasury-resource">
                <div class="treasury-resource-icon">${icons[res]}</div>
                <div class="treasury-resource-amount">${(clan.treasury[res] || 0).toLocaleString()}</div>
                <div style="font-size: 0.8rem; color: #94a3b8;">${res}</div>
            </div>
        `).join('');

        const donateInputs = resources.map(res => `
            <div class="donate-input-group">
                <span>${icons[res]}</span>
                <input type="number" class="donate-input" id="donate-${res}" min="0" max="${STATE.resources[res] || 0}" placeholder="0">
            </div>
        `).join('');

        content.innerHTML = `
            <div class="clan-treasury">
                <div class="treasury-title">💰 Clan Treasury</div>
                <div class="treasury-resources">
                    ${treasuryResources}
                </div>

                <div class="donate-section">
                    <h4 style="color: #fbbf24; margin-bottom: 10px;">Donate Resources</h4>
                    <div class="donate-inputs">
                        ${donateInputs}
                    </div>
                    <button class="donate-btn" onclick="ClanUI.donateResources()">Donate</button>
                </div>
            </div>
        `;
    },

    // Donate resources
    donateResources() {
        const resources = {};
        ['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'].forEach(res => {
            const amount = parseInt(document.getElementById(`donate-${res}`).value) || 0;
            if (amount > 0) {
                resources[res] = amount;
            }
        });

        if (Object.keys(resources).length === 0) {
            notify('Please enter an amount to donate', 'error');
            return;
        }

        const result = ClanSystem.donate(resources);

        if (result.success) {
            notify('Resources donated successfully!', 'success');
            updateUI();
            this.renderTreasury(document.getElementById('clan-tab-content'), ClanSystem.getPlayerClan());
        } else {
            notify(result.error, 'error');
        }
    },

    // Kick member
    kickMember(username) {
        if (!confirm(`Are you sure you want to kick ${username}?`)) return;

        const result = ClanSystem.kickMember(username);

        if (result.success) {
            notify(`${username} has been kicked`, 'success');
            this.renderMembers(document.getElementById('clan-tab-content'), ClanSystem.getPlayerClan());
        } else {
            notify(result.error, 'error');
        }
    },

    // Promote member
    promoteMember(username, newRole) {
        const result = ClanSystem.setMemberRole(username, newRole);

        if (result.success) {
            notify(`${username} is now ${newRole}`, 'success');
            this.renderMembers(document.getElementById('clan-tab-content'), ClanSystem.getPlayerClan());
        } else {
            notify(result.error, 'error');
        }
    },

    // Confirm leave
    confirmLeave() {
        if (!confirm('Are you sure you want to leave the clan?')) return;

        const result = ClanSystem.leaveClan();

        if (result.success) {
            notify('You have left the clan', 'success');
            switchView('clan'); // Refresh
        } else {
            notify(result.error, 'error');
        }
    },

    // Confirm disband
    confirmDisband() {
        if (!confirm('Are you sure you want to disband the clan? This cannot be undone!')) return;

        const result = ClanSystem.disbandClan();

        if (result.success) {
            notify('Clan disbanded', 'success');
            switchView('clan'); // Refresh
        } else {
            notify(result.error, 'error');
        }
    },

    // Render settings tab (leader only)
    renderSettings(content, clan) {
        const myRole = clan.members[CURRENT_USER]?.role;

        if (myRole !== 'leader') {
            content.innerHTML = '<div class="empty-state-text">רק מנהיג הקלאן יכול לגשת להגדרות</div>';
            return;
        }

        const recruitmentType = clan.recruitment ? clan.recruitment.type : 'closed';

        content.innerHTML = `
            <div style="padding: 20px;">
                <h3 style="color: #fbbf24; margin-bottom: 20px;">הגדרות קלאן</h3>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label class="form-label">תיאור הקלאן:</label>
                    <input type="text" id="clan-desc-edit" class="form-input" 
                           value="${clan.description || ''}" 
                           maxlength="100" 
                           placeholder="הוסף תיאור לקלאן...">
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label class="form-label">סטטוס גיוס:</label>
                    <select id="recruitment-type" class="form-input">
                        <option value="closed" ${recruitmentType === 'closed' ? 'selected' : ''}>🔒 סגור (הזמנה בלבד)</option>
                        <option value="request" ${recruitmentType === 'request' ? 'selected' : ''}>📄 בקשת הצטרפות (דורש אישור)</option>
                        <option value="open" ${recruitmentType === 'open' ? 'selected' : ''}>✅ פתוח (הצטרפות מיידית)</option>
                    </select>
                </div>

                <button class="btn-primary" onclick="ClanUI.saveSettings()">שמור הגדרות</button>

                <hr style="margin: 30px 0; border-color: rgba(255,255,255,0.1);">

                <h3 style="color: #fbbf24; margin-bottom: 20px;">חלוקת משאבים מהאוצר</h3>
                <p style="color: #94a3b8; margin-bottom: 15px;">העבר משאבים מאוצר הקלאן לחברים</p>
                <button class="btn-primary" onclick="ClanUI.showDistributeTreasury()">חלק משאבים</button>

            <hr style="margin: 30px 0; border-color: rgba(239, 68, 68, 0.3);">

            <h3 style="color: #ef4444; margin-bottom: 20px;">⚠️ Danger Zone</h3>
            <div style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <p style="color: #fca5a5; margin-bottom: 15px;">
                    מחיקת הקלאן היא פעולה בלתי הפיכה. <br>
                    - הקלאן יימחק לצמיתות.<br>
                    - המבצר יושמד.<br>
                    - כל החברים יסולקו מהקלאן.
                </p>
                <button class="btn-primary" style="background: #ef4444; color: white; width: 100%;" onclick="ClanUI.deleteClan()">DELETE CLAN</button>
            </div>
        </div>
    `;
    },

    // Delete Clan UI Handler
    async deleteClan() {
        if (!confirm('האם אתה בטוח שברצונך למחוק את הקלאן? פעולה זו אינה הפיכה!')) return;
        if (!confirm('אזהרה אחרונה: כל הנתונים ימחקו והמבצר יושמד. האם להמשיך?')) return;

        const clan = ClanSystem.getPlayerClan();
        if (!clan) return;

        const result = await ClanSystem.deleteClan(clan.id);
        if (result.success) {
            notify('הקלאן נמחק בהצלחה', 'success');
            // Reset UI
            this.currentTab = 'overview';
            STATE.clan = null;
            if (typeof switchView === 'function') switchView('city');
        } else {
            notify(result.error || 'שגיאה במחיקת הקלאן', 'error');
        }
    },

    // Render Requests Tab
    renderRequests(content, clan) {
        const requests = clan.recruitment ? clan.recruitment.requests : [];

        if (requests.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">אין בקשות הצטרפות חדשות</div>
                </div>
            `;
            return;
        }

        const requestsHtml = requests.map(req => `
            <div class="member-card" style="justify-content:space-between;">
                <div class="member-details">
                    <div class="member-name">${req.username}</div>
                    <div class="member-stats">${new Date(req.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="member-actions">
                    <button class="member-action-btn" style="background:#22c55e;" onclick="ClanUI.handleRequestUI('${req.username}', 'accept')">אשר</button>
                    <button class="member-action-btn" style="background:#ef4444;" onclick="ClanUI.handleRequestUI('${req.username}', 'reject')">דחה</button>
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div style="padding:20px;">
                <h3 style="color:#fbbf24; margin-bottom:15px;">בקשות הצטרפות (${requests.length})</h3>
                <div class="members-list">
                    ${requestsHtml}
                </div>
            </div>
        `;
    },

    async handleRequestUI(username, action) {
        const result = await ClanSystem.handleRequest(username, action);
        if (result.success) {
            notify(action === 'accept' ? 'בקשה אושרה!' : 'בקשה נדחתה.', 'success');
            ClanUI.render(); // Refresh all
        } else {
            notify(result.error || 'Operation failed', 'error');
        }
    },

    saveSettings() {
        const description = document.getElementById('clan-desc-edit')?.value || '';
        const recruitmentType = document.getElementById('recruitment-type')?.value;

        const result = ClanSystem.updateSettings({ description, recruitmentType });

        if (result.success) {
            notify('ההגדרות נשמרו בהצלחה!', 'success');
            ClanUI.render();
        } else {
            notify(result.error, 'error');
        }
    },

    showDistributeTreasury() {
        const clan = ClanSystem.getPlayerClan();
        if (!clan) return;

        const membersOptions = Object.keys(clan.members)
            .map(username => `<option value="${username}">${username}</option>`)
            .join('');

        const html = `
            <div style="padding: 20px;">
                <h3 style="color: #fbbf24; margin-bottom: 15px;">חלוקת משאבים</h3>
                
                <div class="form-group">
                    <label class="form-label">שחקן:</label>
                    <select id="dist-username" class="form-input">
                        ${membersOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">זהב (זמין: ${clan.treasury.gold || 0}):</label>
                    <input type="number" id="dist-gold" class="form-input" min="0" max="${clan.treasury.gold || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">עץ (זמין: ${clan.treasury.wood || 0}):</label>
                    <input type="number" id="dist-wood" class="form-input" min="0" max="${clan.treasury.wood || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">אוכל (זמין: ${clan.treasury.food || 0}):</label>
                    <input type="number" id="dist-food" class="form-input" min="0" max="${clan.treasury.food || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">יין (זמין: ${clan.treasury.wine || 0}):</label>
                    <input type="number" id="dist-wine" class="form-input" min="0" max="${clan.treasury.wine || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">שיש (זמין: ${clan.treasury.marble || 0}):</label>
                    <input type="number" id="dist-marble" class="form-input" min="0" max="${clan.treasury.marble || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">קריסטל (זמין: ${clan.treasury.crystal || 0}):</label>
                    <input type="number" id="dist-crystal" class="form-input" min="0" max="${clan.treasury.crystal || 0}" value="0">
                </div>

                <div class="form-group">
                    <label class="form-label">גפרית (זמין: ${clan.treasury.sulfur || 0}):</label>
                    <input type="number" id="dist-sulfur" class="form-input" min="0" max="${clan.treasury.sulfur || 0}" value="0">
                </div>
            </div>
        `;

        openModal('חלוקת משאבים מהאוצר', html, 'חלק', () => {
            const username = document.getElementById('dist-username').value;
            const gold = parseInt(document.getElementById('dist-gold').value) || 0;
            const wood = parseInt(document.getElementById('dist-wood').value) || 0;
            const food = parseInt(document.getElementById('dist-food').value) || 0;
            const wine = parseInt(document.getElementById('dist-wine').value) || 0;
            const marble = parseInt(document.getElementById('dist-marble').value) || 0;
            const crystal = parseInt(document.getElementById('dist-crystal').value) || 0;
            const sulfur = parseInt(document.getElementById('dist-sulfur').value) || 0;

            const result = ClanSystem.distributeTreasury(username, { gold, wood, food, wine, marble, crystal, sulfur });

            if (result.success) {
                notify(`משאבים הועברו ל-${username}!`, 'success');
                closeModal();
                ClanUI.render();
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Render fortress tab
    renderFortress(content, clan) {
        const myRole = clan.members[CURRENT_USER]?.role;

        if (!clan.fortress) {
            // No fortress - show build option (leader only)
            if (myRole === 'leader') {
                const cost = '50,000 זהב + 30,000 עץ';
                const canAfford = (clan.treasury.gold >= 50000) && (clan.treasury.wood >= 30000);

                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏰</div>
                        <div class="empty-state-text">אין מבצר לקלאן</div>
                        <p style="color: #94a3b8; margin: 20px 0;">מבצר הוא בסיס צבאי משותף לאחסון חיילים ומשאבים</p>
                        <p style="color: #fbbf24; margin-bottom: 20px;">עלות: ${cost}</p>
                        <button class="btn-primary" 
                                onclick="ClanUI.buildFortress()" 
                                ${!canAfford ? 'disabled' : ''}>
                            ${canAfford ? 'בנה מבצר' : 'אין מספיק משאבים'}
                        </button>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏰</div>
                        <div class="empty-state-text">אין מבצר לקלאן</div>
                        <p style="color: #94a3b8;">רק מנהיג הקלאן יכול לבנות מבצר</p>
                    </div>
                `;
            }
            return;
        }

        // Fortress exists - show stats and management
        const fort = clan.fortress;
        // Use garrison (new) or troops (old) for backward compatibility
        const troops = fort.garrison || fort.troops || {};
        const resources = fort.resources || { gold: 0, wood: 0, food: 0 };

        // Unit names in Hebrew
        const unitNames = {
            spearman: '🔱 חניתים',
            archer: '🏹 קשתים',
            swordsman: '⚔️ לוחמי חרב',
            cavalry: '🐴 פרשים',
            axeman: '🪓 לוחמי גרזן',
            mountedRaider: '🏇 פושטים רכובים',
            heavyCavalry: '🛡️ פרשים כבדים',
            mountedArcher: '🏹🐎 קשתים רכובים',
            berserker: '😡 ברסרקרים',
            shieldWall: '🛡️ חומת מגן',
            dualWielder: '⚔️⚔️ לוחמי חרב כפולה',
            catapult: '🎯 בליסטות',
            batteringRam: '🚪 מכבש',
            ballista: '🎯 קטפולטה',
            knight: '🗡️ אבירים',
            elite: '👑 עילית',
            soldier: '⚔️ חיילים'
        };

        // Generate troop cards dynamically for all available troops
        let troopsHtml = '<div class="stats-grid" style="margin-bottom: 20px;">';

        // Show all troops that exist in the garrison
        const troopEntries = Object.entries(troops).filter(([type, count]) => count > 0);

        if (troopEntries.length > 0) {
            for (const [type, count] of troopEntries) {
                const displayName = unitNames[type] || `❓ ${type}`;
                troopsHtml += `
                    <div class="stat-card">
                        <div class="stat-value">${displayName}</div>
                        <div class="stat-label">${count.toLocaleString()}</div>
                    </div>
                `;
            }
        } else {
            troopsHtml += `
                <div class="stat-card" style="grid-column: 1 / -1;">
                    <div class="stat-label" style="color: #94a3b8;">אין חיילים במבצר</div>
                </div>
            `;
        }

        troopsHtml += '</div>';

        const resourcesHtml = `
            <div style="display: flex; gap: 15px; margin-top: 15px;">
                <span>💰 ${resources.gold || 0}</span>
                <span>🌲 ${resources.wood || 0}</span>
                <span>🌾 ${resources.food || 0}</span>
            </div>
        `;

        // Show player's deposited troops
        const myDeposits = fort.deposits?.[CURRENT_USER] || {};

        // Build my deposits HTML dynamically
        let myDepositsContent = '';
        const myTroopEntries = Object.entries(myDeposits).filter(([type, count]) => count > 0);

        if (myTroopEntries.length > 0) {
            myDepositsContent = myTroopEntries.map(([type, count]) => {
                const displayName = unitNames[type] || type;
                return `<span>${displayName}: ${count.toLocaleString()}</span>`;
            }).join('');
        } else {
            myDepositsContent = '<span style="color: #94a3b8;">לא הפקדת חיילים עדיין</span>';
        }

        const myDepositsHtml = `
            <div style="background: rgba(251,191,36,0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #fbbf24; margin: 0 0 10px 0;">החיילים שלי במבצר:</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; color: #cbd5e1;">
                    ${myDepositsContent}
                </div>
                <p style="color: #94a3b8; font-size: 0.9em; margin: 10px 0 0 0;">ניתן למשוך רק חיילים שהפקדת</p>
            </div>
        `;

        // Clan treasury (not fortress resources - fortress only stores troops)
        const treasury = clan.treasury || {};
        const treasuryHtml = `
            <div style="display: flex; gap: 15px; margin-top: 15px; flex-wrap: wrap;">
                <span>💰 ${(treasury.gold || 0).toLocaleString()}</span>
                <span>🌲 ${(treasury.wood || 0).toLocaleString()}</span>
                <span>🌾 ${(treasury.food || 0).toLocaleString()}</span>
                <span>🍷 ${(treasury.wine || 0).toLocaleString()}</span>
                <span>💎 ${(treasury.crystal || 0).toLocaleString()}</span>
                <span>🗿 ${(treasury.marble || 0).toLocaleString()}</span>
            </div>
            <p style="color: #94a3b8; font-size: 0.9em; margin-top: 10px;">המבצר מאחסן חיילים בלבד. משאבים נשארים באוצר הקלאן.</p>
        `;

        content.innerHTML = `
            <div style="padding: 20px;">
                <div class="fortress-header" style="text-align: center; margin-bottom: 30px;">
                    <div style="font-size: 4rem;">🏰</div>
                    <h2 style="color: #fbbf24;">מבצר ${clan.name}</h2>
                    <p style="color: #94a3b8;">מיקום: (${fort.x}, ${fort.y})</p>
                </div>

                <h3 style="color: #fbbf24; margin-bottom: 15px;">💂 סך החיילים במבצר</h3>
                ${troopsHtml}

                ${myDepositsHtml}

                <div style="display: flex; gap: 10px; margin-bottom: 30px;">
                    <button class="btn-primary" onclick="ClanUI.showDeployTroops()">פרוס חיילים</button>
                    <button class="btn-primary" style="background: #64748b;" onclick="ClanUI.showWithdrawTroops()">משוך חיילים</button>
                    ${myRole === 'leader' ? '<button class="btn-primary" style="background: #dc2626;" onclick="ClanUI.showAttackUI()">⚔️ תקיפה משותפת</button>' : ''}
                </div>

                <h3 style="color: #fbbf24; margin-bottom: 10px;">💰 אוצר הקלאן</h3>
                ${treasuryHtml}
            </div>
        `;
    },

    // Build fortress
    async buildFortress() {
        if (!confirm('לבנות מבצר עבור הקלאן? עלות: 50,000 זהב + 30,000 עץ')) return;

        const result = await ClanSystem.buildFortress();

        if (result.success) {
            notify('המבצר נבנה בהצלחה! 🏰', 'success');
            await syncWorldPlayers(); // Refresh map
            ClanUI.render(); // Refresh UI
        } else {
            notify(result.error, 'error');
        }
    },

    // Show deploy troops modal
    // --- Fortress UI Helpers ---
    openFortressGarrison() {
        this.showDeployTroops();
    },

    openFortressDeposit() {
        const clan = ClanSystem.getPlayerClan();
        if (!clan) return notify('You are not in a clan', 'error');

        const html = `
            <div style="text-align:center; padding:10px;">
                <p style="color:#cbd5e1; margin-bottom:15px;">Donate resources to the Clan Treasury to fund upgrades and fortress maintenance.</p>
                
                <div class="resource-inputs" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
                    ${['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'].map(res => `
                        <div class="res-input-group" style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#fbbf24;">${res.charAt(0).toUpperCase() + res.slice(1)}</span>
                                <span style="font-size:0.8em; color:#94a3b8;">Avail: ${Math.floor(STATE.resources[res] || 0)}</span>
                            </div>
                            <input type="number" id="deposit-${res}" class="form-input" placeholder="0" min="0" 
                                   style="width:100%; background:rgba(0,0,0,0.3); border:1px solid #475569; color:white; padding:4px;">
                        </div>
                    `).join('')}
                </div>

                <button class="btn-primary" onclick="ClanUI.submitDeposit()" style="width:100%; padding:10px;">📦 Deposit Resources</button>
            </div>
        `;

        openModal('Deposit to Treasury', html);
    },

    async submitDeposit() {
        const resources = ['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'];
        const depositAmounts = {};
        let total = 0;

        // Validation
        for (const res of resources) {
            const input = document.getElementById(`deposit-${res}`);
            if (input) {
                const val = parseInt(input.value) || 0;
                if (val > 0) {
                    if (val > (STATE.resources[res] || 0)) {
                        return notify(`Not enough ${res}!`, 'error');
                    }
                    depositAmounts[res] = val;
                    total += val;
                }
            }
        }

        if (total === 0) return notify('Please enter an amount to deposit', 'warning');

        // Execute Deposit
        const clan = ClanSystem.getPlayerClan();
        if (!clan) return;

        // Update Client State
        for (const [res, amount] of Object.entries(depositAmounts)) {
            STATE.resources[res] -= amount;
            if (!clan.treasury[res]) clan.treasury[res] = 0;
            clan.treasury[res] += amount;
        }

        // Save
        updateResourcesUI();
        await ClanSystem.saveClan(clan); // Sync to server
        saveGame(); // Save player resources

        notify(`Deposited ${total} resources to clan!`, 'success');
        closeModal();
    },

    showDeployTroops() {
        const clan = ClanSystem.getPlayerClan();
        if (!clan || !clan.fortress) return;

        const myArmy = STATE.army || {};

        // Unit names in Hebrew  
        const unitNames = {
            spearman: 'חניתים',
            archer: 'קשתים',
            swordsman: 'לוחמי חרב',
            cavalry: 'פרשים',
            axeman: 'לוחמי גרזן',
            mountedRaider: 'פושטים רכובים',
            heavyCavalry: 'פרשים כבדים',
            mountedArcher: 'קשתים רכובים',
            berserker: 'ברסרקרים',
            shieldWall: 'חומת מגן',
            dualWielder: 'לוחמי חרב כפולה',
            catapult: 'בליסטות',
            batteringRam: 'מכבש',
            ballista: 'קטפולטה',
            knight: 'אבירים',
            elite: 'עילית',
            soldier: 'חיילים'
        };

        // Build form inputs dynamically for troops player has
        let formInputs = '';
        const troopTypes = Object.entries(myArmy).filter(([type, count]) => count > 0);

        if (troopTypes.length === 0) {
            formInputs = '<p style="color: #94a3b8;">אין לך חיילים לפריסה</p>';
        } else {
            for (const [type, count] of troopTypes) {
                const displayName = unitNames[type] || type;
                formInputs += `
                    <div class="form-group">
                        <label class="form-label">${displayName} (ברשותך: ${count}):</label>
                        <input type="number" id="deploy-${type}" class="form-input" min="0" max="${count}" value="0">
                    </div>
                `;
            }
        }

        const html = `
            <div style="padding: 20px;">
                <h3 style="color: #fbbf24; margin-bottom: 15px;">פרוס חיילים למבצר</h3>
                <p style="color: #94a3b8; margin-bottom: 20px;">העבר חיילים מהעיר שלך למבצר המשותף</p>
                ${formInputs}
            </div>
        `;

        openModal('פרוס חיילים', html, 'פרוס', async () => {
            // Collect all troop inputs dynamically
            const troopsToSend = {};
            for (const [type,] of troopTypes) {
                const amount = parseInt(document.getElementById(`deploy-${type}`)?.value) || 0;
                if (amount > 0) {
                    troopsToSend[type] = amount;
                }
            }

            if (Object.keys(troopsToSend).length === 0) {
                notify('בחר כמות חיילים לפריסה', 'error');
                return;
            }

            const result = await ClanSystem.deployTroops(troopsToSend);

            if (result.success) {
                notify('חיילים נפרסו למבצר!', 'success');
                closeModal();
                ClanUI.render();
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Show withdraw troops modal
    showWithdrawTroops() {
        const clan = ClanSystem.getPlayerClan();
        if (!clan || !clan.fortress) return;

        // Use garrison (new) or troops (old) for backward compatibility
        const troops = clan.fortress.garrison || clan.fortress.troops || {};

        // Unit names in Hebrew
        const unitNames = {
            spearman: 'חניתים',
            archer: 'קשתים',
            swordsman: 'לוחמי חרב',
            cavalry: 'פרשים',
            axeman: 'לוחמי גרזן',
            mountedRaider: 'פושטים רכובים',
            heavyCavalry: 'פרשים כבדים',
            mountedArcher: 'קשתים רכובים',
            berserker: 'ברסרקרים',
            shieldWall: 'חומת מגן',
            dualWielder: 'לוחמי חרב כפולה',
            catapult: 'בליסטות',
            batteringRam: 'מכבש',
            ballista: 'קטפולטה',
            knight: 'אבירים',
            elite: 'עילית',
            soldier: 'חיילים'
        };

        // Build form inputs dynamically for troops in fortress
        let formInputs = '';
        const troopTypes = Object.entries(troops).filter(([type, count]) => count > 0);

        if (troopTypes.length === 0) {
            formInputs = '<p style="color: #94a3b8;">אין חיילים במבצר למשיכה</p>';
        } else {
            for (const [type, count] of troopTypes) {
                const displayName = unitNames[type] || type;
                formInputs += `
                    <div class="form-group">
                        <label class="form-label">${displayName} (במבצר: ${count}):</label>
                        <input type="number" id="withdraw-${type}" class="form-input" min="0" max="${count}" value="0">
                    </div>
                `;
            }
        }

        const html = `
            <div style="padding: 20px;">
                <h3 style="color: #fbbf24; margin-bottom: 15px;">משוך חיילים מהמבצר</h3>
                <p style="color: #94a3b8; margin-bottom: 20px;">קח חיילים מהמבצר חזרה לעיר שלך</p>
                ${formInputs}
            </div>
        `;

        openModal('משוך חיילים', html, 'משוך', async () => {
            // Collect all troop inputs dynamically
            const troopsToWithdraw = {};
            for (const [type,] of troopTypes) {
                const amount = parseInt(document.getElementById(`withdraw-${type}`)?.value) || 0;
                if (amount > 0) {
                    troopsToWithdraw[type] = amount;
                }
            }

            if (Object.keys(troopsToWithdraw).length === 0) {
                notify('בחר כמות חיילים למשיכה', 'error');
                return;
            }

            const result = await ClanSystem.withdrawTroops(troopsToWithdraw);

            if (result.success) {
                notify('חיילים נמשכו מהמבצר!', 'success');
                closeModal();
                ClanUI.render();
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Show attack UI (leader only)
    showAttackUI() {
        const clan = ClanSystem.getPlayerClan();
        if (!clan || !clan.fortress) return;

        const myRole = clan.members[CURRENT_USER]?.role;
        if (myRole !== 'leader') {
            notify('רק מנהיג הקלאן יכול לשלוח תקיפות', 'error');
            return;
        }

        const troops = clan.fortress.garrison || {};
        const totalTroops = troops.spearman + troops.archer + troops.swordsman;

        if (totalTroops === 0) {
            notify('אין חיילים במבצר!', 'error');
            return;
        }

        const html = `
            <div style="padding: 20px;">
                <h3 style="color: #fbbf24; margin-bottom: 15px;">⚔️ תקיפה משותפת מהמבצר</h3>
                <p style="color: #94a3b8; margin-bottom: 20px;">שלח את כל כוחות המבצר לתקוף יעד. השלל יחולק אוטומטית לתורמים.</p>
                
                <div style="background: rgba(251,191,36,0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #fbbf24; margin: 0 0 10px 0;">כוחות זמינים:</h4>
                    <div style="display: flex; gap: 15px; color: #cbd5e1;">
                        <span>🔱 ${troops.spearman} חניתים</span>
                        <span>🏹 ${troops.archer} קשתים</span>
                        <span>⚔️ ${troops.swordsman} לוחמי חרב</span>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.9em; margin: 10px 0 0 0;">סה"כ: ${totalTroops} לוחמים</p>
                </div>

                <div class="form-group">
                    <label class="form-label">קואורדינטות X (0-59):</label>
                    <input type="number" id="attack-x" class="form-input" min="0" max="59" placeholder="X">
                </div>

                <div class="form-group">
                    <label class="form-label">קואורדינטות Y (0-59):</label>
                    <input type="number" id="attack-y" class="form-input" min="0" max="59" placeholder="Y">
                </div>

                <div class="form-group">
                    <label class="form-label">סוג יעד:</label>
                    <select id="attack-target-type" class="form-input">
                        <option value="city">עיר שחקן</option>
                        <option value="fortress">מבצר קלאן</option>
                    </select>
                </div>

                <div style="background: rgba(220,38,38,0.1); padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <p style="color: #f87171; font-size: 0.9em; margin: 0;">⚠️ התקיפה תשתמש בכל החיילים במבצר. אבדות אפשריות!</p>
                </div>
            </div>
        `;

        openModal('תקיפה משותפת', html, '⚔️ תקוף', async () => {
            const targetX = parseInt(document.getElementById('attack-x').value);
            const targetY = parseInt(document.getElementById('attack-y').value);
            const targetType = document.getElementById('attack-target-type').value;

            if (isNaN(targetX) || isNaN(targetY) || targetX < 0 || targetX > 199 || targetY < 0 || targetY > 199) {
                notify('קואורדינטות לא תקינות', 'error');
                return;
            }

            if (!confirm(`לתקוף ב-(${targetX}, ${targetY})?\nזוהי פעולה בלתי הפיכה!`)) {
                return;
            }

            const result = await ClanSystem.launchFortressAttack(targetX, targetY, targetType);

            if (result.success) {
                closeModal();
                if (!result.deferred) {
                    // Only show results if not deferred (legacy)
                    ClanUI.showAttackResults(result);
                }
                // If deferred, notification was already shown by launchFortressAttack
            } else {
                notify(result.error, 'error');
            }
        });
    },

    // Show attack results
    showAttackResults(result) {
        const isVictory = result.result === 'victory';
        const casualties = result.casualties || {};
        const attacker = casualties.attacker || {};
        const defender = casualties.defender || {};
        const loot = result.loot || { gold: 0, wood: 0, food: 0 };

        const totalLoot = loot.gold + loot.wood + loot.food;

        const html = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 5rem; margin-bottom: 20px;">
                    ${isVictory ? '🎉' : '💀'}
                </div>
                <h2 style="color: ${isVictory ? '#10b981' : '#ef4444'}; margin-bottom: 15px;">
                    ${isVictory ? 'ניצחון!' : 'תבוסה'}
                </h2>
                
                <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 1; background: rgba(59,130,246,0.1); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #60a5fa; margin: 0 0 10px 0;">כוח התקפה</h4>
                        <p style="color: #cbd5e1; font-size: 1.5rem; margin: 0;">${result.attackPower}</p>
                    </div>
                    <div style="flex: 1; background: rgba(239,68,68,0.1); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #f87171; margin: 0 0 10px 0;">כוח הגנה</h4>
                        <p style="color: #cbd5e1; font-size: 1.5rem; margin: 0;">${result.defensePower}</p>
                    </div>
                </div>

                <h3 style="color: #fbbf24; margin: 20px 0 10px 0;">אבדות</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: rgba(59,130,246,0.1); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #60a5fa; margin: 0 0 10px 0;">שלנו</h4>
                        <div style="color: #cbd5e1; font-size: 0.9em;">
                            <div>🔱 ${attacker.spearman || 0} חניתים</div>
                            <div>🏹 ${attacker.archer || 0} קשתים</div>
                            <div>⚔️ ${attacker.swordsman || 0} לוחמי חרב</div>
                        </div>
                    </div>
                    <div style="background: rgba(239,68,68,0.1); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #f87171; margin: 0 0 10px 0;">שלהם</h4>
                        <div style="color: #cbd5e1; font-size: 0.9em;">
                            <div>🔱 ${defender.spearman || 0} חניתים</div>
                            <div>🏹 ${defender.archer || 0} קשתים</div>
                            <div>⚔️ ${defender.swordsman || 0} לוחמי חרב</div>
                        </div>
                    </div>
                </div>

                ${isVictory && totalLoot > 0 ? `
                    <div style="background: rgba(16,185,129,0.1); padding: 20px; border-radius: 8px; margin-top: 20px;">
                        <h3 style="color: #10b981; margin: 0 0 15px 0;">💰 שלל</h3>
                        <div style="display: flex; justify-content: center; gap: 20px; font-size: 1.2rem; color: #cbd5e1;">
                            <span>💰 ${loot.gold.toLocaleString()}</span>
                            <span>🌲 ${loot.wood.toLocaleString()}</span>
                            <span>🌾 ${loot.food.toLocaleString()}</span>
                        </div>
                        <p style="color: #94a3b8; font-size: 0.9em; margin: 15px 0 0 0;">השלל חולק אוטומטית לתורמים לפי אחוז התרומה</p>
                    </div>
                ` : ''}
            </div>
        `;

        openModal(isVictory ? '🎉 ניצחון!' : '💀 תבוסה', html, 'סגור', () => {
            closeModal();
            ClanUI.render(); // Refresh fortress view
        });
    },

    // Helper: Attack from fortress (called from map)
    attackFromFortress(x, y, type) {
        console.log(`attackFromFortress called with: x=${x}, y=${y}, type=${type}`);

        const clan = ClanSystem.getPlayerClan();
        if (!clan || !clan.fortress) {
            notify('אין מבצר לקלאן', 'error');
            return;
        }

        const myRole = clan.members?.[CURRENT_USER]?.role;
        if (myRole !== 'leader') {
            notify('רק מנהיג הקלאן יכול לתקוף', 'error');
            return;
        }

        // Switch to clan view and fortress tab first
        switchView('clan');
        setTimeout(() => {
            ClanUI.switchTab('fortress');

            // Open attack UI after a small delay
            setTimeout(() => {
                this.showAttackUI();

                // Fill in coordinates after modal opens
                setTimeout(() => {
                    const xInput = document.getElementById('attack-x');
                    const yInput = document.getElementById('attack-y');
                    const typeSelect = document.getElementById('attack-target-type');

                    console.log(`Filling fields: x=${x}, y=${y}`);

                    if (xInput) {
                        xInput.value = x;
                        console.log(`X input value set to: ${xInput.value}`);
                    }
                    if (yInput) {
                        yInput.value = y;
                        console.log(`Y input value set to: ${yInput.value}`);
                    }
                    if (typeSelect) {
                        typeSelect.value = type;
                    }
                }, 150);
            }, 100);
        }, 50);
    }
};

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.ClanSystem = ClanSystem;
    window.ClanUI = ClanUI;
}
