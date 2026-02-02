const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Use environment PORT for cloud deployment (Render, Heroku, etc.)
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// CACHE STATE (Still useful for read optimization, but we'll refresh from DB)
let WORLD_CACHE = [];
// let CLAN_CACHE = {}; // We might not need this if we query DB, but for speed... we can keep it or drop it.
// Let's drop explicit CLAN_CACHE for simplicity and query DB for lists, or keep it lightweight.
// Actually, keeping strict in-memory cache is dangerous with multiple instances (though likely just 1 here).
// We'll trust the DB for truth.

let db;
let client;

async function connectDB() {
    if (!MONGODB_URI) {
        console.warn("⚠️ MONGODB_URI not set! Running in READ-ONLY mode or failing.");
        return;
    }
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('vikings');
        console.log("✅ Connected to MongoDB");
        // Initial Cache Load
        updateWorldCache();
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
    }
}

// Ensure connection
connectDB();

async function updateWorldCache() {
    if (!db) return;
    try {
        // 1. Get all clans for tagging
        const clans = await db.collection('clans').find({ deleted: { $ne: true } }).toArray();
        const clanMap = {};
        clans.forEach(c => clanMap[c.id] = c);

        // 2. Get all users
        const users = await db.collection('users').find({}).toArray();
        const worldData = [];

        for (const user of users) {
            const s = user.state;
            if (!s || !s.homeCoords) continue;

            let clanTag = null;
            if (s.clan && s.clan.id && clanMap[s.clan.id]) {
                clanTag = clanMap[s.clan.id].tag;
            }

            worldData.push({
                username: user.username,
                x: s.homeCoords.x,
                y: s.homeCoords.y,
                level: (s.buildings && s.buildings.townHall) ? s.buildings.townHall.level : 1,
                score: (s.city && s.city.population) ? s.city.population * 10 : 100,
                lastLogin: s.lastLogin || Date.now(),
                clanTag: clanTag
            });
        }

        // 3. Add Fortresses
        const fortresses = [];
        for (const c of clans) {
            if (c.fortress) {
                fortresses.push({
                    type: 'fortress',
                    clanId: c.id,
                    clanName: c.name,
                    clanTag: c.tag,
                    x: c.fortress.x,
                    y: c.fortress.y
                });
            }
        }

        WORLD_CACHE = worldData.concat(fortresses);

    } catch (err) {
        console.error("Cache update failed:", err);
    }
}

function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
    // Strip query string for file system lookup
    const cleanUrl = req.url.split('?')[0];
    let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);

    // Security: Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';

    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
        case '.jpeg': contentType = 'image/jpeg'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404);
                res.end(`File not found: ${req.url}`);
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // Force No-Cache for development/debugging updates
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

function readBody(req, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const parsed = body ? JSON.parse(body) : {};
            callback(parsed);
        } catch (e) {
            callback({});
        }
    });
}

