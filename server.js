const http = require('http');
const fs = require('fs');
const path = require('path');

// Use environment PORT for cloud deployment (Render, Heroku, etc.)
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data', 'users');
const CLAN_DIR = path.join(__dirname, 'data', 'clans');
const TRADE_DIR = path.join(__dirname, 'data', 'trades');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CLAN_DIR)) fs.mkdirSync(CLAN_DIR, { recursive: true });
if (!fs.existsSync(TRADE_DIR)) fs.mkdirSync(TRADE_DIR, { recursive: true });

// CACHE STATE
let WORLD_CACHE = [];
let CLAN_CACHE = {};
let FORTRESS_CACHE = []; // Map: clanId -> clanData
let LAST_CACHE_UPDATE = 0;

function updateWorldCache() {
    try {
        // 1. Load Clans (FIRST)
        const clanFiles = fs.readdirSync(CLAN_DIR);
        const clanData = {};
        for (const file of clanFiles) {
            if (!file.endsWith('.json')) continue;
            try {
                const content = fs.readFileSync(path.join(CLAN_DIR, file), 'utf8');
                const clan = JSON.parse(content);
                if (clan.id && !clan.deleted) clanData[clan.id] = clan;
            } catch (err) { console.error(`Error reading clan ${file}:`, err.message); }
        }
        CLAN_CACHE = clanData;

        // 2. Load Users
        const files = fs.readdirSync(DATA_DIR);
        const worldData = [];
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
                const userData = JSON.parse(content);
                const s = userData.state; // Access nested state

                // Skip if no state or no home coordinates
                if (!s || !s.homeCoords) continue;

                // Resolve Tag
                let clanTag = null;
                if (s.clan && s.clan.id && CLAN_CACHE[s.clan.id]) {
                    clanTag = CLAN_CACHE[s.clan.id].tag;
                }

                worldData.push({
                    username: userData.username,
                    x: s.homeCoords.x,
                    y: s.homeCoords.y,
                    level: (s.buildings && s.buildings.townHall) ? s.buildings.townHall.level : 1,
                    score: (s.city && s.city.population) ? s.city.population * 10 : 100,
                    lastLogin: s.lastLogin || Date.now(),
                    clanTag: clanTag
                });
            } catch (err) {
                console.error(`Error reading ${file}:`, err.message);
            }
        }

        // 3. Add Clan Fortresses
        const fortresses = [];
        for (const clanId in CLAN_CACHE) {
            const clan = CLAN_CACHE[clanId];
            if (clan.fortress) {
                fortresses.push({
                    type: 'fortress',
                    clanId: clan.id,
                    clanName: clan.name,
                    clanTag: clan.tag,
                    x: clan.fortress.x,
                    y: clan.fortress.y
                });
            }
        }

        WORLD_CACHE = worldData.concat(fortresses);
        FORTRESS_CACHE = fortresses;
        LAST_CACHE_UPDATE = Date.now();

    } catch (err) {
        console.error("Failed to update cache:", err);
    }
}

// Initial update
updateWorldCache();


