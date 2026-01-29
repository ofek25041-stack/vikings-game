// =====================================
// AI ACTIONS IMPLEMENTATION
// =====================================

const http = require('http');
const { generateMessage, shouldSendMessage } = require('./ai_messages');

/**
 * Executes actual game actions based on AI decisions
 */
class AIActions {
    constructor(aiPlayer, serverUrl = 'http://localhost:3000') {
        this.aiPlayer = aiPlayer;
        this.serverUrl = serverUrl;
        this.lastMessages = {}; // Track last message times
    }

    /**
     * Execute an action returned by decision engine
     */
    async executeAction(action, gameState) {
        console.log(`[${this.aiPlayer.username}] Executing: ${action.type}`);

        try {
            switch (action.type) {
                case 'upgrade_town_hall':
                case 'build_missing_essential':
                case 'upgrade_buildings':
                    return await this.buildOrUpgrade(action.data);

                case 'train_minimum_army':
                case 'train_additional_army':
                    return await this.trainTroops(action.data);

                case 'conquer_nearby_territory':
                    return await this.conquerTerritory(gameState);

                case 'attack_weak_player':
                    return await this.attackPlayer(gameState);

                case 'trade_excess_resources':
                    return await this.createTradeOffer(action.data);

                case 'send_random_message':
                    return await this.sendRandomMessage();

                case 'upgrade_conquered_territories':
                    return await this.upgradeterritory(action.data);

                case 'feed_army':
                    return await this.manageResources('food', action.data.needed);

                case 'join_clan_activity':
                    if (action.data.action === 'create') {
                        const name = `Clan of ${this.aiPlayer.username}`;
                        const tag = this.aiPlayer.username.substring(0, 3).toUpperCase();
                        return await this.createClan(name, tag);
                    } else {
                        return await this.joinRandomClan();
                    }

                default:
                    console.log(`[${this.aiPlayer.username}] Unknown action: ${action.type}`);
                    return false;
            }
        } catch (error) {
            console.error(`[${this.aiPlayer.username}] Action error:`, error.message);
            return false;
        }
    }