const server = http.createServer(async (req, res) => {
    // CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    // Safety check for DB
    if (!db && !req.url.startsWith('/api') === false) {
        // Allow static files, but API needs DB
        // But if DB is initializing... well, let's try.
        // If not connected, we fail gracefully or retry.
    }

    if (req.url === '/api/login' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, password } = body;

            try {
                // Find User (Case insensitive for username, but stored as is?)
                // Standard: store lower in separate field or query regex.
                // Let's assume username is key.
                const user = await db.collection('users').findOne({ username: username });

                if (!user) {
                    return sendJSON(res, 404, { success: false, message: 'User not found' });
                }

                if (user.password === password) {
                    sendJSON(res, 200, { success: true, state: user.state, username: user.username });
                } else {
                    sendJSON(res, 401, { success: false, message: 'Incorrect password' });
                }
            } catch (err) {
                console.error("Login Error:", err);
                sendJSON(res, 500, { success: false, message: 'Server error' });
            }
        });
    } else if (req.url === '/api/register' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, password, state } = body;

            try {
                const existing = await db.collection('users').findOne({ username: username });
                if (existing) {
                    return sendJSON(res, 400, { success: false, message: 'Username already taken' });
                }

                const newUser = { username, password, state, createdAt: Date.now() };
                await db.collection('users').insertOne(newUser);

                updateWorldCache(); // Async update
                sendJSON(res, 200, { success: true });
            } catch (err) {
                console.error("Register Error:", err);
                sendJSON(res, 500, { success: false, message: 'Could not create user' });
            }
        });
    } else if (req.url === '/api/save' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, state } = body;
            try {
                const user = await db.collection('users').findOne({ username: username });
                if (!user) {
                    return sendJSON(res, 404, { success: false, message: 'User not found' });
                }

                // Merge Reports
                const existingReports = user.state.reports || [];
                const incomingReports = state.reports || [];
                const reportMap = new Map();
                existingReports.forEach(r => reportMap.set(r.id, r));
                incomingReports.forEach(r => reportMap.set(r.id, r));
                const mergedReports = Array.from(reportMap.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

                // Preserve Server chats
                const serverChats = user.state.chats || {};

                // --- RESOURCE SYNC PROTECTION ---
                // If a trade happened recently (resourcesDirty flag), Server Authority wins for resources.
                let finalResources = state.resources;
                let usedServerResources = false;

                if (user.resourcesDirty) {
                    console.log(`[SYNC] Preserving server resources for ${username} (Dirty Flag)`);
                    finalResources = user.state.resources;
                    usedServerResources = true;
                }

                // Construct updated state
                const newState = {
                    ...state,
                    resources: finalResources,
                    reports: mergedReports,
                    chats: serverChats,
                    lastLogin: Date.now()
                };

                // Update DB (and clear dirty flag)
                await db.collection('users').updateOne(
                    { username: username },
                    {
                        $set: { state: newState },
                        $unset: { resourcesDirty: "" }
                    }
                );

                updateWorldCache();

                sendJSON(res, 200, {
                    success: true,
                    merged: {
                        reports: mergedReports,
                        chats: serverChats
                    },
                    // Return resources if we forced them, so client can sync
                    forceUpdateResources: usedServerResources ? finalResources : null
                });

            } catch (err) {
                console.error("Save Error:", err);
                sendJSON(res, 500, { success: false, message: 'Save failed' });
            }
        });

    } else if (req.url.startsWith('/api/load?') && req.method === 'GET') {
        const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const username = params.get('username');

        try {
            const user = await db.collection('users').findOne({ username: username });
            if (!user) return sendJSON(res, 404, { success: false, message: 'Not found' });
            sendJSON(res, 200, { success: true, data: user });
        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }

    } else if (req.url === '/api/clans' && req.method === 'GET') {
        try {
            const clans = await db.collection('clans').find({ deleted: { $ne: true } }).toArray();
            const clanMap = {};
            clans.forEach(c => clanMap[c.id] = c);
            sendJSON(res, 200, { success: true, clans: clanMap });
        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }

    } else if (req.url === '/api/clans/save' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { clan } = body;
            if (!clan || !clan.id) return sendJSON(res, 400, { error: 'Invalid clan' });

            try {
                await db.collection('clans').updateOne(
                    { id: clan.id },
                    { $set: clan },
                    { upsert: true }
                );
                updateWorldCache();
                sendJSON(res, 200, { success: true });
            } catch (e) {
                sendJSON(res, 500, { error: e.message });
            }
        });

    } else if (req.url === '/api/territories' && req.method === 'GET') {
        try {
            // Aggregate all territories from all users
            // This is heavy for MongoDB without proper schema (embedded), but doable.
            // Ideally territories should have their own collection.
            // For now, scan users.
            const users = await db.collection('users').find({ "state.mapEntities": { $exists: true } }).toArray();
            const allTerritories = {};

            for (const u of users) {
                const ents = u.state.mapEntities;
                for (const [key, ent] of Object.entries(ents)) {
                    if (ent.owner === u.username) {
                        // Conflict logic
                        if (allTerritories[key]) {
                            if ((ent.capturedAt || 0) > (allTerritories[key].capturedAt || 0)) {
                                allTerritories[key] = ent;
                            }
                        } else {
                            allTerritories[key] = ent;
                        }
                    }
                }
            }
            sendJSON(res, 200, { success: true, territories: allTerritories });
        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }

    } else if (req.url === '/api/clan/invite' && req.method === 'POST') {
        readBody(req, async (body) => {
            try {
                const { clanId, targetUser, from } = body;
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                if (clan.members[from]?.role !== 'leader') return sendJSON(res, 403, { error: 'Not leader' });

                // Find target (Case insensitive check would be better)
                // Use regex for case insensitive find
                const target = await db.collection('users').findOne({ username: { $regex: new RegExp(`^${targetUser}$`, 'i') } });

                if (!target) return sendJSON(res, 404, { error: 'User not found' });
                if (target.state.clan) return sendJSON(res, 400, { error: 'User already in clan' });

                // Add report
                const report = {
                    id: Date.now().toString(),
                    type: 'clan_invite',
                    title: `הזמנה לקלאן ${clan.name}`,
                    from, clanId,
                    data: { clanId, clanName: clan.name, clanTag: clan.tag },
                    read: false,
                    timestamp: Date.now()
                };

                await db.collection('users').updateOne(
                    { _id: target._id },
                    { $push: { "state.reports": { $each: [report], $position: 0, $slice: 50 } } }
                );

                sendJSON(res, 200, { success: true });
            } catch (e) {
                sendJSON(res, 500, { error: e.message });
            }
        });

    } else if (req.url === '/api/clan/join' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, clanId } = body;
            try {
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                const user = await db.collection('users').findOne({ username: username });
                if (!user) return sendJSON(res, 404, { error: 'User not found' });
                if (user.state.clan) return sendJSON(res, 400, { error: 'Already in clan' });

                // Recruitment Logic Check
                const recruitmentType = (clan.recruitment && clan.recruitment.type) ? clan.recruitment.type : 'closed';

                // If Open -> Allow
                // If Request/Closed -> Check for existing invitation (how? existing logic relied on logic elsewhere or just open join?)
                // Actually, existing logic IS "Accept Invite" from UI which calls this.
                // BUT, we want to allow "Open" clans to be joined WITHOUT invitation.

                // We need to differentiate between "Accept Invite" calling this, and "Direct Join".
                // In both cases, if the user HAS an invite (not tracked on server easily besides reports?), they can join.
                // But wait, the standard invites are client-side or just messages? 
                // Server code doesn't track active invites in Clan object.
                // So `/api/clan/join` currently implies "I have permission or system lets me".

                // NEW LOGIC:
                // 1. If 'open' -> Success.
                // 2. If 'closed'/'request' -> Security risk? Anyone can call API?
                //    We need a way to verify "Invited".
                //    For now, we trust the Client if it's an "Accept Invite" flow (which might be weak security but acceptable for prototype).
                //    OR we assume this endpoint is ONLY for "Open" joining or "Accepting Invite".

                // Let's refine:
                // If logic passed strictly 'open', we allow.
                // If logic passed 'invite_token' or similar? No.

                // Compormise for this iteration:
                // We will trust the caller. BUT we should enforce 'open' check if we want true rules.
                // However, `mailbox.js` calls this when accepting an invite. 
                // So if we block it for 'closed' clans, invites stop working unless we pass a flag "isInvite=true".

                if (recruitmentType !== 'open' && !body.isInvite) {
                    return sendJSON(res, 403, { error: 'Clan is not open' });
                }

                // Update Clan
                clan.members[username] = { role: 'member', joinedAt: Date.now() };

                // Remove from requests if present
                if (clan.recruitment && clan.recruitment.requests) {
                    clan.recruitment.requests = clan.recruitment.requests.filter(r => r.username !== username);
                }

                await db.collection('clans').updateOne({ id: clanId }, {
                    $set: { members: clan.members, "recruitment.requests": clan.recruitment ? clan.recruitment.requests : [] }
                });

                // Update User
                const clanRef = { id: clanId, name: clan.name, tag: clan.tag };
                await db.collection('users').updateOne({ username: username }, { $set: { "state.clan": clanRef } });

                updateWorldCache();
                sendJSON(res, 200, { success: true, clan: clan });

            } catch (e) {
                sendJSON(res, 500, { error: e.message });
            }
        });

    } else if (req.url === '/api/clan/create' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, name, tag } = body;
            try {
                const user = await db.collection('users').findOne({ username: username }); // assume verified by token in real app
                if (!user) return sendJSON(res, 404, { error: 'User not found' });
                if (user.state.clan) return sendJSON(res, 400, { error: 'Already in clan' });

                // Check uniqueness
                const exists = await db.collection('clans').findOne({ $or: [{ name }, { tag }] });
                if (exists) return sendJSON(res, 400, { error: 'Name/Tag taken' });

                const clanId = 'clan_' + Date.now();
                const newClan = {
                    id: clanId,
                    name, tag,
                    members: { [username]: { role: 'leader', joinedAt: Date.now() } },
                    treasury: { gold: 0, wood: 0 },
                    fortress: { level: 1, hp: 10000, attacks: [] },
                    recruitment: { type: 'closed', requests: [] },
                    createdAt: Date.now()
                };

                await db.collection('clans').insertOne(newClan);
                await db.collection('users').updateOne(
                    { username },
                    { $set: { "state.clan": { id: clanId, name, tag } } }
                );

                updateWorldCache();
                sendJSON(res, 200, { success: true, clan: newClan });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/clan/distribute' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { actionBy, target, resources } = body;
            try {
                // 1. Get Clan
                // In real app, we check if actionBy is legit, skipping extensive role checks for brevity if trusted
                // But better to be safe
                const actor = await db.collection('users').findOne({ username: actionBy });
                if (!actor || !actor.state.clan) return sendJSON(res, 403, { error: 'Not in clan' });

                const clanId = actor.state.clan.id;
                const clan = await db.collection('clans').findOne({ id: clanId });

                if (clan.members[actionBy].role !== 'leader' && clan.members[actionBy].role !== 'officer') {
                    return sendJSON(res, 403, { error: 'No permission' });
                }

                // Check Treasury
                for (const [r, amt] of Object.entries(resources)) {
                    if ((clan.treasury[r] || 0) < amt) return sendJSON(res, 400, { error: 'Insufficient funds' });
                }

                // Exec Transfer
                // 1. Deduct Clan
                const inc = {};
                const userInc = {};
                for (const [r, amt] of Object.entries(resources)) {
                    if (amt > 0) {
                        inc[`treasury.${r}`] = -amt;
                        userInc[`state.resources.${r}`] = amt;
                    }
                }

                await db.collection('clans').updateOne({ id: clanId }, { $inc: inc });

                // 2. Add to User
                await db.collection('users').updateOne({ username: target }, { $inc: userInc });

                // Return updated treasury
                const updatedClan = await db.collection('clans').findOne({ id: clanId });
                sendJSON(res, 200, { success: true, treasury: updatedClan.treasury });

            } catch (e) {
                sendJSON(res, 500, { error: e.message });
            }
        });

    } else if (req.url === '/api/clan/settings' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { clanId, username, recruitmentType } = body;
            try {
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                if (clan.members[username]?.role !== 'leader') return sendJSON(res, 403, { error: 'Not leader' });

                if (!['open', 'request', 'closed'].includes(recruitmentType)) {
                    return sendJSON(res, 400, { error: 'Invalid type' });
                }

                // Init if missing
                if (!clan.recruitment) clan.recruitment = { requests: [] };

                clan.recruitment.type = recruitmentType;

                await db.collection('clans').updateOne({ id: clanId }, { $set: { recruitment: clan.recruitment } });
                sendJSON(res, 200, { success: true });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/clan/apply' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { clanId, username } = body;
            try {
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                const rType = clan.recruitment?.type || 'closed';
                if (rType !== 'request') return sendJSON(res, 400, { error: 'Clan does not accept applications' });

                // Check if already applied
                const requests = clan.recruitment.requests || [];
                if (requests.find(r => r.username === username)) return sendJSON(res, 400, { error: 'Already applied' });

                const newRequest = { username, timestamp: Date.now() };
                await db.collection('clans').updateOne({ id: clanId }, {
                    $push: { "recruitment.requests": newRequest }
                });

                sendJSON(res, 200, { success: true });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/clan/handle_request' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { clanId, actionBy, targetUser, action } = body; // action: 'accept' | 'reject'
            try {
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                if (clan.members[actionBy]?.role !== 'leader' && clan.members[actionBy]?.role !== 'officer') {
                    return sendJSON(res, 403, { error: 'Permission denied' });
                }

                // Always remove from requests
                await db.collection('clans').updateOne({ id: clanId }, {
                    $pull: { "recruitment.requests": { username: targetUser } }
                });

                if (action === 'accept') {
                    // Check if already in clan (double check)
                    const user = await db.collection('users').findOne({ username: targetUser });
                    if (user.state.clan) return sendJSON(res, 400, { error: 'User already in a clan' });

                    // Add to members
                    const updates = {};
                    updates[`members.${targetUser}`] = { role: 'member', joinedAt: Date.now() };

                    await db.collection('clans').updateOne({ id: clanId }, { $set: updates });

                    // Update User
                    const clanRef = { id: clanId, name: clan.name, tag: clan.tag };
                    await db.collection('users').updateOne({ username: targetUser }, { $set: { "state.clan": clanRef } });
                }

                sendJSON(res, 200, { success: true });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/player/teleport' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { username, targetX, targetY } = body;
            const COST = 50000;
            const RESOURCES = ['gold', 'wood', 'food', 'wine', 'iron'];
            const COOLDOWN_DAYS = 7;
            const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

            try {
                const user = await db.collection('users').findOne({ username });
                if (!user) return sendJSON(res, 404, { error: 'User not found' });

                // 1. Check Cooldown
                const lastTeleport = user.lastTeleport || 0;
                const now = Date.now();
                if (now - lastTeleport < COOLDOWN_MS) {
                    const daysLeft = Math.ceil((COOLDOWN_MS - (now - lastTeleport)) / (24 * 60 * 60 * 1000));
                    return sendJSON(res, 400, { error: `Teleport is on cooldown. Try again in ${daysLeft} days.` });
                }

                // 2. Check Resources
                const userRes = user.state.resources || {};
                for (const r of RESOURCES) {
                    if ((userRes[r] || 0) < COST) {
                        return sendJSON(res, 400, { error: `Insufficient ${r}. Need ${COST}.` });
                    }
                }

                // 3. Check Target Location (Collision)
                // Need to check against ALL users and Fortresses in WORLD_CACHE (or DB for strictness)
                // DB is better.
                const collisionUser = await db.collection('users').findOne({ "state.homeCoords.x": targetX, "state.homeCoords.y": targetY });
                if (collisionUser) return sendJSON(res, 400, { error: 'Location occupied by a city.' });

                // Check fortresses (iterate clans)
                const collisionClan = await db.collection('clans').findOne({ "fortress.x": targetX, "fortress.y": targetY });
                if (collisionClan) return sendJSON(res, 400, { error: 'Location occupied by a fortress.' });

                // 4. Execute
                const updates = {};
                updates['state.homeCoords.x'] = targetX;
                updates['state.homeCoords.y'] = targetY;
                updates['lastTeleport'] = now;

                // Deduct resources
                for (const r of RESOURCES) {
                    updates[`state.resources.${r}`] = (userRes[r] || 0) - COST;
                }

                await db.collection('users').updateOne({ username }, { $set: updates });

                // Update Cache
                updateWorldCache();

                sendJSON(res, 200, { success: true });

            } catch (e) {
                sendJSON(res, 500, { error: e.message });
            }
        });

    } else if (req.url === '/api/clan/chat' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { clanId, sender, text } = body;
            try {
                // Validate membership is optional for speed, but good practice
                // For now, assume client checks. Or quick DB check:
                const clan = await db.collection('clans').findOne({ id: clanId });
                if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

                // Allow "system" messages
                if (sender !== 'system' && !clan.members[sender]) {
                    return sendJSON(res, 403, { error: 'Not a member' });
                }

                const message = {
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    sender, text, timestamp: Date.now()
                };

                // Atomically push and slice to keep last 50
                // MongoDB 4.4+ supports $slice in update? Yes, $push with $slice.
                await db.collection('clans').updateOne({ id: clanId }, {
                    $push: {
                        messages: {
                            $each: [message],
                            $slice: -50
                        }
                    },
                    $set: { lastActivity: Date.now() }
                });

                sendJSON(res, 200, { success: true, message });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url.startsWith('/api/clan/data') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const clanId = urlParams.get('id');

        if (!clanId) return sendJSON(res, 400, { error: 'Missing clanId' });

        try {
            const clan = await db.collection('clans').findOne({ id: clanId });
            if (!clan) return sendJSON(res, 404, { error: 'Clan not found' });

            sendJSON(res, 200, { success: true, clan });
        } catch (e) { sendJSON(res, 500, { error: e.message }); }

    } else if (req.url === '/api/world' && req.method === 'GET') {
        sendJSON(res, 200, { success: true, players: WORLD_CACHE, fortresses: [] });

    } else if (req.url === '/api/players' && req.method === 'GET') {
        try {
            const profiles = await db.collection('users').find({}, {
                projection: { username: 1, "state.buildings": 1, "state.army": 1, "state.research": 1, "state.stats": 1, "state.mapEntities": 1 }
            }).toArray();

            // Remap to flatten structure for client if needed, or client handles nesting?
            // Client expects { username, buildings:..., army:... }
            const mapped = profiles.map(p => ({
                username: p.username,
                buildings: p.state?.buildings || {},
                army: p.state?.army || {},
                research: p.state?.research || {},
                stats: p.state?.stats || {},
                mapEntities: p.state?.mapEntities || {}
            }));
            sendJSON(res, 200, { players: mapped });
        } catch (e) { sendJSON(res, 500, { error: e.message }); }

    } else if (req.url === '/api/market/offer' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { seller, offering, requesting } = body;
            try {
                // Deduct from seller
                const sellerUser = await db.collection('users').findOne({ username: seller });

                // VALIDATION: Check resources
                for (const [r, amt] of Object.entries(offering)) {
                    const validAmt = parseInt(amt) || 0; // Hardening
                    if ((sellerUser.state.resources[r] || 0) < validAmt) {
                        return sendJSON(res, 400, { success: false, message: `Not enough ${r}` });
                    }
                }

                const dec = {};
                for (const [r, amt] of Object.entries(offering)) {
                    dec[`state.resources.${r}`] = -Math.abs(parseInt(amt) || 0);
                }

                await db.collection('users').updateOne({ username: seller }, {
                    $inc: dec,
                    $set: { resourcesDirty: true }
                });

                // Fetch updated state to return to client
                const updatedSeller = await db.collection('users').findOne({ username: seller });

                // Create Trade
                const trade = {
                    id: 'trade_' + Date.now(),
                    seller,
                    offering, // We keep original object, but we validated it
                    requesting,
                    status: 'active',
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 86400000
                };
                await db.collection('trades').insertOne(trade);

                console.log(`[MARKET] Trade created: ${trade.id} by ${seller}`);
                sendJSON(res, 200, { success: true, trade, updatedResources: updatedSeller.state.resources });

            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/market/offers' && req.method === 'GET') {
        try {
            const offers = await db.collection('trades').find({ status: 'active', expiresAt: { $gt: Date.now() } }).toArray();
            sendJSON(res, 200, { success: true, offers });
        } catch (e) { sendJSON(res, 500, { error: e.message }); }

    } else if (req.url === '/api/market/accept' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { tradeId, buyer } = body;
            try {
                const trade = await db.collection('trades').findOne({ id: tradeId, status: 'active' });
                if (!trade) return sendJSON(res, 404, { error: 'Trade not valid' });

                const buyerUser = await db.collection('users').findOne({ username: buyer });

                // VALIDATION: Check Buyer Resources
                for (const [r, amt] of Object.entries(trade.requesting)) {
                    const validAmt = parseInt(amt) || 0;
                    if ((buyerUser.state.resources[r] || 0) < validAmt) {
                        return sendJSON(res, 400, { success: false, message: `Not enough ${r}` });
                    }
                }

                // Execute
                // Buyer pays Requesting, gets Offering
                const buyerInc = {};
                for (const [r, amt] of Object.entries(trade.requesting)) buyerInc[`state.resources.${r}`] = -Math.abs(parseInt(amt) || 0);
                for (const [r, amt] of Object.entries(trade.offering)) buyerInc[`state.resources.${r}`] = Math.abs(parseInt(amt) || 0);

                await db.collection('users').updateOne({ username: buyer }, {
                    $inc: buyerInc,
                    $set: { resourcesDirty: true }
                });

                // Seller gets Requesting
                const sellerInc = {};
                for (const [r, amt] of Object.entries(trade.requesting)) sellerInc[`state.resources.${r}`] = Math.abs(parseInt(amt) || 0);

                await db.collection('users').updateOne({ username: trade.seller }, {
                    $inc: sellerInc,
                    $set: { resourcesDirty: true }
                });

                await db.collection('trades').updateOne({ id: tradeId }, { $set: { status: 'completed', acceptedBy: buyer } });

                // Fetch Updated Buyer State
                const updatedBuyer = await db.collection('users').findOne({ username: buyer });

                sendJSON(res, 200, { success: true, trade: { ...trade, status: 'completed' }, updatedResources: updatedBuyer.state.resources });

            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });

    } else if (req.url === '/api/message/send' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { to, subject, content, from } = body;
            if (!to || !content || !from) return sendJSON(res, 400, { success: false, message: 'Missing fields' });

            try {
                // Find Users (Case insensitive for target)
                const targetUser = await db.collection('users').findOne({ username: { $regex: new RegExp(`^${to}$`, 'i') } });
                const senderUser = await db.collection('users').findOne({ username: from });

                if (!targetUser) return sendJSON(res, 404, { success: false, message: 'משתמש לא נמצא' });
                if (!senderUser) return sendJSON(res, 404, { success: false, message: 'שגיאה בזיהוי השולח' });

                // Create Message
                const msg = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    from: senderUser.username,
                    to: targetUser.username,
                    timestamp: Date.now(),
                    content: content,
                    read: false
                };

                // Add to Sender History
                await db.collection('users').updateOne(
                    { username: from },
                    { $push: { [`state.chats.${targetUser.username}`]: { $each: [msg], $slice: -50 } } }
                );

                // Add to Recipient History
                await db.collection('users').updateOne(
                    { username: targetUser.username },
                    { $push: { [`state.chats.${senderUser.username}`]: { $each: [msg], $slice: -50 } } }
                );

                sendJSON(res, 200, { success: true, message: msg });

            } catch (e) {
                console.error("Message Error:", e);
                sendJSON(res, 500, { success: false, message: 'שגיאה בשליחת הודעה' });
            }
        });

    } else if (req.url.startsWith('/api/market/history/') && req.method === 'GET') {
        try {
            const username = decodeURIComponent(req.url.split('/api/market/history/')[1]);
            const history = await db.collection('trades').find({
                $or: [{ seller: username }, { acceptedBy: username }]
            }).sort({ createdAt: -1 }).limit(50).toArray();

            sendJSON(res, 200, { success: true, history });
        } catch (e) { sendJSON(res, 500, { error: e.message }); }

    } else if (req.url === '/api/market/cancel' && req.method === 'POST') {
        readBody(req, async (body) => {
            const { tradeId, username } = body;
            try {
                const trade = await db.collection('trades').findOne({ id: tradeId });
                if (!trade) return sendJSON(res, 404, { error: 'Trade not found' });
                if (trade.seller !== username) return sendJSON(res, 403, { error: 'Not your trade' });
                if (trade.status !== 'active') return sendJSON(res, 400, { error: 'Not active' });

                // Refund
                const inc = {};
                for (const [r, amt] of Object.entries(trade.offering)) inc[`state.resources.${r}`] = amt;

                await db.collection('users').updateOne({ username }, {
                    $inc: inc,
                    $set: { resourcesDirty: true }
                });
                await db.collection('trades').updateOne({ id: tradeId }, { $set: { status: 'cancelled', cancelledAt: Date.now() } });

                // Fetch Updated State
                const updatedUser = await db.collection('users').findOne({ username: username });

                sendJSON(res, 200, { success: true, trade: { ...trade, status: 'cancelled' }, updatedResources: updatedUser.state.resources });
            } catch (e) { sendJSON(res, 500, { error: e.message }); }
        });
    } else if (req.url === '/api/fortress/create' && req.method === 'POST') {
        // Create fortress for clan
        readBody(req, async (body) => {
            try {
                const { clanId, x, y } = body;
                const clan = await db.collection('clans').findOne({ id: clanId });

                if (!clan) return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                if (clan.fortress) return sendJSON(res, 400, { success: false, message: 'Fortress already exists' });

                // Create fortress object
                const fortress = {
                    x: x,
                    y: y,
                    level: 1,
                    hp: 5000,
                    maxHp: 5000,
                    garrison: {},
                    deposits: {},
                    createdAt: Date.now()
                };

                await db.collection('clans').updateOne({ id: clanId }, { $set: { fortress: fortress } });
                updateWorldCache();

                sendJSON(res, 200, { success: true, fortress: fortress });
            } catch (err) {
                console.error('Error creating fortress:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/fortress/update' && req.method === 'POST') {
        // Update fortress (deploy/withdraw troops/resources)
        readBody(req, async (body) => {
            try {
                const { clanId, action, data } = body;
                const clan = await db.collection('clans').findOne({ id: clanId });

                if (!clan) return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                if (!clan.fortress) return sendJSON(res, 400, { success: false, message: 'No fortress' });

                const updates = {};

                // Initialize checks if missing
                if (!clan.fortress.deposits) clan.fortress.deposits = {};
                if (!clan.fortress.garrison) clan.fortress.garrison = {};

                if (action === 'deploy_troops' && data.troops && data.username) {
                    for (const [type, count] of Object.entries(data.troops)) {
                        updates[`fortress.garrison.${type}`] = (clan.fortress.garrison[type] || 0) + count;
                        updates[`fortress.deposits.${data.username}.${type}`] = (clan.fortress.deposits?.[data.username]?.[type] || 0) + count;
                    }
                    await db.collection('clans').updateOne({ id: clanId }, { $set: updates });
                }
                // Let's do memory-edit-save pattern for complex nested updates as it's safer for logic preservation for now.

                // Reload clan fully to be safe on state
                // Actually we already have it.
                // Let's just implement the logic:
                if (action === 'withdraw_troops') {
                    const pDeps = clan.fortress.deposits[data.username] || {};
                    for (const [t, c] of Object.entries(data.troops)) {
                        if ((pDeps[t] || 0) < c) return sendJSON(res, 400, { error: 'Not enough deposited' });
                        clan.fortress.garrison[t] = Math.max(0, (clan.fortress.garrison[t] || 0) - c);
                        clan.fortress.deposits[data.username][t] -= c;
                    }
                    await db.collection('clans').updateOne({ id: clanId }, { $set: { fortress: clan.fortress } });
                }

                if (action === 'add_resources') {
                    // This involves deducting from USER and adding to CLAN FORTRESS? 
                    // No, usually treasury. But Fortress might have its own storage? 
                    // The code said "fortress.resources".
                    if (!clan.fortress.resources) clan.fortress.resources = {};
                    const userInc = {};

                    // Verify user funds
                    const user = await db.collection('users').findOne({ username: data.username });
                    for (const [r, amt] of Object.entries(data.resources)) {
                        if ((user.state.resources[r] || 0) < amt) return sendJSON(res, 400, { error: 'Not enough resources' });
                        userInc[`state.resources.${r}`] = -amt;
                        clan.fortress.resources[r] = (clan.fortress.resources[r] || 0) + amt;
                    }

                    await db.collection('users').updateOne({ username: data.username }, { $inc: userInc });
                    await db.collection('clans').updateOne({ id: clanId }, { $set: { fortress: clan.fortress } });
                }

                sendJSON(res, 200, { success: true, fortress: clan.fortress });

            } catch (err) {
                console.error('Error updating fortress:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else {
        serveStatic(req, res);
    }
});

server.listen(PORT, () => {
    console.log(`Vikings DB Server running at http://localhost:${PORT}`);
    console.log(`[v1.1.1] Connecting to MongoDB... (Restarted at: ${new Date().toLocaleTimeString()})`);
});