// Helpers
function getUserFilePath(username) {
    // Sanitize username to prevent directory traversal
    const safeName = username.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(DATA_DIR, `${safeName}.json`);
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

const server = http.createServer((req, res) => {
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

    if (req.url === '/api/login' && req.method === 'POST') {
        readBody(req, (body) => {
            const { username, password } = body;
            const filePath = getUserFilePath(username);

            if (!fs.existsSync(filePath)) {
                return sendJSON(res, 404, { success: false, message: 'User not found' });
            }

            try {
                const fileData = fs.readFileSync(filePath, 'utf8');
                const userData = JSON.parse(fileData);

                if (userData.password === password) {
                    sendJSON(res, 200, { success: true, state: userData.state, username: userData.username });
                } else {
                    sendJSON(res, 401, { success: false, message: 'Incorrect password' });
                }
            } catch (err) {
                console.error("Login Error:", err);
                sendJSON(res, 500, { success: false, message: 'Server error' });
            }
        });
    } else if (req.url === '/api/fortress/create' && req.method === 'POST') {
        // Create fortress for clan
        readBody(req, (body) => {
            try {
                const { clanId, x, y } = body;
                const clanPath = path.join(CLAN_DIR, `${clanId}.json`);

                if (!fs.existsSync(clanPath)) {
                    return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                }

                const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                if (clan.fortress) {
                    return sendJSON(res, 400, { success: false, message: 'Fortress already exists' });
                }

                // Create fortress
                clan.fortress = {
                    x: x,
                    y: y,
                    level: 1,
                    hp: 5000,
                    maxHp: 5000,
                    garrison: {},
                    deposits: {},
                    createdAt: Date.now()
                };

                fs.writeFileSync(clanPath, JSON.stringify(clan, null, 2));
                updateWorldCache();

                sendJSON(res, 200, { success: true, fortress: clan.fortress });
            } catch (err) {
                console.error('Error creating fortress:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/fortress/update' && req.method === 'POST') {
        // Update fortress (deploy/withdraw troops/resources)
        readBody(req, (body) => {
            try {
                const { clanId, action, data } = body;
                const clanPath = path.join(CLAN_DIR, `${clanId}.json`);

                if (!fs.existsSync(clanPath)) {
                    return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                }

                const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                if (!clan.fortress) {
                    return sendJSON(res, 400, { success: false, message: 'No fortress' });
                }

                // Initialize deposits tracking if not exists
                if (!clan.fortress.deposits) {
                    clan.fortress.deposits = {};
                }

                // Apply update based on action
                if (action === 'deploy_troops' && data.troops && data.username) {
                    // Track per-player deposits
                    if (!clan.fortress.deposits[data.username]) {
                        clan.fortress.deposits[data.username] = { spearman: 0, archer: 0, swordsman: 0 };
                    }

                    for (const type in data.troops) {
                        if (!clan.fortress.garrison) clan.fortress.garrison = {};
                        clan.fortress.garrison[type] = (clan.fortress.garrison[type] || 0) + data.troops[type];
                        clan.fortress.deposits[data.username][type] = (clan.fortress.deposits[data.username][type] || 0) + data.troops[type];
                    }
                }

                if (action === 'withdraw_troops' && data.troops && data.username) {
                    // Validate player has deposited enough
                    const playerDeposits = clan.fortress.deposits[data.username] || {};

                    for (const type in data.troops) {
                        if (data.troops[type] > 0) {
                            if (!playerDeposits[type] || playerDeposits[type] < data.troops[type]) {
                                return sendJSON(res, 400, {
                                    success: false,
                                    message: `Not enough ${type} deposited by player`
                                });
                            }
                        }
                    }

                    // Deduct from fortress and player deposits
                    for (const type in data.troops) {
                        if (!clan.fortress.garrison) clan.fortress.garrison = {};
                        clan.fortress.garrison[type] = Math.max(0, (clan.fortress.garrison[type] || 0) - data.troops[type]);
                        if (clan.fortress.garrison[type] <= 0) delete clan.fortress.garrison[type];
                        clan.fortress.deposits[data.username][type] = Math.max(0, (clan.fortress.deposits[data.username][type] || 0) - data.troops[type]);
                    }
                }

                if (action === 'add_resources' && data.resources) {
                    const filePath = getUserFilePath(data.username);
                    if (!fs.existsSync(filePath)) {
                        return sendJSON(res, 404, { success: false, message: 'User not found' });
                    }
                    const user = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                    for (const resType in data.resources) {
                        const amount = data.resources[resType];
                        // Validate user has enough
                        if (!user.state.resources || (user.state.resources[resType] || 0) < amount) {
                            return sendJSON(res, 400, { success: false, message: `Not enough ${resType}` });
                        }
                        // Deduct from user
                        user.state.resources[resType] -= amount;
                        // Add to fortress
                        clan.fortress.resources[resType] = (clan.fortress.resources[resType] || 0) + amount;
                    }
                    // Save user state
                    fs.writeFileSync(filePath, JSON.stringify(user, null, 2));
                }

                fs.writeFileSync(clanPath, JSON.stringify(clan, null, 2));
                updateWorldCache();

                sendJSON(res, 200, { success: true, fortress: clan.fortress });
            } catch (err) {
                console.error('Error updating fortress:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/fortress/attack' && req.method === 'POST') {
        // Launch joint attack from fortress (leader only)
        readBody(req, (body) => {
            try {
                const { clanId, targetX, targetY, attackerUsername, targetType } = body;
                const clanPath = path.join(CLAN_DIR, `${clanId}.json`);

                if (!fs.existsSync(clanPath)) {
                    return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                }

                const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                // Validate leader
                if (clan.members[attackerUsername]?.role !== 'leader') {
                    return sendJSON(res, 403, { success: false, message: 'Only leader can launch attacks' });
                }

                if (!clan.fortress || !clan.fortress.troops) {
                    return sendJSON(res, 400, { success: false, message: 'No fortress or troops' });
                }

                // Calculate attacker power
                const attackerTroops = clan.fortress.troops;
                const attackPower = (attackerTroops.spearman || 0) * 10 +
                    (attackerTroops.archer || 0) * 15 +
                    (attackerTroops.swordsman || 0) * 20;

                if (attackPower === 0) {
                    return sendJSON(res, 400, { success: false, message: 'No troops in fortress' });
                }

                // Fetch target data
                let targetData = null;
                let defensePower = 0;
                let targetResources = { gold: 0, wood: 0, food: 0 };
                let targetName = 'Unknown';

                if (targetType === 'city') {
                    // Find player city at coordinates
                    const files = fs.readdirSync(DATA_DIR);
                    for (const file of files) {
                        if (!file.endsWith('.json')) continue;
                        try {
                            const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
                            const userData = JSON.parse(content);
                            const state = userData.state;

                            if (state && state.homeCoords &&
                                state.homeCoords.x === targetX &&
                                state.homeCoords.y === targetY) {
                                targetData = { userData, state, filePath: path.join(DATA_DIR, file) };
                                targetName = userData.username + "'s City";

                                // Calculate defense from army and wall
                                const defArmy = state.army || {};
                                defensePower = (defArmy.spearman || 0) * 10 +
                                    (defArmy.archer || 0) * 15 +
                                    (defArmy.swordsman || 0) * 20;

                                const wallBonus = (state.buildings?.wall?.level || 0) * 50;
                                defensePower += wallBonus;

                                // Available resources (can steal up to 30%)
                                const res = state.resources || {};
                                targetResources = {
                                    gold: Math.floor((res.gold || 0) * 0.3),
                                    wood: Math.floor((res.wood || 0) * 0.3),
                                    food: Math.floor((res.food || 0) * 0.3)
                                };
                                break;
                            }
                        } catch (err) {
                            // Skip invalid files
                        }
                    }
                } else if (targetType === 'fortress') {
                    // Find fortress at coordinates
                    for (const clanFile of fs.readdirSync(CLAN_DIR)) {
                        if (!clanFile.endsWith('.json')) continue;
                        try {
                            const targetClan = JSON.parse(fs.readFileSync(path.join(CLAN_DIR, clanFile), 'utf8'));
                            if (targetClan.fortress &&
                                targetClan.fortress.x === targetX &&
                                targetClan.fortress.y === targetY) {
                                targetData = { clan: targetClan, filePath: path.join(CLAN_DIR, clanFile) };
                                targetName = targetClan.name + " Fortress";

                                const defTroops = targetClan.fortress.troops || {};
                                defensePower = (defTroops.spearman || 0) * 10 +
                                    (defTroops.archer || 0) * 15 +
                                    (defTroops.swordsman || 0) * 20;

                                // Can steal from clan treasury (20%)
                                const treasury = targetClan.treasury || {};
                                targetResources = {
                                    gold: Math.floor((treasury.gold || 0) * 0.2),
                                    wood: Math.floor((treasury.wood || 0) * 0.2),
                                    food: Math.floor((treasury.food || 0) * 0.2)
                                };
                                break;
                            }
                        } catch (err) {
                            // Skip invalid files
                        }
                    }
                }

                if (!targetData) {
                    return sendJSON(res, 404, { success: false, message: 'Target not found' });
                }

                // Calculate battle outcome
                const powerRatio = attackPower / (defensePower + 1); // Avoid division by zero
                const victory = attackPower > defensePower;

                // Check if defender has actual troops (not just wall)
                let defenderHasTroops = false;
                if (targetType === 'city' && targetData.state.army) {
                    const defArmy = targetData.state.army;
                    defenderHasTroops = (defArmy.spearman || 0) > 0 || (defArmy.archer || 0) > 0 || (defArmy.swordsman || 0) > 0;
                } else if (targetType === 'fortress' && targetData.clan.fortress.troops) {
                    const defTroops = targetData.clan.fortress.troops;
                    defenderHasTroops = (defTroops.spearman || 0) > 0 || (defTroops.archer || 0) > 0 || (defTroops.swordsman || 0) > 0;
                }

                // Calculate casualties based on power ratio
                let attackerCasualtyRate, defenderCasualtyRate;

                // NO casualties if defender has no actual troops (wall doesn't count)!
                if (!defenderHasTroops) {
                    attackerCasualtyRate = 0;
                    defenderCasualtyRate = 0;
                } else if (victory) {
                    // Attacker wins - fewer casualties for attacker
                    attackerCasualtyRate = Math.max(0.05, Math.min(0.4, 0.3 / powerRatio));
                    defenderCasualtyRate = Math.max(0.5, Math.min(0.95, 0.5 * powerRatio));
                } else {
                    // Defender wins - more casualties for attacker
                    attackerCasualtyRate = Math.max(0.4, Math.min(0.9, 0.6 * (1 / powerRatio)));
                    defenderCasualtyRate = Math.max(0.1, Math.min(0.5, 0.2 / (1 / powerRatio)));
                }

                // Apply casualties to attacker
                const attackerCasualties = {
                    spearman: Math.floor(attackerTroops.spearman * attackerCasualtyRate),
                    archer: Math.floor(attackerTroops.archer * attackerCasualtyRate),
                    swordsman: Math.floor(attackerTroops.swordsman * attackerCasualtyRate)
                };

                clan.fortress.troops.spearman = Math.max(0, attackerTroops.spearman - attackerCasualties.spearman);
                clan.fortress.troops.archer = Math.max(0, attackerTroops.archer - attackerCasualties.archer);
                clan.fortress.troops.swordsman = Math.max(0, attackerTroops.swordsman - attackerCasualties.swordsman);

                // Apply casualties to defender
                let defenderCasualties = {};
                if (targetType === 'city' && targetData.state.army) {
                    const defArmy = targetData.state.army;
                    defenderCasualties = {
                        spearman: Math.floor((defArmy.spearman || 0) * defenderCasualtyRate),
                        archer: Math.floor((defArmy.archer || 0) * defenderCasualtyRate),
                        swordsman: Math.floor((defArmy.swordsman || 0) * defenderCasualtyRate)
                    };

                    targetData.state.army.spearman = Math.max(0, (defArmy.spearman || 0) - defenderCasualties.spearman);
                    targetData.state.army.archer = Math.max(0, (defArmy.archer || 0) - defenderCasualties.archer);
                    targetData.state.army.swordsman = Math.max(0, (defArmy.swordsman || 0) - defenderCasualties.swordsman);
                } else if (targetType === 'fortress' && targetData.clan.fortress.troops) {
                    const defTroops = targetData.clan.fortress.troops;
                    defenderCasualties = {
                        spearman: Math.floor((defTroops.spearman || 0) * defenderCasualtyRate),
                        archer: Math.floor((defTroops.archer || 0) * defenderCasualtyRate),
                        swordsman: Math.floor((defTroops.swordsman || 0) * defenderCasualtyRate)
                    };

                    targetData.clan.fortress.troops.spearman = Math.max(0, (defTroops.spearman || 0) - defenderCasualties.spearman);
                    targetData.clan.fortress.troops.archer = Math.max(0, (defTroops.archer || 0) - defenderCasualties.archer);
                    targetData.clan.fortress.troops.swordsman = Math.max(0, (defTroops.swordsman || 0) - defenderCasualties.swordsman);
                }

                // Calculate loot
                let actualLoot = { gold: 0, wood: 0, food: 0 };
                if (victory) {
                    // Can carry based on surviving troops (each troop carries 10 resources)
                    const survivingTroops = clan.fortress.troops.spearman +
                        clan.fortress.troops.archer +
                        clan.fortress.troops.swordsman;
                    const carryCapacity = survivingTroops * 10;

                    const totalAvailable = targetResources.gold + targetResources.wood + targetResources.food;

                    if (totalAvailable <= carryCapacity) {
                        actualLoot = { ...targetResources };
                    } else {
                        // Take proportionally
                        const ratio = carryCapacity / totalAvailable;
                        actualLoot = {
                            gold: Math.floor(targetResources.gold * ratio),
                            wood: Math.floor(targetResources.wood * ratio),
                            food: Math.floor(targetResources.food * ratio)
                        };
                    }

                    // Deduct from target
                    if (targetType === 'city') {
                        targetData.state.resources.gold = Math.max(0, (targetData.state.resources.gold || 0) - actualLoot.gold);
                        targetData.state.resources.wood = Math.max(0, (targetData.state.resources.wood || 0) - actualLoot.wood);
                        targetData.state.resources.food = Math.max(0, (targetData.state.resources.food || 0) - actualLoot.food);
                        fs.writeFileSync(targetData.filePath, JSON.stringify(targetData.userData, null, 2));
                    } else if (targetType === 'fortress') {
                        targetData.clan.treasury.gold = Math.max(0, (targetData.clan.treasury.gold || 0) - actualLoot.gold);
                        targetData.clan.treasury.wood = Math.max(0, (targetData.clan.treasury.wood || 0) - actualLoot.wood);
                        targetData.clan.treasury.food = Math.max(0, (targetData.clan.treasury.food || 0) - actualLoot.food);
                        fs.writeFileSync(targetData.filePath, JSON.stringify(targetData.clan, null, 2));
                    }
                }

                // Distribute loot to contributors
                const distribution = {};
                if (victory && clan.fortress.deposits && actualLoot.gold + actualLoot.wood + actualLoot.food > 0) {
                    for (const username in clan.fortress.deposits) {
                        const userDeposits = clan.fortress.deposits[username];
                        let contributionScore = 0;

                        contributionScore += (userDeposits.spearman || 0) * 10;
                        contributionScore += (userDeposits.archer || 0) * 15;
                        contributionScore += (userDeposits.swordsman || 0) * 20;

                        const contributionPercent = contributionScore / attackPower;

                        distribution[username] = {
                            gold: Math.floor(actualLoot.gold * contributionPercent),
                            wood: Math.floor(actualLoot.wood * contributionPercent),
                            food: Math.floor(actualLoot.food * contributionPercent)
                        };
                    }
                }

                // Save attack history
                if (!clan.fortress.attacks) {
                    clan.fortress.attacks = [];
                }

                const attackRecord = {
                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                    target: { x: targetX, y: targetY, name: targetName, type: targetType },
                    attackPower: attackPower,
                    defensePower: defensePower,
                    troops: { ...attackerTroops },
                    casualties: {
                        attacker: attackerCasualties,
                        defender: defenderCasualties
                    },
                    result: victory ? 'victory' : 'defeat',
                    loot: actualLoot,
                    distribution: distribution,
                    timestamp: Date.now(),
                    leader: attackerUsername
                };

                clan.fortress.attacks.unshift(attackRecord);
                if (clan.fortress.attacks.length > 20) {
                    clan.fortress.attacks = clan.fortress.attacks.slice(0, 20);
                }

                // Distribute reports to all clan members
                const userFiles = fs.readdirSync(DATA_DIR);
                const memberUsernames = Object.keys(clan.members);

                for (const file of userFiles) {
                    if (!file.endsWith('.json')) continue;
                    try {
                        const filePath = path.join(DATA_DIR, file);
                        const userContent = fs.readFileSync(filePath, 'utf8');
                        const userData = JSON.parse(userContent);

                        if (memberUsernames.includes(userData.username)) {
                            // This user is a clan member - send report
                            if (!userData.state.reports) userData.state.reports = [];

                            const myShare = distribution[userData.username] || { gold: 0, wood: 0, food: 0 };
                            const hasShare = myShare.gold > 0 || myShare.wood > 0 || myShare.food > 0;

                            const report = {
                                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                                type: victory ? 'victory' : 'defeat',
                                title: victory ? `ניצחון: התקפה על ${targetName}` : `תבוסה: התקפה על ${targetName}`,
                                content: `
                                    <div style="padding: 10px; text-align: center;">
                                        <div style="font-size: 4rem; margin-bottom: 10px;">
                                            ${victory ? '🎉' : '💀'}
                                        </div>
                                        <h2 style="color: ${victory ? '#10b981' : '#ef4444'}; margin-bottom: 15px;">
                                            ${victory ? 'ניצחון!' : 'תבוסה'}
                                        </h2>
                                        <p style="color: #cbd5e1; margin-bottom: 20px;">התקפה משותפת בהובלת ${attackerUsername}</p>
                                        
                                        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                                            <div style="flex: 1; background: rgba(59,130,246,0.1); padding: 10px; border-radius: 8px;">
                                                <h4 style="color: #60a5fa; margin: 0 0 5px 0;">כוח התקפה</h4>
                                                <p style="color: #cbd5e1; font-size: 1.2rem; margin: 0;">${attackPower}</p>
                                            </div>
                                            <div style="flex: 1; background: rgba(239,68,68,0.1); padding: 10px; border-radius: 8px;">
                                                <h4 style="color: #f87171; margin: 0 0 5px 0;">כוח הגנה</h4>
                                                <p style="color: #cbd5e1; font-size: 1.2rem; margin: 0;">${defensePower}</p>
                                            </div>
                                        </div>

                                        <h4 style="color: #fbbf24; margin: 15px 0 10px 0;">אבדות</h4>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                                            <div style="background: rgba(59,130,246,0.1); padding: 10px; border-radius: 8px;">
                                                <h5 style="color: #60a5fa; margin: 0 0 5px 0;">שלנו</h5>
                                                <div style="color: #cbd5e1; font-size: 0.85em;">
                                                    <div>🔱 ${attackerCasualties.spearman || 0} חניתים</div>
                                                    <div>🏹 ${attackerCasualties.archer || 0} קשתים</div>
                                                    <div>⚔️ ${attackerCasualties.swordsman || 0} לוחמי חרב</div>
                                                </div>
                                            </div>
                                            <div style="background: rgba(239,68,68,0.1); padding: 10px; border-radius: 8px;">
                                                <h5 style="color: #f87171; margin: 0 0 5px 0;">שלהם</h5>
                                                <div style="color: #cbd5e1; font-size: 0.85em;">
                                                    <div>🔱 ${defenderCasualties.spearman || 0} חניתים</div>
                                                    <div>🏹 ${defenderCasualties.archer || 0} קשתים</div>
                                                    <div>⚔️ ${defenderCasualties.swordsman || 0} לוחמי חרב</div>
                                                </div>
                                            </div>
                                        </div>

                                        ${hasShare ? `
                                        <div style="background: rgba(16,185,129,0.1); padding: 15px; border-radius: 8px; margin-top: 15px;">
                                            <h4 style="color: #10b981; margin: 0 0 10px 0;">💰 החלק שלך בשלל</h4>
                                            <div style="display: flex; justify-content: center; gap: 15px; font-size: 1.1rem; color: #cbd5e1;">
                                                <span>💰 ${myShare.gold}</span>
                                                <span>🌲 ${myShare.wood}</span>
                                                <span>🌾 ${myShare.food}</span>
                                            </div>
                                        </div>
                                        ` : '<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;"><p style="color: #94a3b8; font-size: 0.9em; margin:0;">(לא השתתפת עם חיילים או שלא נבזז שלל)</p></div>'}
                                    </div>
                                `,
                                timestamp: Date.now(),
                                read: false
                            };

                            userData.state.reports.unshift(report);
                            if (userData.state.reports.length > 50) userData.state.reports = userData.state.reports.slice(0, 50);

                            // If user is currently online (in memory), specific update might be needed 
                            // but saving to disk covers next fetch/login

                            // Also update resources directly if they got loot (handled generally earlier but double checking specific user file save)
                            // The previous code updated STATE.resources for the CURRENT_USER (attacker) via client-side response
                            // But here we must update ALL members server-side.

                            // IMPORTANT: Update resources for this user if they have a share
                            if (hasShare) {
                                if (!userData.state.resources) userData.state.resources = {};
                                userData.state.resources.gold = (userData.state.resources.gold || 0) + myShare.gold;
                                userData.state.resources.wood = (userData.state.resources.wood || 0) + myShare.wood;
                                userData.state.resources.food = (userData.state.resources.food || 0) + myShare.food;
                            }

                            fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
                        }
                    } catch (err) {
                        console.error(`Error processing report for user file ${file}:`, err);
                    }
                }

                fs.writeFileSync(clanPath, JSON.stringify(clan, null, 2));
                updateWorldCache();

                sendJSON(res, 200, {
                    success: true,
                    result: victory ? 'victory' : 'defeat',
                    attackPower: attackPower,
                    defensePower: defensePower,
                    loot: actualLoot,
                    casualties: {
                        attacker: attackerCasualties,
                        defender: defenderCasualties
                    },
                    distribution: distribution,
                    fortress: clan.fortress
                });
            } catch (err) {
                console.error('Error launching fortress attack:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/register' && req.method === 'POST') {
        readBody(req, (body) => {
            const { username, password, state } = body;
            const filePath = getUserFilePath(username);

            if (fs.existsSync(filePath)) {
                return sendJSON(res, 400, { success: false, message: 'Username already taken' });
            }

            const newUser = { username, password, state };

            try {
                fs.writeFileSync(filePath, JSON.stringify(newUser, null, 2));
                updateWorldCache(); // Update Global List
                sendJSON(res, 200, { success: true });
            } catch (err) {
                console.error("Register Error:", err);
                sendJSON(res, 500, { success: false, message: 'Could not create user' });
            }
        });
    } else if (req.url === '/api/world' && req.method === 'GET') {
        // World state API
        sendJSON(res, 200, {
            success: true,
            players: WORLD_CACHE,
            fortresses: FORTRESS_CACHE
        });
    } else if (req.url === '/api/players' && req.method === 'GET') {
        // Get all players for leaderboard
        try {
            const players = [];
            const files = fs.readdirSync(DATA_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
                    const userData = JSON.parse(content);

                    players.push({
                        username: userData.username,
                        buildings: userData.state?.buildings || {},
                        army: userData.state?.army || {},
                        research: userData.state?.research || {},
                        stats: userData.state?.stats || {},
                        lastLogin: userData.state?.lastLogin || 0,
                        mapEntities: userData.state?.mapEntities || {}
                    });
                } catch (err) {
                    console.error(`Error reading player file ${file}:`, err.message);
                }
            }

            sendJSON(res, 200, { players });
        } catch (err) {
            console.error('Error fetching players:', err);
            sendJSON(res, 500, { error: 'Failed to fetch players' });
        }
    } else if (req.url.startsWith('/api/user/') && req.method === 'GET') {
        // Get player data
        try {
            const username = decodeURIComponent(req.url.split('/api/user/')[1]);
            if (!username) {
                return sendJSON(res, 400, { error: 'Username required' });
            }

            const filePath = getUserFilePath(username);

            if (!fs.existsSync(filePath)) {
                return sendJSON(res, 404, { error: 'Player not found' });
            }

            const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Return essential player data (without password)
            sendJSON(res, 200, {
                username: userData.username,
                state: userData.state
            });
        } catch (err) {
            console.error('Error fetching player:', err);
            sendJSON(res, 500, { error: 'Failed to fetch player data' });
        }
    } else if (req.url === '/api/save' && req.method === 'POST') {
        readBody(req, (body) => {
            const { username, state } = body;
            const filePath = getUserFilePath(username);

            if (!fs.existsSync(filePath)) {
                return sendJSON(res, 404, { success: false, message: 'User file not found' });
            }

            try {
                const fileData = fs.readFileSync(filePath, 'utf8');
                const userData = JSON.parse(fileData);

                // Preserve existing reports (server might have added some)
                const existingReports = userData.state.reports || [];
                const incomingReports = state.reports || [];

                // Merge reports: Keep existing ones that aren't in incoming (newly added by server),
                // and take incoming ones (which might have 'read' status updates)
                const reportMap = new Map();
                existingReports.forEach(r => reportMap.set(r.id, r));
                incomingReports.forEach(r => reportMap.set(r.id, r));
                const mergedReports = Array.from(reportMap.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

                // --- MERGE CHATS LOGIC START ---
                // Similar issue: User B receives message on server file, but client A overwrites it if we just do "userData.state = state"
                const serverChats = userData.state.chats || {};
                const clientChats = state.chats || {};

                // Initialize merged chats with server state (source of truth for incoming messages)
                const mergedChats = { ...serverChats };

                // Iterate client chats to update local sent messages or read status (if we had read status)
                // For now, we trust server for incoming, but we need to ensure we don't lose messages sent from other devices?
                // Actually, simplest strategy for Chat Sync without complex CRDT:
                // For each partner, take the union of messages based on timestamp/content, or just trust server if it has more?
                // Let's do a Union by ID if possible, otherwise by content+time.
                // Since we don't have IDs on all messages in array (historical), let's rely on Append Only?

                // BETTER STRATEGY: 
                // 1. Take Server Chats as Base. 
                // 2. If Client has messages NOT in Server (sent recently), add them? 
                // Actually, simpler: Server is always the truth for "Received" messages. Client is truth for "Drafts" (not implemented).
                // But wait, if User A sends message, it goes to Server DB immediately. 
                // The issue is ONLY when User B saves. User B's client doesn't have the new message yet.
                // So User B's save payload has old chat history.
                // We must take `userData.state.chats` (Server) and only update it if Client has *new* sent messages?
                // No, Client sends messages via /api/message/send, so Server ALREADY has them.
                // Client never "saves" chats directly to modify history, except maybe "read" status?
                // SO: We should IGNORE client `state.chats` and ALWAYS use `userData.state.chats` from file, 
                // UNLESS we want to support deleting? No.
                // SAFE FIX: Always keep Server Chats.

                // However, if we just overwrite `userData.state = state`, we lose the server chats.
                // So we must restore them after assignment.

                userData.state = state;
                userData.state.reports = mergedReports;

                // Restore Chats from Server File (which includes new messages sent by others)
                // We assume Client never modifies chat history directly (only via API calls)
                // If client *did* have optimistic updates that failed, they might be lost here, but that's acceptable for now.
                if (Object.keys(serverChats).length > 0) {
                    userData.state.chats = serverChats;
                }
                // --- MERGE CHATS LOGIC END ---

                // Update Last Login
                userData.state.lastLogin = Date.now();

                fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

                // Trigger Cache Update (Lazy or Immediate)
                updateWorldCache();

                sendJSON(res, 200, {
                    success: true,
                    merged: {
                        reports: mergedReports,
                        chats: userData.state.chats
                    }
                });
            } catch (err) {
                console.error("Save Error:", err);
                sendJSON(res, 500, { success: false, message: 'Save failed' });
            }
        });
    } else if (req.url.startsWith('/api/load?') && req.method === 'GET') {
        // Load user data from server file
        const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const username = params.get('username');

        if (!username) {
            return sendJSON(res, 400, { success: false, message: 'Username required' });
        }

        const userPath = getUserFilePath(username);
        if (!fs.existsSync(userPath)) {
            return sendJSON(res, 404, { success: false, message: 'User not found' });
        }

        try {
            const userData = JSON.parse(fs.readFileSync(userPath, 'utf8'));
            sendJSON(res, 200, { success: true, data: userData });
        } catch (err) {
            console.error('Load error:', err);
            sendJSON(res, 500, { success: false, message: 'Failed to load user data' });
        }

    } else if (req.url === '/api/clans' && req.method === 'GET') {
        // Return cached clans
        sendJSON(res, 200, { success: true, clans: CLAN_CACHE });

    } else if (req.url === '/api/clans/save' && req.method === 'POST') {
        readBody(req, (body) => {
            const { clan } = body;
            if (!clan || !clan.id) {
                return sendJSON(res, 400, { success: false, message: 'Invalid clan data' });
            }

            // Simple File Persistence
            const filePath = path.join(CLAN_DIR, `${clan.id}.json`);
            try {
                fs.writeFileSync(filePath, JSON.stringify(clan, null, 2));

                // Update Cache immediately
                CLAN_CACHE[clan.id] = clan;
                updateWorldCache(); // Sync tags to world players

                sendJSON(res, 200, { success: true });
            } catch (err) {
                console.error("Clan Save Error:", err);
                sendJSON(res, 500, { success: false, message: 'Save failed' });
            }
        });

    } else if (req.url === '/api/territories' && req.method === 'GET') {
        // Get all conquered territories from all players
        try {
            const allTerritories = {};
            const files = fs.readdirSync(DATA_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
                    const userData = JSON.parse(content);

                    if (userData.state && userData.state.mapEntities) {
                        // Extract only owned territories
                        for (const [key, entity] of Object.entries(userData.state.mapEntities)) {
                            if (entity.owner === userData.username) {
                                allTerritories[key] = {
                                    ...entity,
                                    owner: userData.username
                                };
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error reading territories from ${file}:`, err.message);
                }
            }

            sendJSON(res, 200, { success: true, territories: allTerritories });
        } catch (err) {
            console.error('Error fetching territories:', err);
            sendJSON(res, 500, { success: false, message: err.message });
        }

    } else if (req.url === '/api/territories' && req.method === 'GET') {
        // Get all conquered territories from all players
        try {
            const allTerritories = {};
            const files = fs.readdirSync(DATA_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
                    const userData = JSON.parse(content);

                    if (userData.state && userData.state.mapEntities) {
                        // Extract only owned territories
                        for (const [key, entity] of Object.entries(userData.state.mapEntities)) {
                            // Verify ownership claim
                            if (entity.owner === userData.username) {
                                // Conflict Resolution: If territory already exists, check timestamps
                                if (allTerritories[key]) {
                                    const existing = allTerritories[key];
                                    const newTime = entity.capturedAt || 0;
                                    const existingTime = existing.capturedAt || 0;

                                    // If new claim is newer, overwrite. Otherwise stick with existing.
                                    if (newTime > existingTime) {
                                        allTerritories[key] = { ...entity };
                                    }
                                } else {
                                    allTerritories[key] = { ...entity };
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error reading territories from ${file}:`, err.message);
                }
            }

            sendJSON(res, 200, { success: true, territories: allTerritories });
        } catch (err) {
            console.error('Error fetching territories:', err);
            sendJSON(res, 500, { success: false, message: err.message });
        }

    } else if (req.url === '/api/clan/invite' && req.method === 'POST') {
        // Clan leader invites player
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { clanId, targetUser, from } = JSON.parse(body);

                // Validate clan exists and user is leader
                const clanPath = path.join(CLAN_DIR, `${clanId}.json`);
                if (!fs.existsSync(clanPath)) {
                    sendJSON(res, 404, { success: false, message: 'קלאן לא נמצא' });
                    return;
                }

                const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                // Check if sender is leader
                if (clan.members[from]?.role !== 'leader') {
                    sendJSON(res, 403, { success: false, message: 'רק מנהיג יכול להזמין שחקנים' });
                    return;
                }

                // Find target user file by searching through all users
                let targetPath = null;
                let targetData = null;

                try {
                    const userFiles = fs.readdirSync(DATA_DIR);
                    for (const file of userFiles) {
                        if (!file.endsWith('.json')) continue;

                        try {
                            const filePath = path.join(DATA_DIR, file);
                            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                            // Match username (case-insensitive)
                            if (data.username && data.username.toLowerCase() === targetUser.toLowerCase()) {
                                targetPath = filePath;
                                targetData = data;
                                break;
                            }
                        } catch (err) {
                            // Skip invalid files
                            continue;
                        }
                    }
                } catch (err) {
                    console.error('Error searching for user:', err);
                }

                if (!targetPath || !targetData) {

                    sendJSON(res, 404, { success: false, message: 'שחקן לא נמצא' });
                    return;
                }

                // Check if target already in a clan
                if (targetData.state.clan) {
                    sendJSON(res, 400, { success: false, message: 'השחקן כבר נמצא בקלאן' });
                    return;
                }

                // Add invitation to target's reports (mailbox uses STATE.reports)
                if (!targetData.state.reports) {
                    targetData.state.reports = [];
                }

                // Create invitation report
                targetData.state.reports.unshift({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    type: 'clan_invite',
                    from: from,
                    clanId: clanId,
                    clanName: clan.name,
                    clanTag: clan.tag,
                    timestamp: Date.now(),
                    read: false,
                    title: `הזמנה לקלאן [${clan.tag}] ${clan.name}`,
                    data: {
                        from: from,
                        clanId: clanId,
                        clanName: clan.name,
                        clanTag: clan.tag
                    }
                });

                // Limit to 50 reports
                if (targetData.state.reports.length > 50) {
                    targetData.state.reports = targetData.state.reports.slice(0, 50);
                }

                // Save target user data
                fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2));


                sendJSON(res, 200, { success: true });

            } catch (err) {
                console.error('Clan invite error:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });

    } else if (req.url === '/api/clan/join' && req.method === 'POST') {
        // Just join a clan (open join for now, or for AI use)
        readBody(req, (body) => {
            try {
                const { username, clanId } = body;
                if (!username || !clanId) return sendJSON(res, 400, { success: false, message: 'Missing fields' });

                const clanPath = path.join(CLAN_DIR, `${clanId}.json`);
                if (!fs.existsSync(clanPath)) return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                const userPath = getUserFilePath(username);
                if (!fs.existsSync(userPath)) return sendJSON(res, 404, { success: false, message: 'User not found' });
                const userData = JSON.parse(fs.readFileSync(userPath, 'utf8'));

                if (userData.state.clan) return sendJSON(res, 400, { success: false, message: 'Already in a clan' });

                // Add member
                clan.members[username] = { role: 'member', joinedAt: Date.now() };

                // Update User
                userData.state.clan = { id: clanId, name: clan.name, tag: clan.tag };

                // Save
                fs.writeFileSync(clanPath, JSON.stringify(clan, null, 2));
                fs.writeFileSync(userPath, JSON.stringify(userData, null, 2));

                // Update Cache
                CLAN_CACHE[clanId] = clan;
                updateWorldCache();

                sendJSON(res, 200, { success: true, clan: clan });

            } catch (e) {
                console.error(e);
                sendJSON(res, 500, { success: false, message: 'Join Error' });
            }
        });

    } else if (req.url === '/api/clan/create' && req.method === 'POST') {
        readBody(req, (body) => {
            try {
                const { username, name, tag } = body;
                if (!username || !name || !tag) return sendJSON(res, 400, { success: false, message: 'Missing fields' });

                // Check user
                const userPath = getUserFilePath(username);
                if (!fs.existsSync(userPath)) return sendJSON(res, 404, { success: false, message: 'User not found' });
                const userData = JSON.parse(fs.readFileSync(userPath, 'utf8'));

                if (userData.state.clan) return sendJSON(res, 400, { success: false, message: 'Already in a clan' });

                // Check Name/Tag Uniqueness
                const allClans = fs.readdirSync(CLAN_DIR);
                for (const f of allClans) {
                    if (!f.endsWith('.json')) continue;
                    const c = JSON.parse(fs.readFileSync(path.join(CLAN_DIR, f), 'utf8'));
                    if (c.name === name || c.tag === tag) {
                        return sendJSON(res, 400, { success: false, message: 'Name or Tag already taken' });
                    }
                }

                // Create
                const clanId = 'clan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const newClan = {
                    id: clanId,
                    name: name,
                    tag: tag,
                    members: {
                        [username]: { role: 'leader', joinedAt: Date.now() }
                    },
                    createdAt: Date.now(),
                    treasury: { gold: 0, wood: 0, food: 0, wine: 0, marble: 0, crystal: 0, sulfur: 0 },
                    fortress: { level: 1, hp: 10000, maxHp: 10000, attacks: [] }
                };

                // Update User
                userData.state.clan = { id: clanId, name: name, tag: tag };

                // Save
                fs.writeFileSync(path.join(CLAN_DIR, `${clanId}.json`), JSON.stringify(newClan, null, 2));
                fs.writeFileSync(userPath, JSON.stringify(userData, null, 2));

                // Cache
                CLAN_CACHE[clanId] = newClan;
                updateWorldCache();

                sendJSON(res, 200, { success: true, clan: newClan });

            } catch (e) {
                console.error(e);
                sendJSON(res, 500, { success: false, message: 'Create Error' });
            }
        });
    } else if (req.url === '/api/message/send' && req.method === 'POST') {
        readBody(req, (body) => {
            const { to, subject, content, from } = body;

            if (!to || !content || !from) {
                return sendJSON(res, 400, { success: false, message: 'Missing fields' });
            }

            // Find target (Recipient)
            let targetPath = null;
            let targetData = null;

            // Find sender
            let senderPath = null;
            let senderData = null;

            try {
                const userFiles = fs.readdirSync(DATA_DIR);
                for (const file of userFiles) {
                    if (!file.endsWith('.json')) continue;
                    try {
                        const filePath = path.join(DATA_DIR, file);
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                        // Match Target
                        if (data.username && data.username.toLowerCase() === to.toLowerCase()) {
                            targetPath = filePath;
                            targetData = data;
                        }
                        // Match Sender
                        if (data.username && data.username === from) {
                            senderPath = filePath;
                            senderData = data;
                        }
                    } catch (err) { continue; }
                }

                if (!targetPath || !targetData) {
                    return sendJSON(res, 404, { success: false, message: 'שחקן לא נמצא' });
                }

                if (!senderPath || !senderData) {
                    return sendJSON(res, 404, { success: false, message: 'שולח לא נמצא' });
                }

                // Initialize chats if needed
                if (!targetData.state.chats) targetData.state.chats = {};
                if (!senderData.state.chats) senderData.state.chats = {};

                // Use proper casing from data
                const targetName = targetData.username;
                const senderName = senderData.username;

                // Create message object
                const message = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    from: senderName,
                    to: targetName,
                    timestamp: Date.now(),
                    content: content
                };

                // Add to Sender's Chat History
                if (!senderData.state.chats[targetName]) senderData.state.chats[targetName] = [];
                senderData.state.chats[targetName].push(message);
                if (senderData.state.chats[targetName].length > 50) senderData.state.chats[targetName].shift(); // Keep last 50

                // Add to Target's Chat History
                if (!targetData.state.chats[senderName]) targetData.state.chats[senderName] = [];
                targetData.state.chats[senderName].push(message);
                if (targetData.state.chats[senderName].length > 50) targetData.state.chats[senderName].shift(); // Keep last 50

                // Also add notification report to target if it's the first message or they are offline
                // For simplicity, we just add a "New Message" system report if one doesn't exist recently? 
                // Or just rely on the badge updates. Let's stick to chat history for now.
                // But for the mailbox to show "Unread", we might need a flag.
                // Let's add an unread flag to the conversation in the future, for now rely on checking last message.

                // Save Both
                fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2));
                fs.writeFileSync(senderPath, JSON.stringify(senderData, null, 2));

                sendJSON(res, 200, { success: true, message: message });

            } catch (err) {
                console.error('Error sending message:', err);
                sendJSON(res, 500, { success: false, message: 'שגיאה בשליחת ההודעה' });
            }
        });
    } else if (req.url === '/api/market/offer' && req.method === 'POST') {
        // Create trade offer
        readBody(req, (body) => {
            try {
                const { seller, offering, requesting } = body;

                if (!seller || !offering || !requesting) {
                    return sendJSON(res, 400, { success: false, message: 'Missing required fields' });
                }

                // Validate seller has resources
                const sellerPath = getUserFilePath(seller);
                if (!fs.existsSync(sellerPath)) {
                    return sendJSON(res, 404, { success: false, message: 'Seller not found' });
                }

                const sellerData = JSON.parse(fs.readFileSync(sellerPath, 'utf8'));
                const resources = sellerData.state.resources || {};

                // Check if seller has enough resources
                for (const [res, amount] of Object.entries(offering)) {
                    if ((resources[res] || 0) < amount) {
                        return sendJSON(res, 400, { success: false, message: `אין מספיק ${res}` });
                    }
                }

                // Deduct resources from seller (lock them)
                for (const [res, amount] of Object.entries(offering)) {
                    sellerData.state.resources[res] -= amount;
                }

                // Create trade offer
                const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const trade = {
                    id: tradeId,
                    seller: seller,
                    safeSeller: seller.replace(/[^a-z0-9]/gi, '_').toLowerCase(), // Sanitized for file lookup
                    offering: offering,
                    requesting: requesting,
                    status: 'active',
                    createdAt: Date.now(),
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
                    acceptedBy: null,
                    safeAcceptedBy: null // Will be set when accepted
                };

                // Save trade
                fs.writeFileSync(path.join(TRADE_DIR, `${tradeId}.json`), JSON.stringify(trade, null, 2));

                // Save seller's updated resources
                fs.writeFileSync(sellerPath, JSON.stringify(sellerData, null, 2));

                sendJSON(res, 200, { success: true, trade: trade });
            } catch (err) {
                console.error('Error creating trade offer:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/market/offers' && req.method === 'GET') {
        // List all active offers
        try {
            const offers = [];
            const now = Date.now();
            const files = fs.readdirSync(TRADE_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const trade = JSON.parse(fs.readFileSync(path.join(TRADE_DIR, file), 'utf8'));

                    // Auto-expire old trades
                    if (trade.status === 'active' && trade.expiresAt < now) {
                        trade.status = 'expired';
                        // Return resources to seller using safeSeller for file lookup
                        const sellerPath = getUserFilePath(trade.safeSeller || trade.seller);
                        if (fs.existsSync(sellerPath)) {
                            const sellerData = JSON.parse(fs.readFileSync(sellerPath, 'utf8'));
                            for (const [res, amount] of Object.entries(trade.offering)) {
                                sellerData.state.resources[res] = (sellerData.state.resources[res] || 0) + amount;
                            }
                            fs.writeFileSync(sellerPath, JSON.stringify(sellerData, null, 2));
                        }
                        fs.writeFileSync(path.join(TRADE_DIR, file), JSON.stringify(trade, null, 2));
                    }

                    if (trade.status === 'active') {
                        offers.push(trade);
                    }
                } catch (err) {
                    console.error(`Error reading trade ${file}:`, err);
                }
            }

            sendJSON(res, 200, { success: true, offers: offers });
        } catch (err) {
            console.error('Error listing offers:', err);
            sendJSON(res, 500, { success: false, message: err.message });
        }
    } else if (req.url === '/api/market/accept' && req.method === 'POST') {
        // Accept trade offer
        readBody(req, (body) => {
            try {
                const { tradeId, buyer } = body;

                const tradePath = path.join(TRADE_DIR, `${tradeId}.json`);
                if (!fs.existsSync(tradePath)) {
                    return sendJSON(res, 404, { success: false, message: 'Trade not found' });
                }

                const trade = JSON.parse(fs.readFileSync(tradePath, 'utf8'));

                if (trade.status !== 'active') {
                    return sendJSON(res, 400, { success: false, message: 'Trade not active' });
                }

                if (trade.seller === buyer) {
                    return sendJSON(res, 400, { success: false, message: 'Cannot accept own trade' });
                }

                // Check buyer has resources
                const buyerPath = getUserFilePath(buyer);
                if (!fs.existsSync(buyerPath)) {
                    return sendJSON(res, 404, { success: false, message: 'Buyer not found' });
                }

                const buyerData = JSON.parse(fs.readFileSync(buyerPath, 'utf8'));
                const buyerResources = buyerData.state.resources || {};

                for (const [res, amount] of Object.entries(trade.requesting)) {
                    if ((buyerResources[res] || 0) < amount) {
                        return sendJSON(res, 400, { success: false, message: `אין מספיק ${res}` });
                    }
                }

                // Get seller data using safeSeller for file lookup
                const sellerPath = getUserFilePath(trade.safeSeller || trade.seller);
                const sellerData = JSON.parse(fs.readFileSync(sellerPath, 'utf8'));

                // Execute trade
                // Buyer loses requesting, gains offering
                for (const [res, amount] of Object.entries(trade.requesting)) {
                    buyerData.state.resources[res] -= amount;
                }
                for (const [res, amount] of Object.entries(trade.offering)) {
                    buyerData.state.resources[res] = (buyerData.state.resources[res] || 0) + amount;
                }

                // Seller gains requesting (offering already deducted when created)
                for (const [res, amount] of Object.entries(trade.requesting)) {
                    sellerData.state.resources[res] = (sellerData.state.resources[res] || 0) + amount;
                }

                // Update trade status
                trade.status = 'completed';
                trade.acceptedBy = buyer;
                trade.safeAcceptedBy = buyer.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                trade.completedAt = Date.now();

                // Save everything
                fs.writeFileSync(tradePath, JSON.stringify(trade, null, 2));
                fs.writeFileSync(buyerPath, JSON.stringify(buyerData, null, 2));
                fs.writeFileSync(sellerPath, JSON.stringify(sellerData, null, 2));

                sendJSON(res, 200, { success: true, trade: trade });
            } catch (err) {
                console.error('Error accepting trade:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url === '/api/market/cancel' && req.method === 'POST') {
        // Cancel own trade offer
        readBody(req, (body) => {
            try {
                const { tradeId, username } = body;

                const tradePath = path.join(TRADE_DIR, `${tradeId}.json`);
                if (!fs.existsSync(tradePath)) {
                    return sendJSON(res, 404, { success: false, message: 'Trade not found' });
                }

                const trade = JSON.parse(fs.readFileSync(tradePath, 'utf8'));

                if (trade.seller !== username) {
                    return sendJSON(res, 403, { success: false, message: 'Not your trade' });
                }

                if (trade.status !== 'active') {
                    return sendJSON(res, 400, { success: false, message: 'Trade not active' });
                }

                // Return resources to seller
                // Return resources to seller using safeSeller for file lookup
                const sellerPath = getUserFilePath(trade.safeSeller || trade.seller);
                const sellerData = JSON.parse(fs.readFileSync(sellerPath, 'utf8'));

                for (const [res, amount] of Object.entries(trade.offering)) {
                    sellerData.state.resources[res] = (sellerData.state.resources[res] || 0) + amount;
                }

                // Update trade status
                trade.status = 'cancelled';
                trade.cancelledAt = Date.now();

                // Save
                fs.writeFileSync(tradePath, JSON.stringify(trade, null, 2));
                fs.writeFileSync(sellerPath, JSON.stringify(sellerData, null, 2));

                sendJSON(res, 200, { success: true, trade: trade });
            } catch (err) {
                console.error('Error cancelling trade:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else if (req.url.startsWith('/api/market/history/') && req.method === 'GET') {
        // Get trade history for a user
        try {
            const username = decodeURIComponent(req.url.split('/api/market/history/')[1]);
            const history = [];
            const files = fs.readdirSync(TRADE_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const trade = JSON.parse(fs.readFileSync(path.join(TRADE_DIR, file), 'utf8'));
                    if (trade.seller === username || trade.acceptedBy === username) {
                        history.push(trade);
                    }
                } catch (err) {
                    console.error(`Error reading trade ${file}:`, err);
                }
            }

            // Sort by date
            history.sort((a, b) => b.createdAt - a.createdAt);

            sendJSON(res, 200, { success: true, history: history.slice(0, 50) });
        } catch (err) {
            console.error('Error reading trade history:', err);
            sendJSON(res, 500, { success: false, message: 'Server error' });
        }
    } else if (req.url === '/api/clans/rankings' && req.method === 'GET') {
        // Get clan rankings (TOP 10)
        try {
            const rankings = [];
            const clanFiles = fs.readdirSync(CLAN_DIR);

            for (const file of clanFiles) {
                if (!file.endsWith('.json')) continue;
                try {
                    const fileContent = fs.readFileSync(path.join(CLAN_DIR, file), 'utf8');
                    const clanData = JSON.parse(fileContent);

                    // Skip deleted clans
                    if (clanData.deleted) continue;

                    // Calculate clan score
                    const memberCount = Object.keys(clanData.members || {}).length;
                    const territories = clanData.stats?.territories || 0;
                    const victories = (clanData.fortress?.attacks || []).filter(a => a.result === 'victory').length;
                    const hasFortress = clanData.fortress ? true : false;

                    // Calculate total wealth from treasury
                    const treasury = clanData.treasury || {};
                    const totalWealth = (treasury.gold || 0) + (treasury.wood || 0) +
                        (treasury.food || 0) + (treasury.wine || 0) +
                        (treasury.marble || 0) + (treasury.crystal || 0) +
                        (treasury.sulfur || 0);

                    // Calculate average member level (using building levels as proxy)
                    let avgLevel = 1;
                    const memberUsernames = Object.keys(clanData.members || {});
                    if (memberUsernames.length > 0) {
                        let totalLevels = 0;
                        let validMembers = 0;
                        for (const username of memberUsernames) {
                            const userPath = getUserFilePath(username);
                            if (fs.existsSync(userPath)) {
                                try {
                                    const userData = JSON.parse(fs.readFileSync(userPath, 'utf8'));
                                    const buildings = userData.state?.buildings || {};
                                    const townHallLevel = buildings.townhall || 1;
                                    totalLevels += townHallLevel;
                                    validMembers++;
                                } catch (err) {
                                    // Skip this member if error reading
                                }
                            }
                        }
                        if (validMembers > 0) {
                            avgLevel = totalLevels / validMembers;
                        }
                    }

                    // Calculate total score
                    const score =
                        (memberCount * 100) +
                        (territories * 500) +
                        (victories * 200) +
                        (hasFortress ? 2000 : 0) +
                        (avgLevel * 150) +
                        (totalWealth / 1000);

                    rankings.push({
                        id: clanData.id,
                        tag: clanData.tag,
                        name: clanData.name,
                        icon: clanData.icon || '🏰',
                        score: Math.floor(score),
                        members: memberCount,
                        territories: territories,
                        victories: victories,
                        hasFortress: hasFortress,
                        avgLevel: Math.round(avgLevel * 10) / 10,
                        wealth: totalWealth
                    });
                } catch (err) {
                    console.error(`Error reading clan ${file}:`, err);
                }
            }

            // Sort by score (descending) and take TOP 10
            rankings.sort((a, b) => b.score - a.score);
            const top10 = rankings.slice(0, 10);

            // Add rank number
            top10.forEach((clan, index) => {
                clan.rank = index + 1;
            });

            sendJSON(res, 200, { success: true, rankings: top10 });
        } catch (err) {
            console.error('Error calculating rankings:', err);
            sendJSON(res, 500, { success: false, message: 'Server error' });
        }
    } else if (req.url === '/api/attack' && req.method === 'POST') {
        // --- NEW PVP ATTACK ENDPOINT ---
        readBody(req, (body) => {
            try {
                const { attacker, targetX, targetY, troops } = body;
                console.log(`[ATK_DEBUG] Request received from ${attacker} to (${targetX},${targetY})`, troops);

                if (!attacker || targetX === undefined || targetY === undefined || !troops) {
                    console.error('[ATK_DEBUG] Missing fields');
                    return sendJSON(res, 400, { success: false, message: 'Missing fields' });
                }

                // 1. Load Attacker
                const attackerPath = getUserFilePath(attacker);
                console.log(`[ATK_DEBUG] Loading attacker from ${attackerPath}`);
                if (!fs.existsSync(attackerPath)) {
                    console.error('[ATK_DEBUG] Attacker file not found');
                    return sendJSON(res, 404, { success: false, message: 'Attacker not found' });
                }
                const attackerData = JSON.parse(fs.readFileSync(attackerPath, 'utf8'));

                // Attack Source Logic (City vs Fortress)
                // If body.source === 'fortress', we are attacking AS the fortress (Leader Only)
                let attackerResources = attackerData.state.resources;
                let attackerArmyRef = attackerData.state.army; // Reference to update losses

                if (body.source === 'fortress') {
                    // 1. Verify Leader
                    const clanId = attackerData.state.clan ? attackerData.state.clan.id : null;
                    if (!clanId) return sendJSON(res, 403, { success: false, message: 'Not in a clan' });

                    const clanPath = path.join(CLAN_DIR, `${clanId}.json`);
                    if (!fs.existsSync(clanPath)) return sendJSON(res, 404, { success: false, message: 'Clan not found' });
                    const clan = JSON.parse(fs.readFileSync(clanPath, 'utf8'));

                    if (clan.members[attacker].role !== 'leader') {
                        return sendJSON(res, 403, { success: false, message: 'Only leaders can attack from fortress' });
                    }

                    if (!clan.fortress) return sendJSON(res, 400, { success: false, message: 'No fortress built' });

                    // Backward compatibility: check both garrison (new) and troops (old)
                    const garrisonRef = clan.fortress.garrison || clan.fortress.troops || {};


                    // DEFERRED BATTLE RESOLUTION for Fortress Attacks
                    // Don't calculate battle now - let the client timer handle it
                    // Troops are already deducted client-side and will be restored if needed

                    if (!body.resolve) {
                        // Validate that the troops sent actually exist in the garrison
                        for (const [t, count] of Object.entries(troops)) {
                            if ((garrisonRef[t] || 0) < count) {
                                return sendJSON(res, 400, { success: false, message: `Not enough ${t} in fortress garrison` });
                            }
                        }

                        console.log(`[FORTRESS_ATTACK] Attack validated and deferred for ${attacker} -> (${targetX},${targetY})`);

                        return sendJSON(res, 200, {
                            success: true,
                            deferred: true,
                            message: 'Fortress attack queued - battle will resolve upon arrival'
                        });
                    }

                    console.log(`[FORTRESS_ATTACK] Resolving deferred battle for ${attacker} -> (${targetX},${targetY})`);
                    console.log(`[FORTRESS_ATTACK] Troops in request:`, troops);
                    console.log(`[FORTRESS_ATTACK] Current garrison:`, garrisonRef);
                    attackerResources = clan.treasury;
                    attackerArmyRef = garrisonRef;
                    console.log(`[FORTRESS_ATTACK] Using treasury:`, attackerResources);
                } else {
                    // Standard Player Attack Verification
                    for (const [t, count] of Object.entries(troops)) {
                        if ((attackerArmyRef[t] || 0) < count) {
                            return sendJSON(res, 400, { success: false, message: `Not enough ${t}` });
                        }
                    }
                }

                // 2. Identify Target (Player City or Territory?)
                // For simplicity, let's assume we attack whatever is at X,Y
                // We need to scan ALL users to find who owns X,Y. This is inefficient but works for file-based DB.
                let targetUser = null;
                let targetType = 'wild'; // city, territory, wild
                let targetEntity = null;

                const allFiles = fs.readdirSync(DATA_DIR);
                for (const file of allFiles) {
                    if (!file.endsWith('.json')) continue;
                    try {

                        const uData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

                        // Safety Check: corrupt file
                        if (!uData || !uData.state || !uData.profile) continue;

                        // Check Home City
                        if (uData.state.homeCoords && uData.state.homeCoords.x === targetX && uData.state.homeCoords.y === targetY) {
                            targetUser = uData;
                            targetType = 'city';
                            targetEntity = { name: uData.profile.username + "'s City", type: 'city' };
                            break;
                        }
                        // Check Territories
                        if (uData.state.mapEntities) {
                            const key = `${targetX},${targetY}`;
                            if (uData.state.mapEntities[key]) {
                                targetUser = uData;
                                targetType = 'territory';
                                targetEntity = uData.state.mapEntities[key];
                                break;
                            }
                        }
                    } catch (e) { }
                }

                // Check CLANS for Fortress
                if (!targetUser) {
                    const clanFiles = fs.readdirSync(CLAN_DIR);
                    for (const file of clanFiles) {
                        if (!file.endsWith('.json')) continue;
                        try {
                            const cData = JSON.parse(fs.readFileSync(path.join(CLAN_DIR, file), 'utf8'));
                            if (cData.fortress && cData.fortress.x === targetX && cData.fortress.y === targetY) {
                                targetUser = {
                                    profile: { username: "Clan Fortress [" + cData.tag + "]" },
                                    type: 'fortress',
                                    clanId: cData.id,
                                    clanData: cData // Keep ref to full clan data
                                };
                                targetType = 'fortress';
                                targetEntity = { name: "Fortress of " + cData.name, type: 'fortress' };
                                break;
                            }
                        } catch (err) { }
                    }
                }

                if (!targetUser) {
                    // PvE Logic: Create Mock NPC
                    console.log(`[ATK_DEBUG] No player found at ${targetX},${targetY}. Generating NPC.`);
                    targetType = 'npc';
                    targetEntity = { name: "Barbarian Camp", type: 'monster', level: Math.floor(Math.random() * 5) + 1 };

                    // Mock Target User Object
                    targetUser = {
                        profile: { username: "NPC_Barbarian" },
                        state: {
                            resources: {
                                gold: Math.floor(Math.random() * 1000),
                                wood: Math.floor(Math.random() * 1000),
                                food: Math.floor(Math.random() * 1000)
                            },
                            army: {
                                spearman: Math.floor(Math.random() * 20),
                                archer: Math.floor(Math.random() * 10)
                            }
                        }
                    };
                }

                if (targetUser.profile.username === attacker) {
                    return sendJSON(res, 400, { success: false, message: 'Cannot attack yourself' });
                }

                // 3. Resolve Battle
                // Simple logic: Sum attack power vs Sum defense power
                // Troops: { soldier: 5, knight: 2 ... }
                // Stats (Mock): Soldier=10, Archer=15, Knight=30
                // Defense: Wall=500 per level, plus garrison (Not implemented yet for defender, so use default defense)

                const UNIT_STATS = {
                    spearman: { att: 10, def: 10, loot: 10 },
                    archer: { att: 15, def: 5, loot: 5 },
                    swordsman: { att: 25, def: 20, loot: 25 },
                    cavalry: { att: 40, def: 15, loot: 30 },
                    axeman: { att: 35, def: 10, loot: 20 },

                    // Advanced Units
                    mountedRaider: { att: 45, def: 15, loot: 40 },
                    heavyCavalry: { att: 60, def: 50, loot: 25 },
                    mountedArcher: { att: 50, def: 10, loot: 15 },
                    berserker: { att: 70, def: 5, loot: 35 },
                    shieldWall: { att: 10, def: 80, loot: 10 },
                    dualWielder: { att: 60, def: 15, loot: 20 },

                    // Siege
                    catapult: { att: 80, def: 5, loot: 0 },
                    batteringRam: { att: 10, def: 60, loot: 0 },
                    ballista: { att: 90, def: 5, loot: 0 },

                    // Legacy mappings
                    knight: { att: 30, def: 20, loot: 25 },
                    elite: { att: 50, def: 40, loot: 10 },
                    soldier: { att: 10, def: 10, loot: 10 }
                };

                let attackPower = 0;
                let totalCapacity = 0;
                for (const [t, count] of Object.entries(troops)) {
                    if (UNIT_STATS[t]) {
                        attackPower += (UNIT_STATS[t].att * count);
                        totalCapacity += (UNIT_STATS[t].loot * count);
                    }
                }

                // Defender Strength
                // If City: Base defense + Wall Level * 500 + Army (if we implemented garrison)
                // Currently defender army is in their 'state.army'. Let's Assume 50% of their army fights? 
                // Or simplified: Just Wall Defense for now to avoid zeroing offline players easily.
                let defensePower = 0;

                if (targetType === 'city') {
                    // Base defense from wall only
                    // Players should manually garrison troops for defense (future feature)
                    defensePower = 500; // Base wall

                    if (targetType === 'npc') {
                        defensePower = 100 + (targetEntity.level || 1) * 50; // Weak NPC base
                    }

                    // NOTE: Removed automatic army defense bonus
                    // This was causing excessive casualties for attackers even against weak/offline targets
                    // In the future, implement a garrison system where players manually assign troops to defense
                } else if (targetType === 'fortress') {
                    // Fortress Defense
                    // Base: 2000 (Stronger than city)
                    // + Garrison Power
                    // + 5% Automatic Bonus
                    const fortLevel = targetUser.clanData.fortress.level || 1;
                    let baseDefense = 2000 + (fortLevel * 500);

                    let garrisonPower = 0;
                    if (targetUser.clanData.fortress.garrison) {
                        for (const [t, count] of Object.entries(targetUser.clanData.fortress.garrison)) {
                            if (UNIT_STATS[t]) {
                                garrisonPower += (UNIT_STATS[t].def * count);
                            }
                        }
                    }

                    defensePower = (baseDefense + garrisonPower) * 1.05; // 5% Bonus
                    if (isNaN(defensePower)) defensePower = 2000; // Safety fallback

                    console.log(`[ATK_DEBUG] Fortress Defense: Base=${baseDefense}, Garrison=${garrisonPower}, Total=${defensePower}`);

                } else {
                    // Territory: Base 500
                    defensePower = 200 + (targetEntity.level || 1) * 100;
                }

                // Result
                // Random variation +/- 10%
                const finalAtt = Math.max(1, attackPower * (0.9 + Math.random() * 0.2));
                const finalDef = Math.max(0, defensePower * (0.9 + Math.random() * 0.2));

                const isVictory = finalAtt > finalDef;

                // 4. Casualties (Aggressive Calculation)
                console.log(`[BATTLE_DEBUG] Victory: ${isVictory}, AttPower: ${finalAtt}, DefPower: ${finalDef}`);
                let lossRate = 0;
                if (isVictory) {
                    const ratio = finalDef / finalAtt;
                    lossRate = Math.min(0.20, ratio * 0.3); // Increased loss scaling
                    // Ensure at least 2% loss even on easy wins
                    if (lossRate < 0.02) lossRate = 0.02;
                    console.log(`[BATTLE_DEBUG] Victory lossRate: ${lossRate}, ratio: ${ratio}`);
                } else {
                    const ratio = finalAtt / finalDef;
                    lossRate = 0.3 + (1 - (ratio || 0)) * 0.3;
                    if (lossRate > 0.9) lossRate = 0.9;
                    console.log(`[BATTLE_DEBUG] Defeat lossRate: ${lossRate}, ratio: ${ratio}`);
                }

                const casualties = {};
                for (const [t, count] of Object.entries(troops)) {
                    // Always use Ceil to force at least 1 death if lossRate > 0
                    let lost = Math.ceil(count * lossRate);
                    if (lost > count) lost = count;

                    if (lost > 0) casualties[t] = lost;
                }
                console.log(`[BATTLE_DEBUG] Calculated casualties:`, casualties);

                // 5. Initialize Loot FIRST (before any use)
                const loot = { gold: 0, wood: 0, food: 0 };

                // 6. Apply Changes to Attacker
                // Deduct troops from what was sent (wait, 'troops' param is what was SENT. 
                // The attacker usually 'sends' them out.
                // In this API, we assume the client ALREADY deducted them from 'available'? 
                // Or we deduct them from 'state.army' NOW?
                // Standard logic: Troops leave city -> Fight -> Return.
                // WE MUST DEDUCT CASUALTIES from the RETURNING troops.
                // But since we don't have a 'returning' state yet, we just update the attacker's main army file directly for the losses.
                // (This implies the troops instantly returned, acting as 'simulated' instant battle)

                if (body.source === 'fortress') {
                    // Update Fortress Garrison
                    // IMPORTANT: Troops were already deducted during initial send!
                    // We need to ADD BACK the survivors, not subtract casualties
                    for (const [t, count] of Object.entries(troops)) {
                        const died = casualties[t] || 0;
                        const survived = count - died;
                        if (survived > 0) {
                            attackerArmyRef[t] = (attackerArmyRef[t] || 0) + survived;
                        }
                    }
                    // Save Clan
                    const clanId = attackerData.state.clan.id; // We verified this exists earlier
                    // Need to re-read to avoid overwriting invalid state? 
                    // Actually we have 'clan' object from earlier scope? scope issue.
                    // Let's just re-read for safety or assume single thread.
                    // Re-implement read:
                    const cPath = path.join(CLAN_DIR, `${clanId}.json`);
                    const cData = JSON.parse(fs.readFileSync(cPath, 'utf8'));

                    // Backward compatibility: save to the correct field
                    if (cData.fortress.garrison !== undefined) {
                        cData.fortress.garrison = attackerArmyRef;
                    } else if (cData.fortress.troops !== undefined) {
                        cData.fortress.troops = attackerArmyRef;
                    } else {
                        // Default to garrison for new fortresses
                        cData.fortress.garrison = attackerArmyRef;
                    }

                    // Loot Logic for Treasury (Fortress Attack)
                    if (isVictory) {
                        // Add loot to treasury
                        if (!cData.treasury) cData.treasury = { gold: 0, wood: 0, food: 0, wine: 0, marble: 0, crystal: 0, sulfur: 0 };
                        const targets = ['gold', 'wood', 'food', 'wine', 'marble'];
                        // Steal Logic Copied/Modified
                        // ...
                        // Actually let's use the 'loot' object calculated below and add it here
                        for (const [res, amt] of Object.entries(loot)) {
                            cData.treasury[res] = (cData.treasury[res] || 0) + amt;
                        }
                    }
                    fs.writeFileSync(cPath, JSON.stringify(cData, null, 2));

                } else if (attackerData.state.army) {
                    for (const [t, count] of Object.entries(casualties)) {
                        attackerData.state.army[t] = Math.max(0, (attackerData.state.army[t] || 0) - count);
                    }
                }

                // 7. Calculate Loot from Target (If Victory)
                // Ensure resources exist (Only for players/NPCs, not Fortress which has separate logic)
                if (targetType !== 'fortress') {
                    if (!targetUser.state) targetUser.state = {}; // Safety
                    if (!targetUser.state.resources) targetUser.state.resources = {};
                    if (!attackerData.state.resources) attackerData.state.resources = {};

                    if (isVictory && targetUser.state.resources) {
                        // Steal 10% of current resources, capped by capacity
                        let capacity = totalCapacity;
                        const targets = ['gold', 'wood', 'food', 'wine', 'marble'];

                        for (const resType of targets) {
                            if (capacity <= 0) break;
                            const avail = targetUser.state.resources[resType] || 0;
                            const steal = Math.min(avail, Math.floor(capacity / targets.length), Math.floor(avail * 0.2));

                            if (steal > 0) {
                                loot[resType] = (loot[resType] || 0) + steal;
                                targetUser.state.resources[resType] -= steal; // Deduct from defender

                                // Add to attacker (Standard Player)
                                if (body.source !== 'fortress') {
                                    attackerData.state.resources[resType] = (attackerData.state.resources[resType] || 0) + steal;
                                }
                                capacity -= steal;
                            }
                        }
                    }
                }

                // 7. Save Defender (Target)
                // Only save if it's a REAL player (not NPC and not Fortress)
                if (targetType !== 'npc' && targetType !== 'fortress') {
                    fs.writeFileSync(getUserFilePath(targetUser.profile.username), JSON.stringify(targetUser, null, 2));
                }

                // 8. Save Attacker
                fs.writeFileSync(attackerPath, JSON.stringify(attackerData, null, 2));

                // 9. Generate Reports
                // 9. Generate Reports
                // Attacker Report
                const reportId = Date.now().toString();

                // Get Defender Army for Report
                let defenderArmyReport = {};
                if (targetType === 'fortress') {
                    defenderArmyReport = targetUser.clanData.fortress.garrison || {};
                } else if (targetUser.state && targetUser.state.army) {
                    defenderArmyReport = targetUser.state.army;
                }

                // Explicitly check for username
                const enemyName = targetUser.profile && targetUser.profile.username ? targetUser.profile.username : (targetEntity.name || "Unknown");

                const attackReport = {
                    id: reportId,
                    type: 'battle',
                    title: isVictory ? `Victory vs ${enemyName}` : `Defeat vs ${enemyName}`,
                    timestamp: Date.now(),
                    enemy: enemyName,
                    victory: isVictory,
                    loot: loot,
                    casualties: casualties,
                    coords: { x: targetX, y: targetY },
                    params: {
                        attackerName: attacker,
                        defenderName: enemyName
                    },
                    // Add Detailed Stats for Client UI
                    data: { // Client uses 'data' property for detailed view? Check mailbox.js
                        winner: isVictory, // Mailbox check
                        enemy: enemyName,
                        enemyLevel: (targetType === 'fortress' ? (targetUser.clanData.fortress.level || 1) : (targetEntity.level || 1)),
                        defenderArmy: defenderArmyReport,
                        defenderPower: Math.floor(defensePower),
                        loot: loot,
                        unitsLost: casualties,
                        unitsReturned: {} // TODO: Calculate returned
                    },
                    isUnread: true
                };

                // Defender Report (Only for real players)
                if (targetType !== 'npc' && targetType !== 'fortress') {
                    const defReport = {
                        id: reportId + '_def',
                        type: 'battle',
                        title: isVictory ? `Defeat by ${attacker}` : `Defended against ${attacker}`,
                        timestamp: Date.now(),
                        enemy: attacker,
                        victory: !isVictory, // Inverse
                        loot: { ...loot }, // Lost loot
                        casualties: {}, // Not tracking defender losses yet
                        coords: { x: targetX, y: targetY },
                        params: {
                            attackerName: attacker,
                            defenderName: targetUser.profile.username
                        },
                        isUnread: true
                    };

                    if (!targetUser.state) targetUser.state = {};
                    if (!targetUser.state.reports) targetUser.state.reports = [];
                    targetUser.state.reports.unshift(defReport);
                    // Re-save defender with report
                    fs.writeFileSync(getUserFilePath(targetUser.profile.username), JSON.stringify(targetUser, null, 2));
                }


                console.log(`[BATTLE_DEBUG] Sending response with casualties:`, casualties);
                console.log(`[BATTLE_DEBUG] Report data:`, attackReport.data);
                sendJSON(res, 200, {
                    success: true,
                    victory: isVictory,
                    casualties: casualties,
                    loot: loot,
                    report: attackReport
                });

            } catch (err) {
                console.error('Error in /api/attack:', err);
                sendJSON(res, 500, { success: false, message: 'Battle Error' });
            }
        });

    } else if (req.url === '/api/territory/upgrade' && req.method === 'POST') {
        readBody(req, (body) => {
            try {
                const { username, x, y } = body;

                if (!username || x === undefined || y === undefined) {
                    return sendJSON(res, 400, { success: false, message: 'Missing required fields' });
                }

                const filePath = getUserFilePath(username);
                if (!fs.existsSync(filePath)) {
                    return sendJSON(res, 404, { success: false, message: 'User not found' });
                }

                const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const state = userData.state;

                if (!state.mapEntities) {
                    return sendJSON(res, 400, { success: false, message: 'No territories' });
                }

                const key = `${x},${y}`;
                const territory = state.mapEntities[key];

                if (!territory || territory.owner !== username) {
                    return sendJSON(res, 400, { success: false, message: 'You do not own this territory' });
                }

                const currentLevel = territory.level || 1;

                if (currentLevel >= 10) {
                    return sendJSON(res, 400, { success: false, message: 'Territory already at max level' });
                }

                // Calculate upgrade cost (exponential)
                const nextLevel = currentLevel + 1;
                const multiplier = Math.pow(2, nextLevel - 1);
                const cost = {
                    gold: 10000 * multiplier,
                    wood: 8000 * multiplier,
                    food: 5000 * multiplier,
                    wine: 3000 * multiplier,
                    marble: 2000 * multiplier,
                    crystal: 1500 * multiplier,
                    sulfur: 1000 * multiplier
                };

                // Check if player has enough resources
                const resources = state.resources || {};
                for (const [resource, amount] of Object.entries(cost)) {
                    if ((resources[resource] || 0) < amount) {
                        return sendJSON(res, 400, {
                            success: false,
                            message: `Insufficient ${resource}. Need ${amount}, have ${resources[resource] || 0}`
                        });
                    }
                }

                // Deduct resources
                for (const [resource, amount] of Object.entries(cost)) {
                    state.resources[resource] -= amount;
                }

                // Upgrade level
                territory.level = nextLevel;

                // Save
                fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

                sendJSON(res, 200, {
                    success: true,
                    newLevel: nextLevel,
                    territory: territory,
                    resources: state.resources
                });

            } catch (err) {
                console.error('Error upgrading territory:', err);
                sendJSON(res, 500, { success: false, message: err.message });
            }
        });
    } else {
        // Static Files
        serveStatic(req, res);
    }
});

server.listen(PORT, () => {
    console.log(`Vikings Native Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`DEPLOYMENT TRIGGER: ${new Date().toISOString()} - FORCE UPDATE`);
});