    /**
     * Build or upgrade a building
     */
    async buildOrUpgrade(data) {
        const { building, nextLevel, cost } = data;

        // Simulate building action by updating user file
        const response = await fetch(`${this.serverUrl}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                state: await this.getUpdatedState(state => {
                    // Deduct resources
                    for (const [resource, amount] of Object.entries(cost)) {
                        state.resources[resource] = (state.resources[resource] || 0) - amount;
                    }

                    // Update building
                    if (!state.buildings[building]) {
                        state.buildings[building] = { level: 1 };
                    } else {
                        state.buildings[building].level = nextLevel;
                    }

                    return state;
                })
            })
        });

        if (response.ok) {
            console.log(`[${this.aiPlayer.username}] Built/upgraded ${building} to level ${nextLevel}`);

            // Send achievement message
            await this.sendAchievement('building', { building, level: nextLevel });
            return true;
        }
        return false;
    }

    /**
     * Train troops
     */
    async trainTroops(data) {
        const { unitType, count, cost } = data;
        const actualCount = Math.min(count, 10); // Train max 10 at a time

        const response = await fetch(`${this.serverUrl}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                state: await this.getUpdatedState(state => {
                    // Deduct resources
                    const totalCost = {};
                    for (const [resource, amount] of Object.entries(cost)) {
                        totalCost[resource] = amount * actualCount;
                        state.resources[resource] = (state.resources[resource] || 0) - totalCost[resource];
                    }

                    // Add troops
                    if (!state.army) state.army = {};
                    state.army[unitType] = (state.army[unitType] || 0) + actualCount;

                    return state;
                })
            })
        });

        if (response.ok) {
            console.log(`[${this.aiPlayer.username}] Trained ${actualCount} ${unitType}`);
            return true;
        }
        return false;
    }

    /**
     * Conquer nearby territory
     */
    async conquerTerritory(gameState) {
        // Find nearby unconquered territory
        const homeX = gameState.homeCoords?.x || 0;
        const homeY = gameState.homeCoords?.y || 0;

        // Simulate finding a territory (in real version, would scan map)
        const targetX = homeX + Math.floor(Math.random() * 40) - 20;
        const targetY = homeY + Math.floor(Math.random() * 40) - 20;

        console.log(`[${this.aiPlayer.username}] Attempting to conquer territory at (${targetX}, ${targetY})`);

        // Send army to conquer
        const army = gameState.army || {};
        const attackForce = {
            spearman: Math.floor((army.spearman || 0) * 0.3),
            archer: Math.floor((army.archer || 0) * 0.3),
            swordsman: Math.floor((army.swordsman || 0) * 0.3)
        };

        // Update state to reflect conquest
        const response = await fetch(`${this.serverUrl}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                state: await this.getUpdatedState(state => {
                    // Add conquered territory to mapEntities
                    if (!state.mapEntities) state.mapEntities = {};
                    const key = `${targetX},${targetY}`;

                    state.mapEntities[key] = {
                        type: Math.random() > 0.5 ? 'field' : 'wood',
                        resource: Math.random() > 0.5 ? 'food' : 'wood',
                        name: Math.random() > 0.5 ? 'שדה חיטה' : 'מחנה חוטבים',
                        owner: this.aiPlayer.username,
                        level: 1,
                        x: targetX,
                        y: targetY,
                        troops: attackForce
                    };

                    return state;
                })
            })
        });

        if (response.ok) {
            await this.sendMessage('territory_conquered', { x: targetX, y: targetY });
            return true;
        }
        return false;
    }

    /**
     * Attack another player
     */
    async attackPlayer(gameState) {
        // Get list of players
        const playersResponse = await fetch(`${this.serverUrl}/api/players`);
        const { players } = await playersResponse.json();

        // Filter valid targets (not self, not too strong)
        const validTargets = players.filter(p =>
            p.username !== this.aiPlayer.username &&
            p.username !== 'Admin' && // Don't attack admin
            (p.buildings?.townHall?.level || 1) <= (gameState.buildings?.townHall?.level || 1) + 2
        );

        if (validTargets.length === 0) {
            console.log(`[${this.aiPlayer.username}] No valid attack targets`);
            return false;
        }

        // Pick random target
        const target = validTargets[Math.floor(Math.random() * validTargets.length)];

        // Determine Troops
        const army = gameState.army || {};
        const attackForce = {
            soldier: Math.max(0, Math.floor((army.soldier || 0) * 0.8)),
            archer: Math.max(0, Math.floor((army.archer || 0) * 0.8)),
            knight: Math.max(0, Math.floor((army.knight || 0) * 0.8)),
            elite: Math.max(0, Math.floor((army.elite || 0) * 0.8))
        };

        // Check if we have enough troops
        const total = Object.values(attackForce).reduce((a, b) => a + b, 0);
        if (total < 5) return false;

        console.log(`[${this.aiPlayer.username}] Attacking ${target.username} with ${total} troops`);

        // Send Server Request
        // Target can be a City (from player profile) or Territory. Here we attack their City.
        const targetX = target.state?.homeCoords?.x;
        const targetY = target.state?.homeCoords?.y;

        if (!targetX || !targetY) return false;

        const response = await fetch(`${this.serverUrl}/api/attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attacker: this.aiPlayer.username,
                targetX: targetX,
                targetY: targetY,
                troops: attackForce
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[${this.aiPlayer.username}] Attack Result: ${result.victory ? 'Victory' : 'Defeat'} (Loot: ${JSON.stringify(result.loot)})`);

            // If victory, maybe send a mocking message
            if (result.victory) {
                await this.sendMessage('victory', { target: target.username });
            } else {
                await this.sendMessage('defeat', { target: target.username });
            }
            return true;
        }

        return false;
    }

    /**
     * Create trade offer
     */
    async createTradeOffer(data) {
        const { offer, request } = data;

        const offerAmount = 5000 + Math.floor(Math.random() * 5000);
        const requestAmount = Math.floor(offerAmount * (0.8 + Math.random() * 0.4)); // 80-120% value

        const response = await fetch(`${this.serverUrl}/api/market/offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller: this.aiPlayer.username,
                offering: { [offer]: offerAmount },
                requesting: { [request]: requestAmount }
            })
        });

        if (response.ok) {
            console.log(`[${this.aiPlayer.username}] Created trade: ${offerAmount} ${offer} for ${requestAmount} ${request}`);
            await this.sendMessage('trade_offer', {});
            return true;
        }
        return false;
    }

    /**
     * Upgrade conquered territory
     */
    async upgradeTerritory(data) {
        const { x, y, cost } = data;

        const response = await fetch(`${this.serverUrl}/api/territory/upgrade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                x,
                y
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[${this.aiPlayer.username}] Upgraded territory at (${x},${y}) to level ${result.newLevel}`);
            return true;
        }
        return false;
    }

    /**
     * Send a message (chat/mail)
     */
    async sendMessage(messageType, context) {
        if (!shouldSendMessage(messageType, this.lastMessages[messageType])) {
            return false;
        }

        const chatStyle = this.aiPlayer.personality === 'aggressive' ? 'threatening' :
            this.aiPlayer.personality === 'economic' ? 'friendly' :
                this.aiPlayer.personality === 'clan' ? 'cooperative' : 'diplomatic';

        const content = generateMessage(messageType, chatStyle, context);
        if (!content) return false;

        // Pick a recipient
        let to = context.target;
        if (!to) {
            // Find a random player online or from recent ranking
            // For now, just spam 'Admin' or random players if we fetch list?
            // Let's spam Random players from 'api/players'
            try {
                const pRes = await fetch(`${this.serverUrl}/api/players`);
                const { players } = await pRes.json();
                if (players && players.length > 0) {
                    const r = players[Math.floor(Math.random() * players.length)];
                    to = r.username;
                }
            } catch (e) { }
        }

        if (!to || to === this.aiPlayer.username) return false; // Don't message self

        console.log(`[${this.aiPlayer.username}] Sending Message to ${to}: ${content}`);

        // Send to Server
        const response = await fetch(`${this.serverUrl}/api/message/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: this.aiPlayer.username,
                to: to,
                subject: 'Message',
                content: content
            })
        });

        this.lastMessages[messageType] = Date.now();
        return response.ok;
    }

    /**
     * Join a Clan (if invited or open)
     */
    async joinClan(clanId) {
        const response = await fetch(`${this.serverUrl}/api/clan/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                clanId: clanId
            })
        });
        if (response.ok) {
            console.log(`[${this.aiPlayer.username}] Joined clan ${clanId}`);
            return true;
        }
        return false;
    }

    /**
     * Create a new Clan
     */
    async createClan(name, tag) {
        const response = await fetch(`${this.serverUrl}/api/clan/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.aiPlayer.username,
                name: name,
                tag: tag
            })
        });
        if (response.ok) {
            console.log(`[${this.aiPlayer.username}] Created clan [${tag}] ${name}`);
            return true;
        }
        return false;
    }

    async sendRandomMessage() {
        return await this.sendMessage('random_chat', {});
    }

    async sendAchievement(type, data) {
        return await this.sendMessage('achievement', data);
    }

    /**
     * Get current game state and apply updates
     */
    async getUpdatedState(updateFn) {
        const response = await fetch(`${this.serverUrl}/api/user/${encodeURIComponent(this.aiPlayer.username)}`);
        const userData = await response.json();
        return updateFn(userData.state);
    }

    /**
     * Manage resources (e.g., get more food)
     */
    async manageResources(resource, needed) {
        console.log(`[${this.aiPlayer.username}] Need ${needed} ${resource}`);
        // Could create trade offers or prioritize resource buildings
        return await this.createTradeOffer({ offer: 'gold', request: resource });
    }

    async joinRandomClan() {
        try {
            const response = await fetch(`${this.serverUrl}/api/clans/rankings`);
            const { rankings } = await response.json();

            if (rankings && rankings.length > 0) {
                // Pick random clan
                const clan = rankings[Math.floor(Math.random() * rankings.length)];
                return await this.joinClan(clan.id);
            }
        } catch (e) {
            console.error(`[${this.aiPlayer.username}] Failed to find clan to join`);
        }
        return false;
    }
}

module.exports = AIActions;
