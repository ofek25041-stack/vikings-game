/**
 * Game State & Logic (v1.1.1)
 */
console.log("%c Vikings Client v1.1.2 LOADED ", "background: #22c55e; color: #fff; font-size: 1.2em; padding: 4px; border-radius: 4px;");
window.VERSION_CHECK = 'v1.1.2';

// --- CONFIG ---
window.onerror = function (msg, url, line, col, error) {
    const errorMsg = `שגיאת מערכת: ${msg} (שורה ${line})`;
    console.error(errorMsg, error);
    // Try to notify if function exists, else alert
    if (typeof notify === 'function') {
        notify(errorMsg, 'error');
    } else {
        alert(errorMsg);
    }
    return false;
};

// Default Init State Template
// Default Init State Template
const DEFAULT_STATE = {
    resources: {
        gold: 100, wood: 100, food: 100, wine: 0, marble: 0, crystal: 0, sulfur: 0, citizens: 50
    },
    // Tracking statistics
    stats: { battles: 0, wins: 0, losses: 0 },
    // World Map 2.0 State
    viewport: { x: 500, y: 500 }, // Center of the world
    homeCoords: { x: 500, y: 500 }, // Where my city is

    // Flattened Entity Map: "x,y" => Object
    // We use a Map-like object for easy lookup
    mapEntities: {
        // "500,500": { type: 'city', name: 'Sparta', user: 'System', level: 1 }
    },

    // Shared Tech/Buildings (same as before)
    buildings: {
        townHall: { level: 1, name: 'בית העירייה', costFactor: 1.5, baseCost: { wood: 50, marble: 0 }, description: "מנהל את העיר והתושבים" },
        academy: { level: 0, name: 'אקדמיה', costFactor: 1.5, baseCost: { wood: 100, crystal: 50 }, description: "מאפשר מחקר טכנולוגיות חדשות" },
        warehouse: { level: 0, name: 'מחסן', costFactor: 1.3, baseCost: { wood: 100, marble: 50 }, description: "מגדיל את קיבולת המשאבים" },
        barracks: { level: 0, name: 'בסיס צבאי', costFactor: 1.5, baseCost: { wood: 150, marble: 50 }, description: "מאפשר אימון חיילים שונים" },
        port: { level: 0, name: 'נמל מסחרי', costFactor: 1.4, baseCost: { wood: 200, marble: 100 }, description: "מאפשר מסחר עם ערים אחרות" },
        wall: { level: 0, name: 'חומה', costFactor: 1.6, baseCost: { marble: 200, wood: 100 }, description: "מגנה על העיר מפני התקפות" },
        // Resource Buildings (New)
        lumber: { level: 1, name: 'מנסרה', costFactor: 1.5, baseCost: { wood: 50, gold: 50 }, description: "מייצרת עצים לבנייה (Lumber)" },
        mine: { level: 1, name: 'מכרה', costFactor: 1.5, baseCost: { wood: 100, gold: 100 }, description: "מכרה אבנים ומתכות יקרות" }
    },
    army: {
        spearman: 0, archer: 0, swordsman: 0,
        mountedRaider: 0, heavyCavalry: 0, mountedArcher: 0,
        berserker: 0, shieldWall: 0, dualWielder: 0,
        catapult: 0, batteringRam: 0, ballista: 0
    },
    research: { architecture: 0, weaponry: 0, defense: 0, logistics: 0 },
    timers: [],
    city: { population: 10, happiness: 100 }
};

// Current Active State
let STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));
let CURRENT_USER = null;
window.activeView = 'login'; // Initialize global view state

// --- World Map 2.0 Logic ---

// Configuration for Viewport - Optimized for multiplayer
const VIEW_COLS = 100; // 100x100 tiles - good balance
const VIEW_ROWS = 100; // 100x100 tiles - good balance
const TILE_SIZE = 30; // 30x30 Pixels

function ensureCityExistsAndRender() {


    // 0. SELF-HEALING: Remove corrupted "undefined's city" entities from local storage/state
    if (STATE.mapEntities) {
        for (const [k, ent] of Object.entries(STATE.mapEntities)) {
            // Check for the specific bug signature
            // DEBUG: Disabled cleanup to allow fortress to show even if bugged as city
            /*
            if (ent && ent.name === "undefined's City") {
                console.warn(`🧹 Cleaning up corrupted entity at ${k}:`, ent);
                delete STATE.mapEntities[k];
            }
            */
            // Check for fortress overwrite signature (City at known fortress location)
            // CRITICAL: Don't delete actual fortresses!
            if (ent && ent.type === 'city' && ent.isMyCity && k !== `${STATE.homeCoords.x},${STATE.homeCoords.y}`) {
                // If it claims to be MY city but isn't at MY home coords... it's a ghost.
                // Unless I have multiple cities? (Not in this game version).
                console.warn(`🧹 Cleaning up ghost city at ${k} (Home is ${STATE.homeCoords.x},${STATE.homeCoords.y})`);
                delete STATE.mapEntities[k];
            }
            // NEW: Never delete fortresses during cleanup!
            if (ent && ent.type === 'fortress') {
                console.log(`🏰 Preserving fortress at ${k} during cleanup`);
            }
        }
    }

    // 1. Validate Home Coords
    if (!STATE.homeCoords || typeof STATE.homeCoords.x !== 'number') {
        console.warn("Home coords missing! Resetting to default.");
        STATE.homeCoords = { x: 500, y: 500 };
    }

    const key = `${STATE.homeCoords.x},${STATE.homeCoords.y}`;
    let city = STATE.mapEntities[key];

    // 2. Ensure Entity Exists
    // CRITICAL: Do NOT overwrite a Fortress if we happen to reside there (or if logic overlaps)
    if (city && city.type === 'fortress') {
        return;
    }

    if (!city || city.type !== 'city' || !city.isMyCity) {
        console.warn("City entity missing or corrupted! Re-creating.");
        STATE.mapEntities[key] = {
            type: 'city',
            name: `${CURRENT_USER || 'My'}'s City`, // Default name with fallback
            user: CURRENT_USER,
            level: STATE.buildings?.townHall?.level || 1,
            isMyCity: true,
            lastLogin: Date.now()
        };
        // Save immediately to fix storage
        saveGame();

    }

    // Don't auto-center viewport here - let the caller decide

}

// Load territories from all players
async function loadAllTerritories() {
    try {
        const response = await fetch('/api/territories?t=' + Date.now());
        const data = await response.json();

        if (data.success && data.territories) {
            console.log(`📍 Loaded ${Object.keys(data.territories).length} territories from server`);

            // Merge server territories with local mapEntities
            for (const [key, territory] of Object.entries(data.territories)) {
                // CRITICAL: Always load fortresses (they belong to clans, not individual users)
                // Only skip the user's own city (which is already managed locally)
                if (territory.type === 'fortress' || territory.owner !== CURRENT_USER) {
                    STATE.mapEntities[key] = territory;
                }
            }
        }
    } catch (err) {
        console.error('Failed to load territories:', err);
    }
}

function renderWorldMap() {
    // Hook for True Scrollable Map
    // Hook for True Scrollable Map
    /* 
    if (typeof window.initScrollableMap === 'function') {
        const grid = document.getElementById('world-map-grid');

        // Check if initialized (has attribute we set in scrollable_map.js)
        const viewport = document.getElementById('world-map-viewport');
        if (viewport && !viewport.getAttribute('data-init-done')) {
            console.log("🗺️ First Time Init from main.js");
            window.initScrollableMap();
            viewport.setAttribute('data-init-done', 'true');
        } else {
            // Already initialized, just force re-render to be safe
            // console.log("🗺️ Re-render from main.js");
            if (typeof window.renderVisibleArea === 'function') {
                window.renderVisibleArea();
            }
        }
        return; // Stop legacy render
    }
    */

    const grid = document.getElementById('world-map-grid');
    if (!grid) return;

    // Ensure player's city exists in mapEntities before rendering
    if (CURRENT_USER) {
        ensureCityExistsAndRender();
    }

    // Preserve march visualization layers before clearing
    const linesLayer = document.getElementById('march-lines-layer');
    const armiesLayer = document.getElementById('march-armies-layer');

    grid.innerHTML = ''; // Clear tiles

    // Restore march layers
    if (linesLayer) grid.appendChild(linesLayer);
    if (armiesLayer) grid.appendChild(armiesLayer);


    // Center on Player or last viewport
    const centerX = (!STATE.viewport || (STATE.viewport.x === 0 && STATE.viewport.y === 0)) ? (STATE.homeCoords?.x || 500) : STATE.viewport.x;
    const centerY = (!STATE.viewport || (STATE.viewport.x === 0 && STATE.viewport.y === 0)) ? (STATE.homeCoords?.y || 500) : STATE.viewport.y;

    // Update HUD
    const hudX = document.getElementById('map-x'); const hudY = document.getElementById('map-y');
    if (hudX) hudX.innerText = centerX; if (hudY) hudY.innerText = centerY;

    const startX = centerX - Math.floor(VIEW_COLS / 2);
    const startY = centerY - Math.floor(VIEW_ROWS / 2);

    const fragment = document.createDocumentFragment();

    for (let y = 0; y < VIEW_ROWS; y++) {
        for (let x = 0; x < VIEW_COLS; x++) {
            // TERRAIN GENERATION (Simplified Hash)
            const globalX = startX + x;
            const globalY = startY + y;
            const hash = Math.sin(globalX * 12.9898 + globalY * 78.233) * 43758.5453 - Math.floor(Math.sin(globalX * 12.9898 + globalY * 78.233) * 43758.5453);

            let terrain = 'water';
            if (hash < 0.15) terrain = 'grass';
            else if (hash < 0.22) terrain = 'forest';
            else if (hash < 0.27) terrain = 'mountain';
            else if (hash < 0.3) terrain = 'desert';

            // ENTITIES
            const key = `${globalX},${globalY}`;
            let entity = STATE.mapEntities[key];
            if (!entity) entity = generateVirtualEntity(globalX, globalY, terrain); // FIXED: Pass terrain!

            // Skip monsters and NPC cities
            if (entity && (entity.type === 'monster' || (entity.type === 'city' && entity.user === 'NPC'))) {
                entity = null;
            }

            // SPARSE LOGIC: Skip empty water
            if (terrain === 'water' && !entity) {
                continue;
            }

            const tile = document.createElement('div');
            tile.className = `map-tile tile-${terrain}`;
            tile.style.left = `${x * TILE_SIZE}px`;
            tile.style.top = `${y * TILE_SIZE}px`;

            // Round City Style
            if (entity && entity.type === 'city') {
                tile.classList.add('tile-city-container');
            }

            if (entity) {
                const div = document.createElement('div');
                div.classList.add('map-entity', `entity-${entity.type}`);
                if (entity.isMyCity) div.classList.add('entity-my-city');
                if (entity.owner === CURRENT_USER && entity.type !== 'city') div.classList.add('entity-owned');

                // Check if same clan - SIMPLIFIED
                if (STATE.clan && STATE.clan.id && entity.clanTag) {
                    // Get my clan tag from ALL_CLANS
                    const myClan = window.ALL_CLANS?.[STATE.clan.id];
                    if (myClan && myClan.tag === entity.clanTag && entity.user !== CURRENT_USER) {
                        div.classList.add('entity-clan-member');

                    }
                }

                // Special rendering for fortress (2x2)
                if (entity.type === 'fortress') {
                    // Only render visual on top-left tile
                    if (entity.isCenter) {
                        div.classList.add('fortress-entity');
                        div.style.width = '60px';  // 2 tiles wide
                        div.style.height = '60px'; // 2 tiles tall
                        div.style.zIndex = '10';

                        const isMyClan = STATE.clan && STATE.clan.id === entity.clanId;
                        if (isMyClan) div.classList.add('entity-my-fortress');

                        div.innerHTML = `
                            <div class="fortress-icon">🏯</div>
                            <div class="entity-label">
                                <div class="name">[${entity.clanTag}] Fortress</div>
                            </div>
                        `;

                        div.onclick = (e) => {
                            e.stopPropagation();
                            if (isMyClan) {
                                // Open fortress UI
                                switchView('clan');
                                setTimeout(() => ClanUI.switchTab('fortress'), 100);
                            } else {
                                // Allow interaction (Profile/Attack)
                                interactEntity(globalX, globalY, entity);
                            }
                        };
                    } else {
                        // Other 3 tiles are just markers (invisible but block clicks)
                        div.style.opacity = '0';
                        div.style.pointerEvents = 'none';
                    }
                } else {
                    // Normal entity rendering (city, resource, etc.)
                    const tagHtml = entity.clanTag ? `<span style="color:#fbbf24; font-weight:bold;">[${entity.clanTag}]</span> ` : '';
                    const ownerHtml = (entity.owner && entity.owner !== CURRENT_USER && entity.type !== 'city') ? `<div style="font-size:0.65rem; color:#10b981;">🏴 ${entity.owner}</div>` : '';

                    div.innerHTML = `
                        <div class="entity-icon">${getEntityIcon(entity.type)}</div>
                        <div class="entity-label">
                            <div class="name">${tagHtml}${entity.name || entity.type}</div>
                            <span class="lvl">Lv.${entity.level || 1}</span>
                            ${ownerHtml}
                        </div>
                    `;

                    div.onclick = (e) => {
                        e.stopPropagation();
                        interactEntity(globalX, globalY, entity);
                    };
                }

                tile.appendChild(div);
            }

            fragment.appendChild(tile);
        }
    }

    grid.appendChild(fragment);

    // Center map initially if first load
    // setTimeout(initMobileScroll, 100); // Handled by switchView
}

window.jumpToCoords = function (targetX, targetY) {
    const xInput = document.getElementById('nav-x');
    const yInput = document.getElementById('nav-y');

    let x, y;

    // If arguments provided, use them. Otherwise read from inputs.
    if (targetX !== undefined && targetY !== undefined) {
        x = parseInt(targetX);
        y = parseInt(targetY);
        // Also update the UI inputs to match
        if (xInput) xInput.value = x;
        if (yInput) yInput.value = y;
    } else {
        x = parseInt(xInput.value);
        y = parseInt(yInput.value);
    }

    console.log('🚀 jumpToCoords called');
    console.log(`🚀 Inputs: X="${xInput ? xInput.value : 'N/A'}" Y="${yInput ? yInput.value : 'N/A'}"`);
    console.log(`🚀 Parsed: X=${x} Y=${y}`);

    if (isNaN(x) || isNaN(y)) {
        notify("נא להזין קואורדינטות", "error");
        return;
    }

    if (!STATE.viewport) STATE.viewport = { x: 500, y: 500 };
    STATE.viewport.x = x;
    STATE.viewport.y = y;

    renderWorldMap();
    notify(`קפצת אל: ${x}, ${y}`, "success");
};

// NEW: Just switch view and fill inputs, DO NOT JUMP/RENDER
window.navigateToMapSearch = function (x, y) {
    // Use window.activeView to avoid ReferenceError
    // Use 'world' instead of 'map' to match switchView logic
    if (window.activeView !== 'world') {
        switchView('world');
    }

    // Wait for DOM
    setTimeout(() => {
        const xInput = document.getElementById('nav-x');
        const yInput = document.getElementById('nav-y');
        if (xInput) xInput.value = x;
        if (yInput) yInput.value = y;
        notify("אנא לחץ על 'חפש' כדי להגיע ליעד", "info");
    }, 100);
};


function moveMap(dx, dy) {
    STATE.viewport.x += dx;
    STATE.viewport.y += dy;
    renderWorldMap();
}

function centerMapOnHome() {
    if (STATE.homeCoords) {
        STATE.viewport = { ...STATE.homeCoords };

        // CRITICAL FIX: Must re-render map because we might be far away!
        renderWorldMap();

        requestAnimationFrame(() => {
            const container = document.getElementById('world-map-viewport');

            // OPTIMIZATION: Use scrollIntoView for perfect native centering
            const myCityEl = document.querySelector('.entity-my-city');

            if (myCityEl) {
                myCityEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });

            } else if (container) {
                // Fallback: Geometric Center
                container.scrollTo({
                    top: (container.scrollHeight - container.clientHeight) / 2,
                    left: (container.scrollWidth - container.clientWidth) / 2,
                    behavior: 'auto'
                });
            }
        });
    }
}

function centerMapOnFortress() {
    // Check if player is in a clan
    if (!STATE.clan || !STATE.clan.id) {
        notify('אתה לא שייך לקלאן', 'error');
        return;
    }

    // Get clan data
    const clan = window.ALL_CLANS[STATE.clan.id];

    // Check if fortress exists with coordinates
    if (!clan || !clan.fortress || clan.fortress.x === undefined || clan.fortress.y === undefined) {
        notify('לקלאן שלך אין מבצר', 'error');
        return;
    }

    // Use setTimeout to detach from the click event and ensure DOM is ready
    setTimeout(() => {
        const x = parseInt(clan.fortress.x);
        const y = parseInt(clan.fortress.y);

        if (!isNaN(x) && !isNaN(y)) {
            // Pass coordinates directly to the function
            // This bypasses any DOM input issues
            window.jumpToCoords(x, y);
            console.log(`🏰 Jumping directly to coords: ${x}, ${y}`);
        } else {
            notify('לקלאן שלך אין מבצר עם קואורדינטות תקינות', 'error');
        }
    }, 50); // Small delay to clear event stack
}



// Disable browser remembering scroll position to prevent "Jumps" on reload
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Update fortress button visibility based on clan status
function updateFortressButton() {
    console.log('🏰 updateFortressButton called');
    const btn = document.getElementById('btn-fortress-nav');
    if (!btn) {
        console.log('🏰 Button element NOT FOUND!');
        return;
    }

    // Show button only if player is in clan with fortress
    // Check for fortress.x and fortress.y (actual structure from server)
    const hasClanWithFortress = STATE.clan && STATE.clan.id &&
        window.ALL_CLANS[STATE.clan.id]?.fortress &&
        window.ALL_CLANS[STATE.clan.id]?.fortress.x !== undefined &&
        window.ALL_CLANS[STATE.clan.id]?.fortress.y !== undefined;

    console.log('🏰 Check results:', {
        hasClan: !!STATE.clan,
        clanId: STATE.clan?.id,
        clanData: window.ALL_CLANS[STATE.clan?.id],
        fortress: window.ALL_CLANS[STATE.clan?.id]?.fortress,
        fortressX: window.ALL_CLANS[STATE.clan?.id]?.fortress?.x,
        fortressY: window.ALL_CLANS[STATE.clan?.id]?.fortress?.y,
        willShow: hasClanWithFortress
    });

    btn.style.display = hasClanWithFortress ? 'inline-block' : 'none';
    console.log('🏰 Button display set to:', btn.style.display);
}

// Pseudo-Random Deterministic Noise for Terrain
function getTerrainType(x, y) {
    // Simple hash function
    const val = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const hash = val - Math.floor(val);

    if (hash > 0.8) return 'mountain';
    if (hash > 0.7) return 'forest';
    if (hash > 0.6) return 'desert'; // Rare patches
    return 'grass'; // Default
}

// Deterministic Entity Generation (Resources, Barbarians)
// Deterministic Entity Generation (Resources, Barbarians)
window.generateVirtualEntity = function (x, y, terrain) {
    // Don't generate on home coords (handled by STATE)
    if (x === 500 && y === 500) return null; // Safety


    // Hash function - IMPROVED for uniform distribution across ENTIRE map
    // Uses multiple prime frequencies to avoid clustering
    const seed1 = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    const seed2 = Math.cos(x * 269.5 + y * 183.3) * 12345.6789;
    const hash = Math.abs((seed1 + seed2) - Math.floor(seed1 + seed2));


    // RESOURCES: 15% total chance
    if (hash < 0.15) {
        // Distribute types based on terrain AND hash ranges

        // Mountains: Gold mines (4%) or Marble quarries (3%)
        if (terrain === 'mountain') {
            if (hash < 0.06) return { type: 'mine', resource: 'gold', name: 'מכרה זהב', level: Math.floor(hash * 100) % 5 + 1 };
            if (hash < 0.09) return { type: 'quarry', resource: 'marble', name: 'מחצבת שיש', level: Math.floor(hash * 100) % 4 + 1 };
        }

        // Forests: Wood camps (5%)
        if (terrain === 'forest') {
            if (hash < 0.08) return { type: 'wood', resource: 'wood', name: 'מחנה חוטבים', level: Math.floor(hash * 100) % 5 + 1 };
        }

        // Desert: Sulfur mines (2%) or Crystal caves (1%)
        if (terrain === 'desert') {
            if (hash < 0.05) return { type: 'mine', resource: 'sulfur', name: 'מכרה גופרית', level: Math.floor(hash * 100) % 3 + 1 };
            if (hash < 0.06) return { type: 'fountain', resource: 'crystal', name: 'מערת קריסטל', level: Math.floor(hash * 100) % 3 + 1 };
        }

        // Grass: Food fields (6%), Wine vineyards (3%)
        if (terrain === 'grass') {
            if (hash < 0.09) return { type: 'field', resource: 'food', name: 'שדה חיטה', level: Math.floor(hash * 100) % 5 + 1 };
            if (hash < 0.12) return { type: 'farm', resource: 'wine', name: 'כרם ענבים', level: Math.floor(hash * 100) % 4 + 1 };
        }

        // Fallback: random resource if no terrain match
        const randType = hash * 6;
        if (randType < 1) return { type: 'field', resource: 'food', name: 'שדה חיטה', level: 1 };
        if (randType < 2) return { type: 'wood', resource: 'wood', name: 'מחנה חוטבים', level: 1 };
        if (randType < 3) return { type: 'mine', resource: 'gold', name: 'מכרה זהב', level: 1 };
        if (randType < 4) return { type: 'farm', resource: 'wine', name: 'כרם ענבים', level: 1 };
        if (randType < 5) return { type: 'quarry', resource: 'marble', name: 'מחצבת שיש', level: 1 };
        return { type: 'fountain', resource: 'crystal', name: 'מערת קריסטל', level: 1 };
    }

    // Monsters and NPC cities removed per user request
    return null;
}

const MAX_TRAVEL_TIME = 120; // Seconds

function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function calculateTravelTime(x, y) {
    const home = STATE.homeCoords || { x: 500, y: 500 };
    const dist = calculateDistance(home.x, home.y, x, y);
    // Formula: 2 seconds per tile, min 1s, max 120s
    return Math.max(1, Math.min(MAX_TRAVEL_TIME, Math.floor(dist * 2)));
}


function getEntityIcon(type) {
    switch (type) {
        case 'city': return '🏰';
        case 'fortress': return '🏯';
        case 'mine': return '⛏️';
        case 'wood': return '🌲';
        case 'farm': return '🍇';
        case 'field': return '🌾';
        case 'quarry': return '🪨';
        case 'monster': return '⛺';
        case 'fountain': return '💎';
        default: return '❓';
    }
}


function calculateScore(entity) {
    if (entity.isMyCity) {
        // Calculate based on REAL stats
        let score = 0;
        // Buildings
        Object.values(STATE.buildings).forEach(b => score += b.level * 100);
        // Army
        Object.values(STATE.army).forEach(c => score += c * 5);
        // Research
        Object.values(STATE.research).forEach(l => score += l * 200);
        return score;
    } else {
        // Evaluate NPC
        return (entity.level || 1) * 1500 + (entity.wins || 0) * 50;
    }
}

function formatLastLogin(timestamp) {
    if (!timestamp) return 'לא ידוע';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 10) return 'מחובר כעת';
    if (hours < 1) return `לפני ${minutes} דקות`;
    if (days < 1) return `לפני ${hours} שעות`;
    return `לפני ${days} ימים`;
}

function interactEntity(x, y, entity) {


    // CRITICAL FIX: Ensure procedurally generated entities are saved to state
    // so that attackEntity/mission logic can find them by coordinates.
    const key = `${x},${y}`;
    if (!STATE.mapEntities[key]) {
        STATE.mapEntities[key] = entity;

    } else {
        // ALWAYS use the state version as source of truth to avoid stale closures
        entity = STATE.mapEntities[key];
    }



    // Extract REAL grid coordinates (not viewport coordinates)
    let realX = x;
    let realY = y;



    // For cities, use homeCoords if available
    if (entity.type === 'city' && entity.homeCoords) {
        realX = entity.homeCoords.x;
        realY = entity.homeCoords.y;

    } else if (entity.type === 'fortress' && entity.fortressX !== undefined) {
        realX = entity.fortressX;
        realY = entity.fortressY;

    } else {
        // Try to find real coordinates from mapEntities
        for (const [coordKey, ent] of Object.entries(STATE.mapEntities)) {
            if (ent === entity || (ent.name === entity.name && ent.type === entity.type)) {
                const [foundX, foundY] = coordKey.split(',').map(Number);
                if (!isNaN(foundX) && !isNaN(foundY) && foundX >= 0 && foundX < 60 && foundY >= 0 && foundY < 60) {
                    realX = foundX;
                    realY = foundY;

                    break;
                }
            }
        }
    }



    if (entity.type === 'city') {
        const score = calculateScore(entity);
        const lastSeen = entity.isMyCity ? 'מחובר כעת' : formatLastLogin(entity.lastLogin);

        // Fix: Use STATE.stats for own city, entity properties for others
        const wins = entity.isMyCity ? (STATE.stats?.wins || 0) : (entity.wins || 0);
        const losses = entity.isMyCity ? (STATE.stats?.losses || 0) : (entity.losses || 0);

        // PROFILE VIEW
        const html = `
            <div class="profile-card" style="display:flex; flex-direction:column; gap:12px;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <div style="font-size:3rem; margin-bottom:5px;">${getEntityIcon(entity.type)}</div>
                    <h2 style="color:#fbbf24; margin:0;">${entity.user || 'Unknown'}</h2>
                    <p style="color:#94a3b8; font-size:0.9rem;">${entity.name}</p>
                    <p style="color:#64748b; font-size:0.85rem; margin: 5px 0 0 0;">📍 (${realX}, ${realY})</p>
                    
                    <div style="margin-top:10px; display:inline-block; background:rgba(255,255,255,0.1); padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.9rem;">
                        ניקוד: <span style="color:#fff;">${score.toLocaleString()}</span> 🏆
                    </div>
                </div>

                <!-- Stats Grid -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
                        <span style="display:block; font-size:1.2rem;">⚔️</span>
                        <span style="color:#ef4444; font-weight:bold;">${wins}</span> נצחונות
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
                        <span style="display:block; font-size:1.2rem;">🛡️</span>
                        <span style="color:#ef4444; font-weight:bold;">${losses}</span> הפסדים
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
                        <span style="display:block; font-size:1.2rem;">🏛️</span>
                        רמה <span style="color:#fbbf24;">${entity.level || 1}</span>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
                        <span style="display:block; font-size:1.2rem;">🕒</span>
                        <span style="font-size:0.8rem;">${lastSeen}</span>
                    </div>
                </div>

                ${entity.isMyCity ?
                `<button class="btn-primary" onclick="switchView('city')">כנס לעיר</button>` :
                `<div class="actions-row" style="display:flex; gap:8px; margin-top:5px;">
                        <button class="btn-primary" style="flex:1; background: linear-gradient(135deg, #ef4444, #b91c1c);" onclick="notify('המרגלים שלך יצאו לדרך...', 'success')">🕵️ ריגול</button>
                        ${(() => {
                    // Check for friendly fire (same clan)
                    let canAttack = true;
                    if (STATE.clan && window.ALL_CLANS && window.ALL_CLANS[STATE.clan.id]) {
                        const clan = window.ALL_CLANS[STATE.clan.id];
                        // Check if target is a member of my clan
                        if (clan.members && clan.members[entity.user]) {
                            canAttack = false;
                        }
                    }

                    if (canAttack) {
                        return `<button class="btn-primary" style="flex:1; background: linear-gradient(135deg, #f59e0b, #d97706);" onclick="attackEntity(${realX}, ${realY})">⚔️ התקף</button>`;
                    } else {
                        return `<button class="btn-primary" style="flex:1; background: #94a3b8; cursor: not-allowed;" onclick="notify('לא ניתן לתקוף חבר קלאן!', 'error')">🛡️ חבר קלאן</button>`;
                    }
                })()}
                    </div>
                    <div style="margin-top:5px;">
                         <button class="btn-primary" style="width:100%; background: linear-gradient(135deg, #8b5cf6, #7c3aed);" onclick="openMessageModal('${entity.user}')">💬 שלח הודעה</button>
                    </div>
                    ${(() => {
                    // Clan invitation button for leaders
                    if (STATE.clan && window.ALL_CLANS && window.ALL_CLANS[STATE.clan.id]) {
                        const clan = window.ALL_CLANS[STATE.clan.id];
                        const myRole = clan.members?.[CURRENT_USER]?.role;
                        const targetUser = entity.user;

                        // Check if target is not in my clan
                        const targetNotInMyClan = !clan.members?.[targetUser];

                        if (myRole === 'leader' && targetNotInMyClan && targetUser && targetUser !== 'NPC') {
                            return `
                                <button class="btn-primary" style="margin-top:8px; background: linear-gradient(135deg, #10b981, #059669);" 
                                        onclick="invitePlayerToClan('${targetUser}')">
                                    📩 הזמן לקלאן
                                </button>
                            `;
                        }
                    }
                    return '';
                })()}
                    ${(() => {
                    // Add fortress attack button for leader
                    if (STATE.clan && window.ALL_CLANS && window.ALL_CLANS[STATE.clan.id]) {
                        const clan = window.ALL_CLANS[STATE.clan.id];
                        const myRole = clan.members?.[CURRENT_USER]?.role;
                        if (myRole === 'leader' && clan.fortress) {
                            return `<button class="btn-primary" style="margin-top:8px; background: linear-gradient(135deg, #7c3aed, #5b21b6);" onclick="closeModal(); ClanUI.attackFromFortress(${realX}, ${realY}, 'city')">🏰 תקוף מהמבצר</button>`;
                        }
                    }
                    return '';
                })()}`
            }
            </div>
        `;

        const title = entity.isMyCity ? "העיר שלי" : "פרופיל שחקן";
        openModal(title, html, "סגור", closeModal);

    } else if (entity.type === 'fortress') {
        const clanId = entity.clanId;
        const clanTag = entity.clanTag || '???';
        const level = entity.level || 1;

        let canAttack = true;
        if (STATE.clan && STATE.clan.id === clanId) {
            canAttack = false;
        }

        // Check if player is a clan leader with a fortress
        const playerClan = STATE.clan && STATE.clan.id ? window.ALL_CLANS[STATE.clan.id] : null;
        const myRole = playerClan?.members?.[CURRENT_USER]?.role;
        const isLeader = myRole === 'leader';

        // Check both garrison (new) and troops (old) for backward compatibility
        const garrison = playerClan?.fortress?.garrison || playerClan?.fortress?.troops || {};
        const garrisonTotal = garrison.total || Object.values(garrison).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        const hasFortress = playerClan && playerClan.fortress && garrisonTotal > 0;


        const html = `
            <div class="profile-card" style="text-align:center; padding:20px;">
                <div style="font-size:4rem; margin-bottom:10px;">🏰</div>
                <h2 style="color:#a78bfa; margin:0;">מבצר קלאן [${clanTag}]</h2>
                <p style="color:#94a3b8; margin:5px 0;">שייך לקלאן הקודש</p>
                <div style="margin:15px 0; background:rgba(255,255,255,0.1); padding:10px; border-radius:8px;">
                     <strong>רמה: ${level}</strong>
                     <br>
                     <span style="font-size:0.9rem; color:#cbd5e1;">הגנה מוגברת ב-5%</span>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                    ${canAttack ?
                `<button class="btn-primary" style="background: linear-gradient(135deg, #ef4444, #b91c1c);" onclick="attackEntity(${realX}, ${realY})">⚔️ פשיטה על המבצר</button>` :
                `<button class="btn-primary" style="background:#475569; cursor:not-allowed;">🛡️ המבצר שלך</button>`
            }
                    ${isLeader && hasFortress && canAttack ?
                `<button class="btn-primary" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);" onclick="closeModal(); ClanUI.attackFromFortress(${realX}, ${realY}, 'fortress')">🏰 תקוף מהמבצר שלך</button>` :
                ''
            }
                </div>
            </div>
        `;

        openModal(`מבצר [${clanTag}]`, html, "סגור", closeModal);

    } else if (['mine', 'wood', 'farm', 'field', 'quarry', 'crystal', 'fountain', 'monster'].includes(entity.type)) {
        if (entity.type === 'monster') {
            // PVE
            openModal(entity.name, `
                <div style="text-align:center">
                    <div style="font-size:3rem; margin-bottom:10px;">⚔️</div>
                    <p>כוחות אויב זוהו באזור זה. הבס אותם כדי לזכות באוצרות.</p>
                    <div style="background:#450a0a; padding:10px; margin:10px 0; border-radius:8px; border:1px solid #ef4444;">
                        <strong>רמת סיכון: ${entity.level}</strong>
                    </div>
                    <button class="btn-primary" style="background:#ef4444" onclick="attackEntity(${x}, ${y})">⚔️ צא לקרב</button>
                </div>
            `, "נסוג", closeModal);
        } else {
            // Resource Gathering - New UI - NOW CONQUEST
            renderConquestUI(entity, x, y);
        }
    }
}

function renderConquestUI(entity, x, y) {
    if (entity.owner === CURRENT_USER) {
        const currentLevel = entity.level || 1;
        const currentProduction = getTerritoryProduction(currentLevel);
        const garrison = entity.garrison ? entity.garrison.total : 0; // Future proofing

        // Upgrade info
        let upgradeSection = '';
        if (currentLevel < 10) {
            const cost = getTerritoryUpgradeCost(currentLevel);
            const nextLevel = currentLevel + 1;
            const nextProduction = getTerritoryProduction(nextLevel);
            const productionIncrease = nextProduction - currentProduction;

            upgradeSection = `
                <div style="background:#1e293b; padding:15px; margin:15px 0; border-radius:12px; border:1px solid #475569;">
                    <h4 style="color:#fbbf24; margin:0 0 10px 0;">🔧 שדרוג שדה</h4>
                    <div style="margin-bottom:10px;">
                        <strong>רמה נוכחית:</strong> ${currentLevel}/10
                    </div>
                    <div style="margin-bottom:10px;">
                        <strong>רמה הבאה:</strong> ${nextLevel}
                    </div>
                    <div style="margin-bottom:10px;">
                        <strong>תוספת ייצור:</strong> <span style="color:#10b981;">+${productionIncrease.toLocaleString()}/שעה</span>
                    </div>
                    <div style="background:#0f172a; padding:10px; border-radius:8px; margin:10px 0;">
                        <strong style="color:#94a3b8;">עלות שדרוג:</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px; font-size:0.9rem;">
                            <div>💰 ${cost.gold.toLocaleString()}</div>
                            <div>🌲 ${cost.wood.toLocaleString()}</div>
                            <div>🌾 ${cost.food.toLocaleString()}</div>
                            <div>🍷 ${cost.wine.toLocaleString()}</div>
                            <div>🏛️ ${cost.marble.toLocaleString()}</div>
                            <div>💎 ${cost.crystal.toLocaleString()}</div>
                            <div>🔥 ${cost.sulfur.toLocaleString()}</div>
                        </div>
                    </div>
                    <button class="btn-primary" style="background:#0ea5e9; width:100%;" onclick="upgradeTerritoryAtCoords(${x}, ${y})">⬆️ שדרג ל-${nextLevel}</button>
                </div>
            `;
        } else {
            upgradeSection = `
                <div style="background:#1e293b; padding:15px; margin:15px 0; border-radius:12px; border:1px solid #10b981;">
                    <h4 style="color:#10b981; margin:0;">✅ רמה מקסימלית!</h4>
                    <p style="color:#94a3b8; margin:10px 0 0 0;">השדה הגיע לרמה המקסימלית (10/10)</p>
                </div>
            `;
        }

        const html = `
            <div style="text-align:center">
                <div style="font-size:3rem; margin-bottom:10px;">🚩</div>
                <p style="color:#22c55e; font-weight:bold; font-size:1.2rem;">הטריטוריה הזו בשליטתך!</p>
                
                <div style="background:#0f172a; padding:15px; margin:15px 0; border-radius:12px; border:1px solid #334155;">
                    <div style="margin-bottom:10px;">
                        <strong>📊 רמה:</strong>
                        <div style="font-size:1.1rem; color:#fbbf24;">${currentLevel}/10</div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <strong>🏹 כוח שמירה (Garrison):</strong>
                        <div style="font-size:1.1rem; color:#bae6fd;">${garrison} לוחמים</div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <strong>💰 תפוקה פסיבית:</strong>
                            <div style="color:#fbbf24">${currentProduction.toLocaleString()} ${getTypeIcon(entity.resource)} / שעה</div>
                    </div>
                </div>

                ${upgradeSection}

                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" style="background:#ef4444; width:100%;" onclick="abandonTerritory(${x}, ${y})">🏳️ נסיגה / נטישת שטח</button>
                    <!-- Future: <button>Garrison Troops</button> -->
                </div>
            </div>
        `;
        openModal(entity.name, html, "סגור", closeModal);
        return;
    }

    let unitInputsHtml = '';
    let hasUnits = false;

    // Generate inputs for each unit type
    for (const [uKey, uCount] of Object.entries(STATE.army)) {
        if (uCount > 0 && UNIT_TYPES[uKey]) {
            hasUnits = true;
            unitInputsHtml += `
                <div style="display:flex; flex-direction: column; margin-bottom:5px; background:rgba(255,255,255,0.05); padding:5px; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span>${UNIT_TYPES[uKey].icon}</span>
                            <span>${UNIT_TYPES[uKey].name}</span>
                            <span style="font-size:0.8rem; color:#94a3b8;">(יש: ${uCount})</span>
                             <span style="font-size:0.8rem; color:#ef4444;">⚔️ ${UNIT_TYPES[uKey].attack}</span>
                        </div>
                        <div style="display:flex; gap:5px; align-items:center;">
                             <input type="number" id="conquest-inp-${uKey}" class="conquest-unit-input" data-type="${uKey}" value="0" min="0" max="${uCount}" 
                                   style="width:60px; text-align:center; padding:5px; border-radius:4px; border:none; background:rgba(0,0,0,0.5); color:white;"
                                   oninput="val = Math.min(this.value, ${uCount}); this.value = val;">
                        </div>
                    </div>
                     <div class="perc-btns" style="width: 100%; display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px;">
                        <button class="p-btn" onclick="setConquestAmount('${uKey}', ${uCount}, 0.1)">10%</button>
                        <button class="p-btn" onclick="setConquestAmount('${uKey}', ${uCount}, 0.25)">25%</button>
                        <button class="p-btn" onclick="setConquestAmount('${uKey}', ${uCount}, 0.5)">50%</button>
                        <button class="p-btn" onclick="setConquestAmount('${uKey}', ${uCount}, 1.0)">Max</button>
                    </div>
                </div>
            `;
        }
    }

    const travelTime = calculateTravelTime(x, y);

    const ownerDisplay = entity.owner ? `<div style="background:#7f1d1d; padding:8px; margin:8px 0; border-radius:8px; border:1px solid #ef4444;">
        <strong style="color:#fca5a5;">⚠️ שטח כבוש</strong>
        <div style="color:#fef2f2; margin-top:5px;">🏴 בשליטת: <strong>${entity.owner}</strong></div>
    </div>` : '';

    openModal(`כיבוש ${entity.name}`, `
        <div style="text-align:center">
            <div style="font-size:3rem; margin-bottom:10px;">${getEntityIcon(entity.type)}</div>
            ${ownerDisplay || '<p>שטח פראי. כבוש אותו כדי לקבל משאבים קבועים.</p>'}
            
            <div style="background:#0f172a; padding:10px; margin:10px 0; border-radius:8px;">
                <strong>פוטנציאל תפוקה:</strong>
                <span style="color:#fbbf24">${((entity.level || 1) * 3600).toLocaleString()}</span> ${getTypeIcon(entity.resource)} / שעה
            </div>

            <div style="text-align:right; margin: 15px 0; padding:10px; background:rgba(0,0,0,0.3); border-radius:8px;">
                <label style="display:block; margin-bottom:10px; color:#ef4444;">⚔️ בחר כוחות כיבוש</label>
                
                <div id="conquest-units-list" style="max-height:150px; overflow-y:auto; padding-right:5px;">
                    ${hasUnits ? unitInputsHtml : '<p style="color:#ef4444; text-align:center;">אין לך יחידות פנויות!</p>'}
                </div>

                <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.9rem;">
                    <div style="display:flex; justify-content:space-between;">
                        <span>⏳ זמן מסע:</span>
                        <span>${travelTime}s</span>
                    </div>
                </div>
            </div>

            <button class="btn-primary" onclick="startConquest(${x}, ${y})">🚩 צא לכיבוש</button>
        </div>
    `, "ביטול", closeModal);
}

window.setGatherInputMax = function (btn, max) {
    const input = btn.nextElementSibling;
    input.value = max;
    // Trigger update manually
    input.oninput();
};

window.updateGatherStats = function (x, y) {
    const inputs = document.querySelectorAll('.gather-unit-input');
    let totalCargo = 0;

    // Logistics Bonus
    const logisticsLvl = (STATE.research && STATE.research.logistics) || 0;
    const cargoMulti = 1 + (logisticsLvl * 0.05);

    inputs.forEach(inp => {
        const type = inp.dataset.type;
        const val = parseInt(inp.value) || 0;
        if (UNIT_TYPES[type]) {
            totalCargo += val * UNIT_TYPES[type].cargo * cargoMulti;
        }
    });

    const cargoEl = document.getElementById('gather-total-cargo');
    if (cargoEl) cargoEl.innerText = Math.floor(totalCargo);
};

// Stub for startGathering
window.validateGatherInput = function (input, max) {
    if (parseInt(input.value) > max) input.value = max;
    if (parseInt(input.value) < 0) input.value = 0;
};

window.startConquest = function (x, y) {
    const inputs = document.querySelectorAll('.conquest-unit-input');
    const selectedUnits = {};
    let totalCount = 0;

    inputs.forEach(inp => {
        const type = inp.dataset.type;
        const val = parseInt(inp.value) || 0;
        if (val > 0) {
            selectedUnits[type] = val;
            totalCount += val;
        }
    });

    if (totalCount === 0) {
        notify("עליך לשלוח לפחות יחידה אחת!", "error");
        return;
    }

    // Deduct Units
    for (const [type, amount] of Object.entries(selectedUnits)) {
        if (STATE.army[type] < amount) {
            notify(`שגיאה: אין מספיק ${UNIT_TYPES[type].name}`, "error");
            return;
        }
        STATE.army[type] -= amount;
    }

    const travelTime = calculateTravelTime(x, y);
    const key = `${x},${y}`;
    const entity = STATE.mapEntities[key];

    notify(`הצבא יצא לכבוש את ${entity.name}! הגעה: ${travelTime} שניות`, "success");

    STATE.timers.push({
        type: 'mission',
        subtype: 'conquest',
        targetKey: key,
        originKey: STATE.homeCoords.x + ',' + STATE.homeCoords.y,
        startTime: Date.now(),
        units: selectedUnits,
        endTime: Date.now() + (travelTime * 1000), // One way trip to start
        desc: `כיבוש ${entity.name}`
    });

    closeModal();
    updateUI();
};



window.abandonTerritory = function (x, y) {
    const key = `${x},${y}`;
    const entity = STATE.mapEntities[key];

    if (!entity || entity.owner !== CURRENT_USER) {
        notify("שגיאה: השטח אינו בבעלותך.", "error");
        return;
    }

    // Return Garrison to Army
    if (entity.garrison && entity.garrison.units) {
        let returnedCount = 0;
        for (const [u, count] of Object.entries(entity.garrison.units)) {
            if (!STATE.army[u]) STATE.army[u] = 0;
            STATE.army[u] += count;
            returnedCount += count;
        }
        notify(`${returnedCount} לוחמים חזרו לעיר מהשטח שננטש.`, "success");
    }

    // Reset Entity Ownership
    entity.owner = null;
    entity.user = null;
    entity.garrison = null;
    entity.isMyCity = false;

    notify(`השטח ${entity.name} ננטש בהצלחה.`, "success");

    closeModal();
    saveGame();
    // Re-render map to remove "owned" styling if needed (or just wait for refresh)
    renderWorldMap();
};

// [Legacy attack logic removed]

// End World Map 2.0




// Config
// Config
const SOLDIER_COST = 50; // gold
const WHEAT_CONSUMPTION_PER_SOLDIER = 0.1; // per tick
const POPULATION_GROWTH_RATE = 0.05; // per tick if happy
const CONSTRUCTION_BASE_TIME = 5; // seconds (short for prototype)

function getConstructionTime(baseTime) {
    const archLvl = (STATE.research && STATE.research.architecture) || 0;
    const discount = 1 - (archLvl * 0.05); // 5% per level
    return Math.max(1, Math.floor(baseTime * discount));
}

const PRODUCTION_RATES = {
    mine: 5, // gold per level
    woodCutter: 5, // wood per level
    farm: 10, // wheat per level
    ironMine: 2, // iron per level
    // Mead Hall doesn't produce, it enables consumption efficiency or max happiness
};

const UNIT_TYPES = {
    // Basic Units (available from start)
    spearman: { name: "חניתאי", cost: { gold: 30, wood: 30 }, time: 5, attack: 5, defense: 20, cargo: 20, upkeep: 1, icon: '🛡️', requiredTownHallLevel: 1 },
    archer: { name: "קשת", cost: { gold: 50, wood: 50 }, time: 10, attack: 20, defense: 5, cargo: 10, upkeep: 1, icon: '🏹', requiredTownHallLevel: 1 },
    swordsman: { name: "לוחם חרב", cost: { gold: 80, wood: 40, iron: 20 }, time: 15, attack: 30, defense: 30, cargo: 15, upkeep: 2, icon: '⚔️', requiredTownHallLevel: 1 },

    // Cavalry Units (available from Town Hall level 10)
    mountedRaider: { name: "פרש פושט", cost: { gold: 150, wood: 100 }, time: 25, attack: 40, defense: 25, cargo: 30, upkeep: 3, icon: '🐴', requiredTownHallLevel: 10 },
    heavyCavalry: { name: "פרש כבד", cost: { gold: 300, wood: 150, marble: 50 }, time: 40, attack: 60, defense: 50, cargo: 20, upkeep: 5, icon: '🏇', requiredTownHallLevel: 10 },
    mountedArcher: { name: "קשת רכוב", cost: { gold: 200, wood: 150 }, time: 30, attack: 50, defense: 20, cargo: 25, upkeep: 4, icon: '🏹', requiredTownHallLevel: 10 },

    // Special Infantry (available from Town Hall level 10)
    berserker: { name: "לוחם פראי", cost: { gold: 180, wood: 80, wine: 20 }, time: 30, attack: 70, defense: 15, cargo: 10, upkeep: 4, icon: '🪓', requiredTownHallLevel: 10 },
    shieldWall: { name: "חומת מגנים", cost: { gold: 200, wood: 120, marble: 30 }, time: 35, attack: 25, defense: 70, cargo: 15, upkeep: 4, icon: '🛡️', requiredTownHallLevel: 10 },
    dualWielder: { name: "לוחם כפול", cost: { gold: 220, wood: 100 }, time: 28, attack: 55, defense: 35, cargo: 18, upkeep: 3, icon: '⚔️', requiredTownHallLevel: 10 },

    // Siege Units (available from Town Hall level 10)
    catapult: { name: "בליסטרה", cost: { gold: 400, wood: 300, sulfur: 50 }, time: 60, attack: 100, defense: 10, cargo: 5, upkeep: 8, icon: '🎯', requiredTownHallLevel: 10 },
    batteringRam: { name: "איל מתקפה", cost: { gold: 350, wood: 250, marble: 40 }, time: 50, attack: 80, defense: 30, cargo: 0, upkeep: 6, icon: '🚪', requiredTownHallLevel: 10 },
    ballista: { name: "קשת ענק", cost: { gold: 380, wood: 280, crystal: 30 }, time: 55, attack: 90, defense: 20, cargo: 8, upkeep: 7, icon: '🏹', requiredTownHallLevel: 10 }
};

const RESEARCH_TYPES = {
    architecture: { name: "ארכיטקטורה", cost: { wood: 300, crystal: 50 }, time: 60, bonus: 0.05, icon: '🏗️', desc: "מקצר את זמני הבנייה ב-5% לכל רמה." },
    weaponry: { name: "חישול נשק", cost: { wood: 200, crystal: 100 }, time: 60, bonus: 0.05, icon: '⚔️', desc: "מגדיל את כוח ההתקפה ב-5% לכל רמה." },
    defense: { name: "ביצורים", cost: { wood: 400, marble: 100 }, time: 60, bonus: 0.05, icon: '🛡️', desc: "מגדיל את ההגנה ב-5% לכל רמה." },
    logistics: { name: "לוגיסטיקה", cost: { wood: 200, wine: 50 }, time: 60, bonus: 0.05, icon: '🐴', desc: "מגדיל את קיבולת המשאבים ב-5% לכל רמה." }
};


// UI References
// UI References
const els = {
    resGold: document.getElementById('res-gold'),
    resWood: document.getElementById('res-wood'),
    resFood: document.getElementById('res-food'),
    resWine: document.getElementById('res-wine'),
    resMarble: document.getElementById('res-marble'),
    resCrystal: document.getElementById('res-crystal'),
    resSulfur: document.getElementById('res-sulfur'),
    resCitizens: document.getElementById('res-citizens'),

    mainView: document.getElementById('main-view'),
    modal: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalBtn: document.getElementById('modal-action-btn'),

    // Grab layout elements by class since they don't have IDs
    header: document.querySelector('.resource-bar'),
    nav: document.querySelector('.bottom-nav')
};

let currentModalAction = null;

/**
 * Core Loop
 */
// Core Loop
// Core Loop
function gameLoop() {
    // 1. Basic Production
    // Citizen Growth
    const townHallLevel = (STATE.buildings && STATE.buildings.townHall) ? STATE.buildings.townHall.level : 1;
    const maxCitizens = 50 + (townHallLevel * 100);

    if (STATE.resources.citizens < maxCitizens) {
        // Growth: 5% of remaining capacity per hour, distributed per second (approx)
        // Or simpler: Recovers full pop in ~10 minutes (600s)
        const growthRate = maxCitizens / 600;
        STATE.resources.citizens += growthRate;
        if (STATE.resources.citizens > maxCitizens) STATE.resources.citizens = maxCitizens;
    }

    STATE.resources.gold += STATE.resources.citizens * 0.1; // Taxes

    // Wood Production: Base + Sawmill Bonus
    let woodBonus = 0;
    if (STATE.island && STATE.island.sawmill) {
        woodBonus = STATE.island.sawmill.level * 0.1;
    }
    const woodRate = 5 * (1 + woodBonus);
    STATE.resources.wood += woodRate;

    // Passive Income from Conquered Territories
    if (STATE.mapEntities) {
        Object.values(STATE.mapEntities).forEach(ent => {
            if (ent.owner === CURRENT_USER && ent.resource) {
                // Rate: Level * 1 per second (3600 per hour) - CORRECTED to match profile
                const rate = (ent.level || 1) * 1;
                if (!STATE.resources[ent.resource]) STATE.resources[ent.resource] = 0;
                STATE.resources[ent.resource] += rate;
            }
        });
    }

    // Army Consumption (Upkeep)
    if (STATE.army) {
        let totalUpkeepHour = 0;
        for (const [unit, count] of Object.entries(STATE.army)) {
            if (count > 0 && UNIT_TYPES[unit]) {
                totalUpkeepHour += (UNIT_TYPES[unit].upkeep || 0) * count;
            }
        }
        // Deduct per second (1/3600 of hourly)
        if (totalUpkeepHour > 0) {
            const upkeepPerSec = totalUpkeepHour / 3600;
            STATE.resources.food -= upkeepPerSec;

            // Prevent negative food? Or let it go negative => Starvation?
            // For now, let's just cap at 0 to be nice, or allow negative to show debt.
            // Let's cap at 0 for now to prevent bugs.
            if (STATE.resources.food < 0) STATE.resources.food = 0;
        }
    }

    processTimers();
    updateUI();

    // Auto-Save every 5 seconds (approx)
    if (Date.now() % 5000 < 1000 && CURRENT_USER) {
        saveGame();
    }
}

// --- Logic: Training (Global) ---
// --- Logic: Training (Global) ---
window.startTraining = function (type, amount) {
    amount = parseInt(amount);
    if (!amount || amount < 1) return;

    const unitData = UNIT_TYPES[type];
    if (!unitData) return;

    // 1. Check for Active Training Restriction
    if (STATE.timers.find(t => t.type === 'unit')) {
        notify("המחנה עסוק באימון כוחות אחרים!", "error");
        return;
    }

    // Check Town Hall level requirement
    const townHallLevel = STATE.buildings?.townHall?.level || 1;
    if ((unitData.requiredTownHallLevel || 1) > townHallLevel) {
        notify(`נדרשת עירייה ברמה ${unitData.requiredTownHallLevel} כדי לגייס ${unitData.name}!`, "error");
        return;
    }

    // Calculate Costs for all resource types
    const totalGold = (unitData.cost.gold || 0) * amount;
    const totalWood = (unitData.cost.wood || 0) * amount;
    const totalMarble = (unitData.cost.marble || 0) * amount;
    const totalCrystal = (unitData.cost.crystal || 0) * amount;
    const totalSulfur = (unitData.cost.sulfur || 0) * amount;
    const totalWine = (unitData.cost.wine || 0) * amount;

    // Check if player has enough resources
    if (STATE.resources.gold >= totalGold &&
        STATE.resources.wood >= totalWood &&
        (STATE.resources.marble || 0) >= totalMarble &&
        (STATE.resources.crystal || 0) >= totalCrystal &&
        (STATE.resources.sulfur || 0) >= totalSulfur &&
        (STATE.resources.wine || 0) >= totalWine) {

        // Deduct resources
        STATE.resources.gold -= totalGold;
        STATE.resources.wood -= totalWood;
        if (totalMarble > 0) STATE.resources.marble -= totalMarble;
        if (totalCrystal > 0) STATE.resources.crystal -= totalCrystal;
        if (totalSulfur > 0) STATE.resources.sulfur -= totalSulfur;
        if (totalWine > 0) STATE.resources.wine -= totalWine;

        updateUI();

        // Add timer
        const totalTime = amount * (unitData.time * 1000);

        STATE.timers.push({
            type: 'unit',
            unit: type,
            amount: amount,
            endTime: Date.now() + totalTime,
            startTime: Date.now(), // Added for progress calculation
            desc: `מגייס ${amount} ${unitData.name}`
        });

        notify(`החל גיוס של ${amount} ${unitData.name}!`, "success");
        saveGame(); // PERSIST IMMEDIATELY

        // Re-render to show updated resources
        if (currentModalAction === 'barracks') interactBuilding('barracks'); // Refresh view
    } else {
        notify("אין מספיק משאבים!", "error");
    }
};

window.getIcon = function (res) {
    const map = { wood: '🌲', wine: '🍷', marble: '⬜', crystal: '💎', sulfur: '🌋', gold: '💰' };
    return map[res] || '';
};

function processTimers() {
    const now = Date.now();
    // Filter finished timers
    // We iterate backwards to remove safely
    for (let i = STATE.timers.length - 1; i >= 0; i--) {
        const timer = STATE.timers[i];
        if (now >= timer.endTime) {
            completeTimer(timer);
            STATE.timers.splice(i, 1);
        }
    }
}


// Helper for travel time
window.calculateTravelTime = function (targetX, targetY) {
    const startX = STATE.homeCoords.x;
    const startY = STATE.homeCoords.y;
    // Simple Manhatten or Euclidean distance
    const dist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));

    // Speed: 1 sec per tile?
    return Math.max(10, Math.ceil(dist * 1));
};

async function completeTimer(timer) {
    if (timer.type === 'building') {
        const b = STATE.buildings[timer.key];
        b.level += 1;
        notify(`בניית ${b.name} הושלמה! (רמה ${b.level})`, "success");
        renderCityStats();
    } else if (timer.type === 'unit') {
        if (!STATE.army[timer.unit]) STATE.army[timer.unit] = 0;
        STATE.army[timer.unit] += timer.amount;
        notify(`גיוס ${timer.amount} ${UNIT_TYPES[timer.unit].name} הושלם!`, "success");
    } else if (timer.type === 'research') {
        if (!STATE.research[timer.tech]) STATE.research[timer.tech] = 0;
        STATE.research[timer.tech]++;
        notify(`מחקר ${RESEARCH_TYPES[timer.tech].name} הושלם!`, "success_major");
    } else if (timer.type === 'mission') {
        if (timer.subtype === 'attack') {

            // Check if we have a Server Result (Real PvP/PvE via API)
            if (timer.serverResult) {
                console.log("Resolving Server Battle:", timer.serverResult);
                const res = timer.serverResult;
                const isWin = res.victory;
                const loot = res.loot || {};
                const casuals = res.casualties || {};

                // Restore Army (Total Sent - Casualties)
                let unitsReturned = {};
                let unitsLost = {};

                Object.entries(timer.units).forEach(([u, amt]) => {
                    // Ensure army key exists
                    if (typeof STATE.army[u] === 'undefined') STATE.army[u] = 0;

                    const lost = casuals[u] || 0;
                    const safe = Math.max(0, amt - lost);

                    if (safe > 0) unitsReturned[u] = safe;
                    if (lost > 0) unitsLost[u] = lost;

                    // Add back to STATE
                    STATE.army[u] += safe;
                    console.log(`Returning ${safe} ${u}. New total: ${STATE.army[u]}`);
                });

                // Apply Loot
                for (const [r, amount] of Object.entries(loot)) {
                    if (typeof STATE.resources[r] === 'undefined') STATE.resources[r] = 0;
                    STATE.resources[r] += amount;
                }

                // Update Stats
                if (!STATE.stats) STATE.stats = { battles: 0, wins: 0, losses: 0 };
                STATE.stats.battles = (STATE.stats.battles || 0) + 1;
                if (isWin) STATE.stats.wins = (STATE.stats.wins || 0) + 1;
                else STATE.stats.losses = (STATE.stats.losses || 0) + 1;

                // Notify
                if (isWin) notify(`ניצחון! השגנו שלל: ${JSON.stringify(loot)}`, "success_major");
                else notify("תבוסה... הצבא חזר עם אבדות.", "error");

                // Report - Use the complete server report if available
                if (window.Mailbox) {
                    if (res.report && res.report.data) {
                        // Use full server report with all defender data
                        console.log("Adding full server report:", res.report);
                        Mailbox.addReport('attack', res.report.title || (isWin ? `ניצחון בקרב` : `תבוסה בקרב`), res.report.data);
                    } else {
                        // Fallback to minimal report
                        console.warn("Server report incomplete, using fallback");
                        Mailbox.addReport('attack', isWin ? `ניצחון בקרב` : `תבוסה בקרב`, {
                            winner: isWin,
                            loot: loot,
                            unitsLost: unitsLost,
                            unitsReturned: unitsReturned,
                            enemy: 'Unknown'
                        });
                    }
                }

                // Save immediately to persist returned troops
                saveGame();
                updateUI();
                return;
            }

            // --- LEGACY OFFLINE LOGIC BELOW (Fallback) ---
            // If we are here, something is wrong with server connection OR its an old mission
            // Refund everything to be safe
            console.warn("Mission finished without Server Result. Refunding.");
            Object.entries(timer.units).forEach(([u, amt]) => {
                if (typeof STATE.army[u] === 'undefined') STATE.army[u] = 0;
                STATE.army[u] += amt;
            });
            notify("הקרב בוטל (שגיאת נתונים), הכוחות חזרו.", "info");
            saveGame();
            updateUI();
            return;

            // Resolve Combat using shared logic
            const entity = STATE.mapEntities[timer.targetKey] || { level: 1, name: 'Unknown', type: 'unknown' };

            // Try to fetch defender data if it's a player city
            let defenderData = null;
            if (entity.type === 'city' && entity.user && entity.user !== 'NPC') {
                // For player cities, try to load their actual game data
                try {
                    const response = await fetch(`/data/users/${entity.user}.json`);
                    if (response.ok) {
                        const defenderState = await response.json();
                        defenderData = {
                            army: defenderState.army || {},
                            resources: defenderState.resources || {}
                        };
                    }
                } catch (err) {
                    console.warn('Could not load defender data:', err);
                    // defenderData remains null - will mean targetPower = 0
                }
            }

            const result = resolveBattle(timer.units, entity, defenderData);

            const isWin = result.won;
            const loot = result.loot || {};
            let unitsReturned = {};
            let unitsLost = {};

            if (isWin) {
                // Win: Calculate loss based on defender strength
                // If defender has no power (empty city), no losses!
                const lossRate = result.targetPower > 0 ? 0.1 : 0;
                Object.entries(timer.units).forEach(([u, amt]) => {
                    const lost = Math.floor(amt * lossRate);
                    const safe = amt - lost;
                    unitsReturned[u] = safe;
                    unitsLost[u] = lost;
                    STATE.army[u] += safe;
                });

                // Apply Loot
                for (const [res, amount] of Object.entries(loot)) {
                    if (!STATE.resources[res]) STATE.resources[res] = 0;
                    STATE.resources[res] += amount;
                }

                // Update stats
                if (!STATE.stats) STATE.stats = { battles: 0, wins: 0, losses: 0 };
                STATE.stats.battles = (STATE.stats.battles || 0) + 1;
                STATE.stats.wins = (STATE.stats.wins || 0) + 1;

                notify(`ניצחון! הבסנו את ${entity.name}!`, "success_major");
                // Mission Trigger
                if (window.Missions) Missions.onEvent('attack', 1);

            } else {
                // Loss: Heavy loss (50%), No Loot
                const lossRate = 0.5;
                Object.entries(timer.units).forEach(([u, amt]) => {
                    const lost = Math.floor(amt * lossRate);
                    const safe = amt - lost;
                    unitsReturned[u] = safe;
                    unitsLost[u] = lost;
                    STATE.army[u] += safe;
                });

                // Update stats
                if (!STATE.stats) STATE.stats = { battles: 0, wins: 0, losses: 0 };
                STATE.stats.battles = (STATE.stats.battles || 0) + 1;
                STATE.stats.losses = (STATE.stats.losses || 0) + 1;

                notify(`הקרב היה קשה... הצבא נסוג עם אבדות.`, "error");
            }

            if (window.Mailbox) {
                Mailbox.addReport('attack', isWin ? `ניצחון על ${entity.name}` : `תבוסה מול ${entity.name}`, {
                    winner: isWin,
                    enemy: entity.name,
                    enemyLevel: result.defenderLevel || entity.level || 1,
                    defenderArmy: result.defenderArmy || {},
                    defenderPower: result.targetPower,
                    loot: loot,
                    unitsLost: unitsLost,
                    unitsReturned: unitsReturned
                });
            }

        } else if (timer.subtype === 'conquest') {
            // CONQUEST LOGIC
            const entity = STATE.mapEntities[timer.targetKey];
            if (!entity) return; // Should not happen

            // 1. Resolve VS Guard (Guardian Level or Owner Defenders)
            // For now, simple check: If empty/wild or weaker, we win.
            // Let's reuse resolveBattle for a fair fight.
            const result = resolveBattle(timer.units, entity);

            // Return Units regardless of outcome (Survivors return)
            // Ideally they would stay to defend (Garrison), but for this iteration let's return them.
            // Optimization: If you conquer, maybe leave 1 unit? 
            // Stick to User Request: "Conquer giving passive output".

            // Return surviving units logic (Similar to attack)
            const lossRate = result.won ? 0.05 : 0.5; // Very low loss on win (5%), high on fail
            let survivors = {};

            Object.entries(timer.units).forEach(([u, amt]) => {
                const lost = Math.floor(amt * lossRate);
                const safe = amt - lost;
                if (safe > 0) survivors[u] = safe;
                // REMOVED: STATE.army[u] += safe; // Return to pool
            });

            if (result.won) {
                // Change Ownership!
                entity.owner = CURRENT_USER;
                entity.user = CURRENT_USER; // Legacy compat
                entity.capturedAt = Date.now();

                // GARRISON LOGIC: Survivors stay!
                let totalSurvivors = 0;
                Object.values(survivors).forEach(v => totalSurvivors += v);

                entity.garrison = {
                    units: survivors,
                    total: totalSurvivors
                };


                notify(`השטח ${entity.name} נכבש! הושאר חיל מצב של ${totalSurvivors} לוחמים.`, "success_major");
                // Save immediately
                saveGame();
            } else {
                notify(`הכיבוש נכשל! הכוחות נסוגו.`, "error");
            }

            updateUI();
        } else if (timer.subtype === 'fortress_attack') {
            // FORTRESS ATTACK - Deferred Battle Resolution
            console.log('[FORTRESS_ATTACK] Timer completed, resolving battle...', timer);

            if (timer.deferredBattle && timer.attackParams) {
                // Call server NOW to resolve the battle
                try {
                    const requestBody = {
                        ...timer.attackParams,
                        resolve: true // Tell server this is deferred resolution
                    };
                    console.log('[FORTRESS_ATTACK] Sending resolution request:', requestBody);

                    const response = await fetch('/api/attack', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    const result = await response.json();

                    if (!result.success) {
                        notify("שגיאה בפתרון קרב: " + result.message, "error");
                        // Refund troops to fortress garrison
                        if (window.ALL_CLANS && STATE.clan) {
                            const clan = window.ALL_CLANS[STATE.clan.id];
                            if (clan && clan.fortress) {
                                const garrison = clan.fortress.garrison || clan.fortress.troops || {};
                                for (const [type, amount] of Object.entries(timer.units)) {
                                    garrison[type] = (garrison[type] || 0) + amount;
                                }
                                if (clan.fortress.garrison !== undefined) {
                                    clan.fortress.garrison = garrison;
                                } else {
                                    clan.fortress.troops = garrison;
                                }
                            }
                        }
                        return;
                    }

                    // Process battle results
                    const isWin = result.victory;
                    const loot = result.loot || {};
                    const casualties = result.casualties || {};

                    // Notify user
                    if (isWin) {
                        notify(`ניצחון! המבצר כבש את היעד! שלל: ${JSON.stringify(loot)}`, "success_major");
                    } else {
                        notify("הקרב נכשל... הכוחות חזרו עם אבדות.", "error");
                    }

                    // Show battle report if Mailbox exists
                    if (window.Mailbox && result.report) {
                        Mailbox.addReport('attack', result.report.title || (isWin ? `ניצחון - תקיפת מבצר` : 'תבוסה - תקיפת מבצר'), result.report.data || {
                            winner: isWin,
                            loot: loot,
                            unitsLost: casualties,
                            enemy: 'יעד'
                        });
                    }

                    // Reload clan data to reflect changes (casualties, loot to treasury)
                    if (window.loadClans) {
                        await window.loadClans();
                    }

                    saveGame();
                    updateUI();
                } catch (error) {
                    console.error('[FORTRESS_ATTACK] Error resolving battle:', error);
                    notify("שגיאת תקשורת עם השרת", "error");

                    // Refund troops
                    if (window.ALL_CLANS && STATE.clan) {
                        const clan = window.ALL_CLANS[STATE.clan.id];
                        if (clan && clan.fortress) {
                            const garrison = clan.fortress.garrison || clan.fortress.troops || {};
                            for (const [type, amount] of Object.entries(timer.units)) {
                                garrison[type] = (garrison[type] || 0) + amount;
                            }
                            if (clan.fortress.garrison !== undefined) {
                                clan.fortress.garrison = garrison;
                            } else {
                                clan.fortress.troops = garrison;
                            }
                        }
                    }
                }
            } else {
                // Old fortress attack with immediate serverResult (shouldn't happen anymore)
                console.warn('[FORTRESS_ATTACK] Legacy fortress attack detected');
                notify("התקפת מבצר הסתיימה", "info");
            }
        }
    }

    // Save automatically
    saveGame();
    updateUI();
}

// Tick every 1 second
setInterval(gameLoop, 1000);

/**
 * UI Functions
 */
function updateUI() {
    if (!els.resGold) return; // Safety check
    els.resGold.innerText = Math.floor(STATE.resources.gold);
    els.resWood.innerText = Math.floor(STATE.resources.wood);
    els.resFood.innerText = Math.floor(STATE.resources.food);
    els.resWine.innerText = Math.floor(STATE.resources.wine);
    els.resMarble.innerText = Math.floor(STATE.resources.marble);
    els.resCrystal.innerText = Math.floor(STATE.resources.crystal);
    els.resSulfur.innerText = Math.floor(STATE.resources.sulfur);
    els.resCitizens.innerText = Math.floor(STATE.resources.citizens);

    // Building timer visuals now handled by city_imagemap.js labels

    // Refresh Barracks Queue if open
    if (currentModalAction === 'barracks') {
        const queueEl = document.getElementById('barracks-queue');
        if (queueEl) {
            queueEl.innerHTML = renderTrainingQueue();
        }
    }
    // Refresh Academy UI if open (to show levels updating or disabled buttons)
    else if (currentModalAction === 'academy') {
        // Re-render the entire content to update buttons/costs/levels
        if (els.modalBody && !els.modal.classList.contains('hidden')) {
            els.modalBody.innerHTML = renderAcademyContent();
        }
    }
}

// [Legacy switchView removed - see end of file for active definition]

function setupIslandView() {
    // Get Current Island Data
    const islandId = STATE.currentIslandId || 'island1'; // Default
    const islandData = STATE.world.find(i => i.id === islandId);

    if (!islandData) return;

    // Update Title
    const titleEl = document.querySelector('.island-hud .hud-title');
    if (titleEl) titleEl.innerText = `${islandData.name} (${getTypeIcon(islandData.type)})`;

    // Clear old spots
    document.querySelectorAll('.city-spot').forEach(el => {
        el.className = `city-spot spot-${el.className.match(/spot-(\d+)/)[1]}`; // Reset classes
        el.innerHTML = '<div class="spot-flag"></div>'; // Reset content
    });

    // Render Players
    islandData.players.forEach(p => {
        // Assign a spot index based on ID or hash to be deterministic
        // For prototype, we map id 1->spot 1, etc.
        const spotIdx = p.spot || (p.id % 16) + 1;
        const spot = document.querySelector(`.spot-${spotIdx}`);
        if (spot) {
            spot.classList.add('colonized');
            if (p.name === CURRENT_USER) spot.classList.add('my-city');
            spot.innerHTML = `<div class="city-model">🏛️</div><div class="city-name">${p.name}</div>`;

            // Attach data for interaction
            spot.dataset.playerId = p.id;
        }
    });
}

/**
 * Super Boost - Upgrade all buildings to 15 and get 10k army
 */
window.superBoost = function () {
    console.log('🚀 Super Boost initiated!');

    if (!confirm('🚀 Super Boost?\n\nThis will:\n• RESET citizens (population) to 0\n• Upgrade ALL buildings to level 15\n• Give you 50,000 troops (10K each type)\n\nContinue?')) {
        return;
    }

    // Reset citizens only
    if (STATE.resources && STATE.resources.citizens !== undefined) {
        STATE.resources.citizens = 0;
        console.log('✅ Reset citizens to 0');
    }
    if (STATE.city && STATE.city.population !== undefined) {
        STATE.city.population = 0;
        console.log('✅ Reset population to 0');
    }

    // Ensure STATE.buildings exists
    if (!STATE.buildings) {
        STATE.buildings = {};
        console.log('Created buildings object');
    }

    // Upgrade all buildings to 15
    const buildings = ['townHall', 'barracks', 'warehouse', 'farm', 'lumberMill', 'wall', 'academy', 'stable', 'workshop'];
    buildings.forEach(building => {
        if (!STATE.buildings[building]) {
            STATE.buildings[building] = { level: 15 };
            console.log(`Created ${building} at level 15`);
        } else {
            STATE.buildings[building].level = 15;
            console.log(`Upgraded ${building} to level 15`);
        }
    });

    // Give 10,000 of each troop
    if (!STATE.army) STATE.army = {};
    STATE.army.spearman = (STATE.army.spearman || 0) + 10000;
    STATE.army.archer = (STATE.army.archer || 0) + 10000;
    STATE.army.swordsman = (STATE.army.swordsman || 0) + 10000;
    STATE.army.axeman = (STATE.army.axeman || 0) + 10000;
    STATE.army.cavalry = (STATE.army.cavalry || 0) + 10000;
    console.log('Added 50,000 troops');

    // Save and update
    saveGame();
    updateUI();

    notify('🎉 Super Boost Applied! All buildings level 15 + 50,000 troops!', 'success');

    console.log('✅ Super Boost completed!', STATE.buildings);
}

function interactIsland(type) {
    if (type === 'sawmill') {
        const s = STATE.island.sawmill;
        const progressPercent = Math.min(100, Math.floor((s.donation / s.nextLevel) * 100));

        const html = `
            <div class="donation-view">
                <div class="level-display">רמה נוכחית: <span class="highlight">${s.level}</span></div>
                <div class="bonus-display">בונוס ייצור: <span class="success">+${Math.floor(s.level * 10)}%</span></div>
                
                <div class="progress-container">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">${s.donation} / ${s.nextLevel} עץ לשלב הבא</div>
                </div>

                <div class="donate-actions">
                    <p>תרום עץ כדי לשדרג את המנסרה לכולם:</p>
                    <div class="donate-buttons">
                        <button onclick="donateToIsland('sawmill', 50)" class="btn-wood">תרום 50 🪵</button>
                        <button onclick="donateToIsland('sawmill', 200)" class="btn-wood">תרום 200 🪵</button>
                    </div>
                </div>
            </div>
        `;

        openModal("המנסרה המשותפת", html, null, closeModal);
        // Hide default action button if we have custom ones
        els.modalBtn.style.display = 'none';

    } else if (type === 'luxury') {
        openModal("כרם (יין)", "<p>כרמים מייצרים יין לאושר התושבים.</p>", "סגור", closeModal);
    }
}

// Global scope for HTML access
window.donateToIsland = function (type, amount) {
    if (STATE.resources.wood >= amount) {
        STATE.resources.wood -= amount;

        const building = STATE.island[type];
        building.donation += amount;

        notify(`תרמת ${amount} עץ!`, "success");

        // Check Level Up
        if (building.donation >= building.nextLevel) {
            building.level++;
            building.donation -= building.nextLevel;
            building.nextLevel = Math.floor(building.nextLevel * 1.5);
            notify(`המנסרה שודרגה לרמה ${building.level}!`, "success_major");
        }

        // Refresh Modal
        interactIsland(type);
        updateUI();
    } else {
        notify("אין מספיק עץ!", "error");
    }
};

// --- MOBILE SCROLL CENTERING ---
function initMobileScroll() {
    // Detect View Container
    let container = document.querySelector('.city-landscape');
    if (!container) container = document.getElementById('world-map-viewport'); // Check World Map

    if (!container) return; // Exit if no scrollable container found

    // Centering Logic
    const scrollX = (container.scrollWidth - container.clientWidth) / 2;
    // Fix: Shift view UP by 250px to ensure city is visible above bottom nav
    const scrollY = ((container.scrollHeight - container.clientHeight) / 2) - 250;

    if (scrollX > 0 || scrollY > 0) {
        container.scrollTo({
            top: scrollY,
            left: scrollX,
            behavior: 'smooth'
        });

    }
}


window.addEventListener('resize', () => {
    // Optional: Re-center on resize if needed, or let user scroll
});

function interactSpot(spotId) {
    const spot = document.querySelector(`.spot-${spotId}`);
    if (!spot) return;

    if (spot.classList.contains('my-city')) {
        switchView('city');
        return;
    }

    if (spot.classList.contains('colonized')) {
        const playerId = spot.dataset.playerId;
        let pName = "שחקן";
        const island = STATE.world.find(i => i.id === STATE.currentIslandId);
        const player = island ? island.players.find(p => p.id == playerId) : null;
        if (player) pName = player.name;

        const html = `
            <div class="player-card" style="display:block; text-align:center;">
                <h3>${pName}</h3>
                <p>עיר מדינה חזקה</p>
                <div style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
                    <button class="btn-trade" onclick="window.tradeWith('${pName}')">💰 סחר</button>
                    <button class="btn-attack" onclick="alert('תקיפה - בקרוב!')">⚔️ התקף</button>
                </div>
            </div>
        `;
        openModal(pName, html, "סגור", closeModal);
    } else {
        // Empty Spot -> Gather Resources Mission
        const island = STATE.world.find(i => i.id === STATE.currentIslandId);
        const islandType = island ? island.type : 'wood';
        const typeIcon = getTypeIcon(islandType);

        let html = `
            <div style="text-align:center">
                <p style="margin-bottom:15px">שטח פראי זה עשיר ב-${typeIcon}. בחר יחידות למשלחת איסוף:</p>
                <div class="mission-unit-list" style="max-height: 200px; overflow-y: auto; text-align: right; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
        `;

        let hasUnits = false;
        for (const [key, count] of Object.entries(STATE.army)) {
            if (count > 0) {
                hasUnits = true;
                const unit = UNIT_TYPES[key];
                html += `
                    <div class="mission-unit-row" style="flex-wrap: wrap; gap: 5px;">
                        <div class="u-icon">${unit.icon}</div>
                        <div class="u-name" style="flex:1;">
                            ${unit.name} 
                            <span class="u-avail">(זמין: ${count})</span>
                        </div>
                        <input type="number" id="gather-inp-${key}" data-type="${key}" value="0" min="0" max="${count}" class="u-input" style="width: 80px;" onchange="updateMissionStats()">
                        
                        <div class="perc-btns" style="width: 100%; display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px;">
                            <button class="p-btn" onclick="setGatherAmount('${key}', ${count}, 0.1); updateMissionStats()">10%</button>
                            <button class="p-btn" onclick="setGatherAmount('${key}', ${count}, 0.25); updateMissionStats()">25%</button>
                            <button class="p-btn" onclick="setGatherAmount('${key}', ${count}, 0.5); updateMissionStats()">50%</button>
                            <button class="p-btn" onclick="setGatherAmount('${key}', ${count}, 1.0); updateMissionStats()">Max</button>
                        </div>
                    </div>
                `;
            }
        }

        if (!hasUnits) {
            html += `<p style="color: #ef4444;">אין לך יחידות פנויות לגיוס למשימה.</p>`;
        }

        html += `
                </div>
                <div id="mission-stats" style="margin: 15px 0; font-weight: bold; color: #fbbf24;">
                    סך הכל קיבולת: 0 🎒 | זמן משוער: 10s
                </div>
                <button onclick="startGatheringMission(${spotId})" class="btn-primary" ${!hasUnits ? 'disabled' : ''}>⛏️ שלח משלחת</button>
            </div>
            <script>
                // Helper to update stats live
                window.updateMissionStats = function() {
                    let totalCargo = 0;
                    document.querySelectorAll('.mission-unit-row input').forEach(inp => {
                        const type = inp.dataset.type;
                        const amount = parseInt(inp.value) || 0;
                        if (UNIT_TYPES[type]) {
                            // Cargo Bonus Logic duplication from attackPlayer? 
                            // Ideally we expose cargo calculation. For now use base cargo.
                            // We will calculate real cargo in startGatheringMission.
                            totalCargo += amount * UNIT_TYPES[type].cargo;
                        }
                    });
                    const statEl = document.getElementById('mission-stats');
                    if(statEl) statEl.innerText = 'סך הכל קיבולת: ' + totalCargo + ' 🎒 | זמן משוער: 10s';
                };
            </script>
        `;

        openModal("משלחת איסוף", html, "סגור", closeModal);
        els.modalBtn.style.display = 'none'; // Hide default button
    }
}

// Helper to update stats live
window.updateMissionStats = function () {
    let totalCargo = 0;

    // Logistics Bonus Logic (Client Side View)
    const logisticsLvl = (STATE.research && STATE.research.logistics) || 0;
    const cargoMulti = 1 + (logisticsLvl * 0.05);

    document.querySelectorAll('.mission-unit-row input').forEach(inp => {
        const type = inp.dataset.type;
        const amount = parseInt(inp.value) || 0;
        if (UNIT_TYPES[type]) {
            totalCargo += amount * UNIT_TYPES[type].cargo * cargoMulti;
        }
    });
    const statEl = document.getElementById('mission-stats');
    if (statEl) statEl.innerText = 'סך הכל קיבולת: ' + Math.floor(totalCargo) + ' 🎒 | זמן משוער: 10s';
};

window.startGatheringMission = function (spotId) {
    const inputs = document.querySelectorAll('.mission-unit-row input');
    let totalCargo = 0;
    let missionUnits = {};
    let hasUnits = false;

    // Logistics Bonus
    const logisticsLvl = (STATE.research && STATE.research.logistics) || 0;
    const cargoMulti = 1 + (logisticsLvl * 0.05);

    inputs.forEach(inp => {
        const type = inp.dataset.type;
        const amount = parseInt(inp.value) || 0;
        if (amount > 0) {
            hasUnits = true;
            missionUnits[type] = amount;
            totalCargo += amount * UNIT_TYPES[type].cargo * cargoMulti;
        }
    });

    if (!hasUnits) {
        notify("לא נבחרו יחידות!", "error");
        return;
    }

    // 1. Atomic Validation
    for (const [type, amount] of Object.entries(missionUnits)) {
        const available = STATE.army[type] || 0;
        if (available < amount) {
            console.warn(`Gathering Error: Not enough ${type}. Needed: ${amount}, Available: ${available}`);
            notify(`שגיאה: אין מספיק ${UNIT_TYPES[type].name} (יש ${available}, נדרש ${amount})`, "error");
            return;
        }
    }

    // 2. Deduction (Transaction Safe)
    for (const [type, amount] of Object.entries(missionUnits)) {
        STATE.army[type] -= amount;
    }

    // Determine Resource Type
    const island = STATE.world.find(i => i.id === STATE.currentIslandId);
    const resType = island ? island.type : 'wood';

    // Start Timer
    const duration = 10; // 10 seconds fixed for now
    STATE.timers.push({
        type: 'mission',
        subtype: 'gather',
        resType: resType,
        cargo: Math.floor(totalCargo),
        units: missionUnits,
        endTime: Date.now() + (duration * 1000),
        desc: `משלחת איסוף (${Math.floor(totalCargo)} 🎒)`
    });

    notify(`המשלחת יצאה לדרך! תחזור בעוד ${duration} שניות.`, "success");
    closeModal();
    updateUI();
};

window.tradeWith = function (targetName) {
    // Simple Trade Logic
    const html = `
        <p>סחר עם ${targetName}:</p>
        <button class="btn-primary" onclick="notify('השיירה יצאה לדרך!', 'success'); closeModal()">שלח 100 זהב תמורת 100 עץ</button>
    `;
    openModal("סחר חליפין", html, "ביטול", closeModal);
};

function renderCityStats() {
    // Building levels now handled by city_imagemap.js updateBuildingLabels
}

function setupCityInteractions() {
    // Building interactions now handled by city_imagemap.js openBuildingModal
}

// Old renderWorld removed


/**
 * Interaction
 */
function interactBuilding(type) {
    try {

        const b = STATE.buildings[type];
        if (!b) {
            console.error("Building type not found in STATE:", type);
            notify("שגיאה פנימית: מבנה לא נמצא", "error");
            return;
        }
        // Calculate costs including Iron
        const woodCost = Math.floor((b.baseCost.wood || 0) * Math.pow(b.costFactor, b.level));
        const goldCost = Math.floor((b.baseCost.gold || 0) * Math.pow(b.costFactor, b.level));


        // Check for active timer
        const existingTimer = STATE.timers.find(t => t.type === 'building' && t.key === type);
        if (existingTimer) {
            const remaining = Math.ceil((existingTimer.endTime - Date.now()) / 1000);
            openModal(b.name, `<p>בנייה בתהליך... נותרו ${remaining} שניות.</p>`, "סגור", closeModal);
            return;
        }

        let html = `<p>רמה נוכחית: ${b.level}</p>`;

        // --- IMPROVED STATS DISPLAY ---

        // 1. Production Buildings
        if (type === 'lumber' || type === 'mine') {
            const prodBase = 100; // Base per hour
            const currentProd = Math.floor(prodBase * b.level);
            const nextProd = Math.floor(prodBase * (b.level + 1));
            const resType = (type === 'lumber') ? 'עץ' : 'זהב/אבן';

            html += `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin:10px 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>ייצור לשעה:</span>
                        <span style="color:#fbbf24; font-weight:bold;">${currentProd.toLocaleString()} ${resType}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.9rem;">
                        <span>רמה הבאה:</span>
                        <span style="color:#34d399;">${nextProd.toLocaleString()} ${resType} (+${prodBase})</span>
                    </div>
                </div>
            `;
        }

        // 2. Warehouse Protection
        if (type === 'warehouse') {
            const baseCap = 500;
            const scale = 500;
            const currentCap = baseCap + (b.level * scale);
            const nextCap = baseCap + ((b.level + 1) * scale);

            html += `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin:10px 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>מוגן משאבים:</span>
                        <span style="color:#60a5fa; font-weight:bold;">${currentCap.toLocaleString()}</span>
                    </div>
                     <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.9rem;">
                        <span>רמה הבאה:</span>
                        <span style="color:#34d399;">${nextCap.toLocaleString()} (+${scale})</span>
                    </div>
                    <p style="font-size:0.8rem; color:#64748b; margin-top:5px;">* כמות זו מכל משאב מוגנת מפני בזיזה.</p>
                </div>
            `;
        }

        if (b.description) html += `<p style="font-size:0.9rem; color:#94a3b8; margin-bottom:1rem">${b.description}</p>`;

        let actionName = "התחל בניה";
        // Timed construction
        let constructionTime = getConstructionTime(CONSTRUCTION_BASE_TIME * (b.level + 1));

        if (type === 'townHall' && b.level > 0) {
            actionName = "שדרג מבנה";
            html += `
                <div class="town-hall-actions">
                    <button onclick="openCityProfile()" class="action-btn wide" style="margin-bottom:1rem; width:100%; background: #3b82f6;">📋 פרופיל עיר וסטטיסטיקות</button>
                </div>
                <h3>ניהול העיר</h3>
                <p>אוכלוסייה: ${STATE.city.population} | שמחה: ${STATE.city.happiness}%</p>
                <hr style="border-color:rgba(255,255,255,0.1); margin:1rem 0;">
            `;
        }

        if (type === 'barracks' && b.level > 0) {
            actionName = "שדרג מבנה";
            currentModalAction = 'barracks'; // Flag for global refresh
            // Append Recruitment UI
            html += renderBarracksContent(b.level);
        } else if (type === 'academy' && b.level > 0) {
            actionName = "שדרג מבנה";
            currentModalAction = 'academy';
            html += renderAcademyContent();
        }

        let costs = [];
        if (woodCost > 0) costs.push(`${woodCost} עץ`);
        if (goldCost > 0) costs.push(`${goldCost} זהב`);


        html += `<div style="margin-top:1rem;">
                <h4>שדרוג לרמה ${b.level + 1}</h4>
                <p>עלות: ${costs.join(', ')}</p>
                <p>זמן בנייה: ${constructionTime} שניות</p>
             </div>`;

        openModal(b.name, html, actionName, () => {

            if (STATE.resources.wood >= woodCost && STATE.resources.gold >= goldCost) {
                STATE.resources.wood -= woodCost;
                STATE.resources.gold -= goldCost;

                STATE.timers.push({
                    type: 'building',
                    key: type,
                    endTime: Date.now() + (constructionTime * 1000)
                });

                notify("הבנייה החלה! נתונים נשמרו.", "success");
                saveGame(); // PERSIST IMMEDIATELY
                closeModal();
                updateUI();
            } else {

                notify("אין מספיק משאבים!", "error");
            }
        });

    } catch (err) {
        console.error("CRITICAL ERROR in interactBuilding:", err);
        notify("שגיאה בפתיחת המבנה: " + err.message, "error");
    }
}

function renderBarracksContent(level) {
    const townHallLevel = STATE.buildings?.townHall?.level || 1;

    // Check for ANY active training
    const activeTimer = STATE.timers.find(t => t.type === 'unit');

    let html = `
        <div class="barracks-view">
            <div id="barracks-queue" class="training-queue">
                ${renderTrainingQueue()}
            </div>
            <p style="margin-bottom:1rem; margin-top:1rem;">אמן את צבאך כדי להגן על העיר ולבזוז אויבים.</p>
            <div class="unit-list">
    `;

    for (const [key, unit] of Object.entries(UNIT_TYPES)) {
        // Check if unit is available based on Town Hall level
        const isLocked = (unit.requiredTownHallLevel || 1) > townHallLevel;

        // Show costs
        const costs = [];
        if (unit.cost.gold) costs.push(`${unit.cost.gold}💰`);
        if (unit.cost.wood) costs.push(`${unit.cost.wood}🌲`);
        if (unit.cost.marble) costs.push(`${unit.cost.marble}🏛️`);
        if (unit.cost.crystal) costs.push(`${unit.cost.crystal}💎`);
        if (unit.cost.sulfur) costs.push(`${unit.cost.sulfur}🌋`);
        if (unit.cost.wine) costs.push(`${unit.cost.wine}🍷`);

        // Get current count
        const count = STATE.army[key] || 0;

        // Add locked styling if requirements not met
        const lockedClass = isLocked ? ' locked' : '';
        const lockedOverlay = isLocked ? `<div style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; border-radius:8px; pointer-events:none;"><span style="color:#ef4444; font-weight:bold;">🔒 דורש עירייה רמה ${unit.requiredTownHallLevel}</span></div>` : '';

        // PROGRESS BAR LOGIC
        let actionUI = '';

        if (activeTimer && activeTimer.unit === key) {
            // This unit is currently training
            const remaining = Math.ceil((activeTimer.endTime - Date.now()) / 1000);

            actionUI = `
                <div style="width:100%; text-align:center;">
                    <div style="font-size:0.8rem; color:#fbbf24; margin-bottom:2px;">מגייס ${activeTimer.amount}... (${remaining}s)</div>
                    <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                        <div class="progress-bar-stripes" style="width:100%; height:100%; background:#fbbf24;"></div>
                    </div>
                </div>
             `;
        } else if (activeTimer) {
            // Another unit is training -> Disable
            actionUI = `
                 <div style="text-align:center; color:#94a3b8; font-size:0.85rem; padding:5px;">
                    ⏳ אימון אחר בתהליך...
                 </div>
             `;
        } else {
            // Available to train
            actionUI = `
                <div class="unit-action">
                    <div style="display:flex; gap:3px; margin-bottom:5px; border:1px solid rgba(255,255,255,0.1); padding:2px; border-radius:4px; flex-wrap:wrap;">
                         <button class="btn-small-action" onclick="setTrainingAmount('${key}', 0.1)">10%</button>
                         <button class="btn-small-action" onclick="setTrainingAmount('${key}', 0.2)">20%</button>
                         <button class="btn-small-action" onclick="setTrainingAmount('${key}', 0.5)">50%</button>
                         <button class="btn-small-action" onclick="setTrainingAmount('${key}', 1.0)">Max</button>
                    </div>
                    <input type="number" id="train-amount-${key}" value="1" min="1" max="100" style="width:50px; padding:5px; border-radius:5px; border:1px solid #444; background:#222; color:white;" ${isLocked ? 'disabled' : ''}>
                    <button class="btn-primary" onclick="startTraining('${key}', document.getElementById('train-amount-${key}').value)" ${isLocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>גייס</button>
                </div>
             `;
        }

        html += `
            <div class="unit-card${lockedClass}" style="position:relative; ${isLocked ? 'opacity:0.6;' : ''} ${activeTimer && activeTimer.unit === key ? 'border-color:#fbbf24; background:rgba(251, 191, 36, 0.05);' : ''}">
                ${lockedOverlay}
                <div class="unit-icon">${unit.icon}</div>
                <div class="unit-info">
                    <div class="unit-name">${unit.name} <span class="unit-count">(יש לך: ${count})</span></div>
                    <div class="unit-stats">⚔️${unit.attack} 🛡️${unit.defense} 🎒${unit.cargo}</div>
                    <div class="unit-cost">${costs.join(' ')} | ⏳ ${unit.time}s</div>
                </div>
                ${!isLocked ? actionUI : '<div class="unit-action"></div>'}
            </div>
        `;
    }

    html += `</div></div>`; // Close list and container
    return html;
}

window.calculateMaxAffordable = function (unitKey) {
    const unit = UNIT_TYPES[unitKey];
    if (!unit) return 0;

    let max = Infinity;

    // Check all resources
    if (unit.cost.gold) max = Math.min(max, Math.floor((STATE.resources.gold || 0) / unit.cost.gold));
    if (unit.cost.wood) max = Math.min(max, Math.floor((STATE.resources.wood || 0) / unit.cost.wood));
    if (unit.cost.food) max = Math.min(max, Math.floor((STATE.resources.food || 0) / unit.cost.food));
    if (unit.cost.wine) max = Math.min(max, Math.floor((STATE.resources.wine || 0) / unit.cost.wine));
    if (unit.cost.marble) max = Math.min(max, Math.floor((STATE.resources.marble || 0) / unit.cost.marble));
    if (unit.cost.crystal) max = Math.min(max, Math.floor((STATE.resources.crystal || 0) / unit.cost.crystal));
    if (unit.cost.sulfur) max = Math.min(max, Math.floor((STATE.resources.sulfur || 0) / unit.cost.sulfur));

    return max === Infinity ? 0 : max;
};

window.setTrainingAmount = function (unitKey, percentage) {
    const max = calculateMaxAffordable(unitKey);
    const amount = Math.floor(max * percentage);
    const input = document.getElementById(`train-amount-${unitKey}`);
    if (input) {
        input.value = Math.max(1, amount); // Set at least 1 if possible, or 0? Usually 1 is better UX unless 0 affordable.
        if (amount === 0) input.value = 0;
    }
};

function renderAcademyContent() {
    let html = `
        <div class="barracks-view"> <!-- Reusing barracks style container -->
            <p style="margin-bottom:1rem">חקר טכנולוגיות חדשות לשיפור האימפריה.</p>
            <div class="unit-list">
    `;

    for (const [key, tech] of Object.entries(RESEARCH_TYPES)) {
        const lvl = (STATE.research && STATE.research[key]) || 0;

        // CHECK IF RESEARCHING THIS TECH
        const activeTimer = STATE.timers.find(t => t.type === 'research' && t.tech === key);

        // Calculate dynamic cost (1.5x per level)
        const woodCost = Math.floor(tech.cost.wood * Math.pow(1.5, lvl));
        const specialCostType = Object.keys(tech.cost).find(k => k !== 'wood');
        const specialCostVal = specialCostType ? Math.floor(tech.cost[specialCostType] * Math.pow(1.5, lvl)) : 0;

        const costs = [`${woodCost}🌲`];
        if (specialCostType) costs.push(`${specialCostVal}${getTypeIcon(specialCostType)}`);

        const time = Math.floor(tech.time * Math.pow(1.2, lvl));

        let actionBtn = '';
        if (activeTimer) {
            const remaining = Math.ceil((activeTimer.endTime - Date.now()) / 1000);
            const percent = Math.min(100, Math.max(0, 100 - (remaining / time * 100)));

            actionBtn = `
                <div style="width:100%; text-align:center;">
                    <div style="font-size:0.8rem; color:#fbbf24; margin-bottom:2px;">בתהליך... (${remaining}s)</div>
                    <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                        <div style="width:${percent}%; height:100%; background:#fbbf24; transition:width 1s linear;"></div>
                    </div>
                </div>
             `;
        } else {
            actionBtn = `<button class="btn-primary" style="background:#7e22ce" onclick="startResearch('${key}')">חקור</button>`;
        }

        html += `
            <div class="unit-card" style="${activeTimer ? 'border-color:#fbbf24; background:rgba(251, 191, 36, 0.05);' : ''}">
                <div class="unit-icon" style="border-color:#a855f7">${tech.icon}</div>
                <div class="unit-info">
                    <div class="unit-name">${tech.name} (רמה ${lvl})</div>
                    <div class="unit-stats" style="color:#d8b4fe">${tech.desc}</div>
                    <div class="unit-cost">${costs.join(' ')} | ⏳ ${time}s</div>
                </div>
                <div class="unit-action">
                    ${actionBtn}
                </div>
            </div>
        `;
    }

    html += `</div></div>`;
    return html;
}

window.startResearch = function (tech) {
    const data = RESEARCH_TYPES[tech];
    const lvl = (STATE.research && STATE.research[tech]) || 0;

    // Check for existing research
    if (STATE.timers.find(t => t.type === 'research')) {
        notify("המעבדה עסוקה במחקר אחר!", "error");
        return;
    }

    const woodCost = Math.floor(data.cost.wood * Math.pow(1.5, lvl));
    const specialCostType = Object.keys(data.cost).find(k => k !== 'wood');
    const specialCostVal = specialCostType ? Math.floor(data.cost[specialCostType] * Math.pow(1.5, lvl)) : 0;

    if ((STATE.resources.wood || 0) < woodCost || (specialCostType && (STATE.resources[specialCostType] || 0) < specialCostVal)) {
        notify("אין מספיק משאבים!", "error");
        return;
    }

    // Pay
    STATE.resources.wood -= woodCost;
    if (specialCostType) STATE.resources[specialCostType] -= specialCostVal;

    const time = Math.floor(data.time * Math.pow(1.2, lvl));

    STATE.timers.push({
        type: 'research',
        tech: tech,
        endTime: Date.now() + (time * 1000),
        desc: `חוקר ${data.name}`
    });

    notify(`החל מחקר: ${data.name}`, "success");
    saveGame(); // PERSIST
    closeModal();
    updateUI();
};

function renderTrainingQueue() {
    const unitTimers = STATE.timers.filter(t => t.type === 'unit');
    if (unitTimers.length === 0) return '';

    let html = `<h4 style="margin-bottom:5px; font-size:0.9rem; color:#94a3b8">תהליכי גיוס פעילים:</h4>`;

    unitTimers.forEach(t => {
        const remaining = Math.ceil((t.endTime - Date.now()) / 1000);
        const unitName = UNIT_TYPES[t.unit] ? UNIT_TYPES[t.unit].name : t.unit;

        // Simple progress calculation (optional, needs startTime in timer to be accurate, but we can just show time left)
        // For accurate progress bar we'd need total duration. We can reverse engineer or just show text for now.

        html += `
            <div class="queue-item">
                <div class="queue-info">
                    <span>${t.amount} ${unitName}</span>
                    <span class="queue-time">⏳ ${remaining}s</span>
                </div>
            </div>
        `;
    });
    return html;
}



window.attackEntity = function (x, y) {
    const key = `${x},${y}`;
    const targetEntity = STATE.mapEntities[key];
    if (!targetEntity) {
        notify("המטרה נעלמה!", "error");
        return;
    }

    // Check for friendly fire (Clan)
    if (STATE.clan && window.ALL_CLANS && window.ALL_CLANS[STATE.clan.id]) {
        const clan = window.ALL_CLANS[STATE.clan.id];
        // Check if target is a member of my clan (case-insensitive check handled by keys usually, but be safe)
        // Actually keys in members are usernames.
        if (targetEntity.user && clan.members[targetEntity.user]) {
            notify("לא ניתן לתקוף חבר קלאן!", "error");
            return;
        }
    }

    // Reuse the exact same class structure as Gathering Missions
    // This ensures CSS compatibility if 'mission-unit-row' is styled for gathering.
    let html = `
        <div class="mission-setup-view">
            <p>בחר את הכוחות שברצונך לשלוח להתקפה על <b>${targetEntity.name}</b>:</p>
            <div class="mission-units-grid">
    `;

    let hasUnits = false;
    for (const [type, count] of Object.entries(STATE.army)) {
        if (count > 0 && UNIT_TYPES[type]) {
            hasUnits = true;
            const unit = UNIT_TYPES[type];
            html += `
                <div class="mission-unit-row" style="flex-wrap: wrap; gap: 5px;">
                    <div class="u-icon">${unit.icon}</div>
                    <div class="u-name" style="flex:1;">${unit.name} <span class="u-avail">(זמין: ${count})</span></div>
                    <input type="number" id="attack-inp-${type}" data-type="${type}" value="${count}" min="0" max="${count}" class="u-input" style="width: 80px;">
                    
                    <div class="perc-btns" style="width: 100%; display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px;">
                        <button class="p-btn" onclick="setAttackAmount('${type}', ${count}, 0.1)">10%</button>
                        <button class="p-btn" onclick="setAttackAmount('${type}', ${count}, 0.25)">25%</button>
                        <button class="p-btn" onclick="setAttackAmount('${type}', ${count}, 0.5)">50%</button>
                        <button class="p-btn" onclick="setAttackAmount('${type}', ${count}, 1.0)">Max</button>
                    </div>
                </div>
            `;
        }
    }

    // Embed styles for the buttons
    html += `
        <style>
            .p-btn {
                background: #334155;
                border: 1px solid #475569;
                color: #e2e8f0;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            .p-btn:hover { background: #475569; }
        </style>
    `;

    if (!hasUnits) {
        notify("אין לך צבא זמין להתקפה!", "error");
        return;
    }

    html += `
            </div>
            <div class="attack-summary" style="margin-top:15px; border-top:1px solid #444; padding-top:10px; text-align:center; color:#eab308; font-weight:bold;">
                 ⚠️ התקפה יכולה להוביל לאבידות!
            </div>
        </div>
    `;

    openModal(`התקפה על ${targetEntity.name}`, html, "צא לקרב! ⚔️", () => confirmAttack(x, y));
};

window.confirmAttack = async function (x, y) {
    const key = `${x},${y}`;
    const targetEntity = STATE.mapEntities[key];

    // 1. Collect Selected Units
    const inputs = document.querySelectorAll('.mission-unit-row input');
    const selectedArmy = {};
    let totalUnits = 0;

    inputs.forEach(inp => {
        const type = inp.dataset.type;
        const amount = parseInt(inp.value) || 0;
        if (amount > 0) {
            selectedArmy[type] = amount;
            totalUnits += amount;
        }
    });

    if (totalUnits === 0) {
        notify("עליך לבחור לפחות חייל אחד!", "error");
        return;
    }

    // 2. Validate & Deduct Units
    for (const [type, amount] of Object.entries(selectedArmy)) {
        if (STATE.army[type] < amount) {
            notify(`שגיאה: אין מספיק ${UNIT_TYPES[type].name}`, "error");
            return;
        }
    }

    // Deduct locally for now (visual)
    for (const [type, amount] of Object.entries(selectedArmy)) {
        STATE.army[type] -= amount;
    }

    notify("שולח כוחות לשרת...", "info");
    closeModal();

    // 3. Start Mission via Server
    try {
        const response = await fetch('/api/attack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attacker: CURRENT_USER,
                targetX: x,
                targetY: y,
                troops: selectedArmy
            })
        });

        const result = await response.json();

        if (!result.success) {
            notify("שגיאה בהתקפה: " + result.message, "error");
            // Refund troops if server failed
            for (const [type, amount] of Object.entries(selectedArmy)) {
                STATE.army[type] += amount;
            }
            return;
        }

        // 4. Start Visual Timer
        const travelTime = calculateTravelTime(x, y);
        const totalDuration = (travelTime * 2 + 5);

        STATE.timers.push({
            type: 'mission',
            subtype: 'attack',
            targetKey: key,
            originKey: STATE.homeCoords.x + ',' + STATE.homeCoords.y,
            startTime: Date.now(),
            units: selectedArmy,
            endTime: Date.now() + (totalDuration * 1000),
            desc: `התקפה על ${targetEntity.name}`,
            // Store Server Result for when they return
            serverResult: result
        });

        notify(`הצבא יצא לקרב! הגעה ב-${travelTime} שניות.`, "success");
        updateUI();

    } catch (e) {
        console.error(e);
        notify("שגיאת תקשורת עם השרת", "error");
        // Refund troops
        for (const [type, amount] of Object.entries(selectedArmy)) {
            STATE.army[type] += amount;
        }
    }
};

function resolveBattle(attackingArmy, target, defenderData = null) {
    let myPower = 0;
    let myCargo = 0;

    // Bonuses
    const weaponryLvl = (STATE.research && STATE.research.weaponry) || 0;
    const logisticsLvl = (STATE.research && STATE.research.logistics) || 0;
    const powerMulti = 1 + (weaponryLvl * 0.05);
    const cargoMulti = 1 + (logisticsLvl * 0.05);

    for (const [key, count] of Object.entries(attackingArmy)) {
        if (count > 0 && UNIT_TYPES[key]) {
            myPower += count * UNIT_TYPES[key].attack * powerMulti;
            myCargo += count * UNIT_TYPES[key].cargo * cargoMulti;
        }
    }

    const targetLevel = target.level || 1;
    let targetPower = 0;
    let defenderArmy = {};
    let defenderResources = {};

    // Determine if this is a player city
    const isPlayerCity = target.type === 'city' && target.user && target.user !== 'NPC';

    // Check if we have actual defender data (player city)
    if (defenderData && defenderData.army) {
        // Calculate defender power from actual army
        defenderArmy = defenderData.army;
        for (const [key, count] of Object.entries(defenderArmy)) {
            if (count > 0 && UNIT_TYPES[key]) {
                targetPower += count * UNIT_TYPES[key].defense;
            }
        }
        // Get actual resources for looting
        defenderResources = defenderData.resources || {};
    } else if (isPlayerCity) {
        // Player city with no defenderData = no army = no power!
        targetPower = 0;
        defenderArmy = {};
        defenderResources = {};
    } else if (target.type === 'monster') {
        // Monster has fixed power
        targetPower = (targetLevel * 50) + Math.floor(Math.random() * targetLevel * 20) + 100;
    } else {
        // NPC/Resource node - base power only from level
        targetPower = (targetLevel * 50) + Math.floor(Math.random() * targetLevel * 20);
    }

    if (myPower > targetPower) {
        // Victory - Calculate Loot
        const loot = { gold: 0, wood: 0 };
        let capacity = myCargo;

        if (defenderData && defenderResources) {
            // Loot from actual player resources (30% of their resources, capped by cargo)
            const lootPercent = 0.3;
            const availableGold = Math.floor((defenderResources.gold || 0) * lootPercent);
            const availableWood = Math.floor((defenderResources.wood || 0) * lootPercent);

            loot.gold = Math.min(availableGold, capacity);
            capacity -= loot.gold;
            loot.wood = Math.min(availableWood, capacity);
        } else {
            // NPC/Monster - use old formula
            const baseLoot = targetLevel * 200;
            loot.gold = Math.min(baseLoot, capacity);
            capacity -= loot.gold;
            loot.wood = Math.min(baseLoot, capacity);
        }

        return {
            won: true,
            loot: loot,
            targetPower: targetPower,
            defenderArmy: defenderArmy,
            defenderLevel: targetLevel
        };
    } else {
        return {
            won: false,
            loot: {},
            targetPower: targetPower,
            defenderArmy: defenderArmy,
            defenderLevel: targetLevel
        };
    }
}

// Old attackPlayer removed

/**
 * Helpers
 */
window.setGatherAmount = function (type, max, percent) {
    const val = Math.floor(max * percent);
    const inp = document.getElementById(`gather-inp-${type}`);
    if (inp) inp.value = val;
};

window.setAttackAmount = function (type, max, percent) {
    const val = Math.floor(max * percent);
    const inp = document.getElementById(`attack-inp-${type}`);
    if (inp) inp.value = val;
};

window.setConquestAmount = function (type, max, percent) {
    const val = Math.floor(max * percent);
    const inp = document.getElementById(`conquest-inp-${type}`);
    if (inp) inp.value = val;
};

function getTypeIcon(type) {
    switch (type) {
        case 'gold': return '💰';
        case 'wood': return '🌲';
        case 'wine': return '🍷';
        case 'marble': return '🏛️';
        case 'crystal': return '💎';
        case 'sulfur': return '🌋';
        default: return '';
    }
}

function openModal(title, content, actionText, actionCallback) {
    els.modalTitle.innerText = title;
    els.modalBody.innerHTML = content;
    els.modalBtn.innerText = actionText;

    // Remove old listeners to prevent stacking
    const newBtn = els.modalBtn.cloneNode(true);
    els.modalBtn.parentNode.replaceChild(newBtn, els.modalBtn);
    els.modalBtn = newBtn;

    els.modalBtn.onclick = actionCallback;
    els.modal.classList.remove('hidden');
}

function closeModal() {
    els.modal.classList.add('hidden');
    currentModalAction = null; // Reset action to stop auto-refresh
}

function notify(msg, type) {
    // Simple toast or alert
    // Ideally a nice floating div
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.background = type === 'error' ? '#ef4444' : '#22c55e';
    div.style.color = 'white';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '20px';
    div.style.zIndex = '9999';
    div.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

window.openMessageModal = function (toUser, defaultSubject = '') {
    // Switch to mailbox, chat tab, and open specific chat
    // If it's a new conversation, we initialize it in Mailbox.openChat or setState

    if (!STATE.chats) STATE.chats = {};
    if (!STATE.chats[toUser]) STATE.chats[toUser] = [];

    Mailbox.open();
    Mailbox.setTab('chat');
    Mailbox.openChat(toUser);

    // If there was a subject (e.g. from reply), maybe pre-fill input? 
    // For now, simple chat doesn't use subjects.
};

// Init
window.onload = () => {
    switchView('login'); // Start at Login

    // Auto-fill last user
    const lastUser = localStorage.getItem('vikings_last_user');
    if (lastUser) {
        const input = document.getElementById('username');
        if (input) input.value = lastUser;
    }

}; // End onload

// Data recovery tool removed (Server Migration)


// --- HYBRID API SYSTEM (Online + Backup) ---

// Dynamic URL: If file:// use localhost, else use relative path (works for LAN/Phone)
const API_URL = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : '/api';

let IS_ONLINE = false; // Connection Status Flag

window.getTypeIcon = function (type) {
    if (type === 'wood') return '🌲';
    if (type === 'gold') return '💰';
    if (type === 'food') return '🌾';
    if (type === 'wine') return '🍷';
    if (type === 'marble') return '🏛️';
    if (type === 'crystal') return '💎';
    if (type === 'sulfur') return '🌋';
    return '📦';
};

window.getEntityIcon = function (type) {
    switch (type) {
        case 'city': return '🏰';
        case 'barbarian': return '⛺';
        case 'monster': return '🐉';
        case 'mine': return '⛏️';
        case 'wood': return '🌲';
        case 'field': return '🌾'; // Wheat
        case 'farm': return '🍇'; // Wine
        case 'quarry': return '🏛️';
        case 'crystal': return '💎';
        default: return '❓';
    }
};

// --- City Profile Logic ---
function renderCityProfile() {
    // 1. Calculate Building Levels
    let buildingsHtml = '<ul class="profile-list">';
    if (STATE.buildings) {
        for (const [key, build] of Object.entries(STATE.buildings)) {
            if (build.level > 0) {
                buildingsHtml += `<li><strong>${build.name}:</strong> רמה ${build.level}</li>`;
            }
        }
    }
    buildingsHtml += '</ul>';
    if (buildingsHtml === '<ul class="profile-list"></ul>') buildingsHtml = '<p>אין מבנים עדיין.</p>';

    // 2. Calculate Army Power & Upkeep
    let armyHtml = '<ul class="profile-list">';
    let totalTroops = 0;
    let totalUpkeep = 0;
    if (STATE.army) {
        for (const [unit, count] of Object.entries(STATE.army)) {
            if (count > 0) {
                let unitName = unit === 'spearman' ? 'נושא חנית' : (unit === 'archer' ? 'קשת' : 'לוחם');
                let upkeep = (UNIT_TYPES[unit] ? UNIT_TYPES[unit].upkeep : 1) * count;
                totalUpkeep += upkeep;
                armyHtml += `<li>
                    <span><strong>${unitName}:</strong> ${count}</span>
                    <span style="float:left; font-size:0.9rem; color:#fca5a5;">🍽️ -${upkeep}/שעה</span>
                </li>`;
                totalTroops += count;
            }
        }
    }
    armyHtml += '</ul>';
    if (totalTroops === 0) {
        armyHtml = '<p>אין צבא פעיל.</p>';
    } else {
        armyHtml += `<div style="border-top:1px solid rgba(255,255,255,0.1); margin-top:5px; padding-top:5px; text-align:left; color:#f87171;">
            <strong>סה"כ צריכה: -${totalUpkeep} 🌾 / שעה</strong>
        </div>`;
    }

    // 3. Controlled Territories List (NEW)
    let territoryHtml = '<ul class="profile-list">';
    let territoryCount = 0;

    if (STATE.mapEntities) {
        Object.entries(STATE.mapEntities).forEach(([key, ent]) => {
            // Check ownership and exclude own city
            if (ent.owner === CURRENT_USER && ent.type !== 'city' && ent.type !== 'fortress') {
                territoryCount++;
                const icon = getEntityIcon(ent.type);
                // Extract coords from key
                const [tx, ty] = key.split(',');

                territoryHtml += `
                    <li style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${icon} <strong>${ent.name}</strong> (Lv.${ent.level || 1})</span>
                        <span style="font-size:0.8rem; color:#94a3b8; cursor:pointer;" onclick="closeModal(); navigateToMapSearch(${tx}, ${ty});">📍 צפה במפה</span>
                    </li>
                `;
            }
        });
    }
    territoryHtml += '</ul>';

    if (territoryCount === 0) territoryHtml = '<p style="color:#94a3b8">לא נכבשו שטחים עדיין.</p>';

    // 4. Calculate Income Rates (Hourly)
    let incomeHtml = '<div class="profile-grid">';
    const rates = { gold: 0, wood: 0, food: 0, wine: 0, marble: 0, crystal: 0, sulfur: 0 };

    // Base Rates per hour
    rates.gold += (STATE.resources.citizens || 0) * 0.1 * 3600;

    let woodBonus = 0;
    if (STATE.island && STATE.island.sawmill) {
        woodBonus = STATE.island.sawmill.level * 0.1;
    }
    rates.wood += 5 * (1 + woodBonus) * 3600;

    // Territory Income via mapEntities
    if (STATE.mapEntities) {
        // Progressive bonuses: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540]
        const levelBonuses = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540];

        Object.values(STATE.mapEntities).forEach(ent => {
            if (ent.owner === CURRENT_USER && ent.resource) {
                const level = ent.level || 1;
                const bonusPercent = levelBonuses[level - 1] || 0;
                // Base production: 1 resource/second = 3600/hour
                const baseProduction = 3600;
                const production = baseProduction * (100 + bonusPercent) / 100;

                if (rates[ent.resource] !== undefined) {
                    rates[ent.resource] += production;
                }
            }
        });
    }

    // Format for display
    for (const [res, rate] of Object.entries(rates)) {
        if (rate > 0) {
            incomeHtml += `<div class="stat-item"><span class="icon">${getTypeIcon(res)}</span> +${Math.floor(rate).toLocaleString()}/שעה</div>`;
        }
    }
    incomeHtml += '</div>';
    if (incomeHtml === '<div class="profile-grid"></div>') incomeHtml = '<p>אין הכנסה משטחים.</p>';

    // 5. War Stats
    const stats = STATE.stats || { battles: 0, wins: 0, losses: 0 };
    const warHtml = `
        <div class="stats-row">
            <div class="stat-box">⚔️ קרבות: ${stats.battles}</div>
            <div class="stat-box win">🏆 נצחונות: ${stats.wins}</div>
            <div class="stat-box loss">💀 הפסדים: ${stats.losses}</div>
        </div>
    `;

    return `
        <div class="city-profile">
            <h2>📜 פרופיל העיר</h2>
            
            <div class="profile-section">
                <h3>🏘️ מבנים</h3>
                ${buildingsHtml}
            </div>

            <div class="profile-section">
                <h3>🌍 שטחים בשליטה (${territoryCount})</h3>
                ${territoryHtml}
            </div>

            <div class="profile-section">
                <h3>⚔️ כוח צבאי</h3>
                ${armyHtml}
            </div>

            <div class="profile-section">
                <h3>📈 כלכלה (הכנסה לשעה)</h3>
                ${incomeHtml}
            </div>

             <div class="profile-section">
                <h3>🏆 היסטוריה צבאית</h3>
                ${warHtml}
            </div>
        </div>
    `;
}

window.openCityProfile = function () {
    try {
        const profileHtml = renderCityProfile();
        // Use the existing helper which handles the correct DOM IDs
        openModal("פרופיל העיר", profileHtml, "סגור", closeModal);

        // Optional: Hide the default action button if we want custom buttons inside, 
        // but for now "Close" as the main action is fine.
    } catch (err) {
        console.error("City Profile Error:", err);
        notify("שגיאה בפתיחת הפרופיל: " + err.message, "error");
    }
};

// --- API ---
const API = {
    async checkConnection() {
        try {
            // Simple ping or just checking if we can fetch
            // We'll trust the first Login/Register attempt to set this
            // But let's try a light fetch if needed.
            // For now, we assume offline until proven online.
        } catch (e) {
            IS_ONLINE = false;
        }
    },

    async register(username, password, state) {
        // 1. Try Online
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, state }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                IS_ONLINE = true;
                return await response.json();
            } else {
                // Server returned error (e.g. 400 taken)
                const errData = await response.json();
                throw new Error(errData.message || 'Server Error');
            }
        } catch (err) {
            console.warn("Server unreachable (Register), falling back to LocalStorage:", err);
            IS_ONLINE = false;

            // 2. Fallback: LocalStorage
            const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
            if (users[username]) {
                return { success: false, message: 'שם משתמש תפוס (Backup Mode)' };
            }
            users[username] = { password, state };
            localStorage.setItem('vikings_users', JSON.stringify(users));
            return { success: true, mode: 'offline' };
        }
    },

    async login(username, password) {
        // 1. Try Online
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                IS_ONLINE = true;
                return await response.json();
            } else {
                // 401 or 404
                const errData = await response.json();
                throw new Error(errData.message || 'Login Failed');
            }
        } catch (err) {
            // If it's a real logic error (401), rethrow. 
            // Only capture Network/Timeout errors for fallback.
            if (err.message === 'Incorrect password' || err.message === 'User not found') {
                throw err;
            }

            console.warn("Server unreachable (Login), falling back to LocalStorage:", err);
            IS_ONLINE = false;

            // 2. Fallback: LocalStorage
            const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
            const user = users[username];

            if (!user) {
                // AUTO-REGISTER in Offline Mode (Fix for new machines)
                const newUser = {
                    username: username,
                    password: password,
                    state: JSON.parse(JSON.stringify(DEFAULT_STATE)),
                    mode: 'offline'
                };
                users[username] = newUser;
                localStorage.setItem('vikings_users', JSON.stringify(users));

                return { success: true, state: newUser.state, mode: 'offline (auto-created)' };
            }
            if (user.password !== password) {
                return { success: false, message: 'סיסמא שגויה (Backup Mode)' };
            }
            return { success: true, state: user.state, mode: 'offline' };
        }
    },

    async getWorldState() {
        if (!IS_ONLINE) return [];
        try {
            const res = await fetch(`${API_URL}/world`);
            if (res.ok) {
                const data = await res.json();
                return data.players || [];
            }
        } catch (e) {
            console.warn("Failed to fetch world state", e);
        }
        return [];
    },

    async save(username, state) {
        if (IS_ONLINE) {
            try {
                const res = await fetch(`${API_URL}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, state })
                });
                const data = await res.json();

                // Handle merged reports
                if (data.success && data.merged) {
                    if (data.merged.reports) STATE.reports = data.merged.reports;
                    if (data.merged.chats) {
                        STATE.chats = data.merged.chats;
                        // Update badge if mailbox is open?
                        if (window.Mailbox && Mailbox.updateChatBadge) Mailbox.updateChatBadge();
                    }
                }

                // Handle forced resource sync (Anti-Overwrite Protection)
                if (data.success && data.forceUpdateResources) {
                    console.warn("⚠️ Server forced resource update (Trade Sync)", data.forceUpdateResources);
                    STATE.resources = data.forceUpdateResources;
                    if (typeof renderResources === 'function') renderResources();
                }

                return data;
            } catch (err) {
                console.warn("Lost connection during save. Switching to Offline.", err);
                IS_ONLINE = false;
                // Fallthrough to local save
            }
        }

        // Local Save
        const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
        if (users[username]) {
            users[username].state = state;
            localStorage.setItem('vikings_users', JSON.stringify(users));
        }
        return true;
    },

    async checkConnection() {
        try {
            console.log("Checking server connection...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            // Fetch world state as a lightweight ping (or add a specific status endpoint later)
            const res = await fetch(`${API_URL}/world`, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                IS_ONLINE = true;
                console.log("🟢 Server is ONLINE");
            } else {
                IS_ONLINE = false;
                console.log("🟠 Server is OFFLINE (Status " + res.status + ")");
            }
        } catch (e) {
            IS_ONLINE = false;
            console.log("🟠 Server is OFFLINE (Unreachable)");
        }
        updateConnectionStatusUI();
        return IS_ONLINE;
    }
};

// --- SYNC LOOP ---
setInterval(async () => {
    if (CURRENT_USER && IS_ONLINE) {
        await syncWorldPlayers();
    }
}, 5000); // Sync every 5 seconds

async function syncWorldPlayers() {
    try {
        const response = await fetch(`${API_URL}/world`);
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch world data");
            return;
        }

        // Clear existing player cities (but keep resources/barbarians/rebels)
        for (const key in STATE.mapEntities) {
            if (STATE.mapEntities[key].type === 'city' && !STATE.mapEntities[key].isMyCity) {
                delete STATE.mapEntities[key];
            }
        }

        // Add player cities with clan tags
        data.players.forEach(p => {
            const key = `${p.x},${p.y}`;
            STATE.mapEntities[key] = {
                type: 'city',
                name: `${p.username}'s City`,
                user: p.username,
                level: p.level || 1,
                score: p.score || 0,
                lastLogin: p.lastLogin,
                clanTag: p.clanTag || null,
                isMyCity: false
            };
        });

        // Add clan fortresses (2x2 entities)
        if (data.fortresses) {
            data.fortresses.forEach(f => {
                // Mark all 4 tiles as fortress
                for (let dx = 0; dx < 2; dx++) {
                    for (let dy = 0; dy < 2; dy++) {
                        const key = `${f.x + dx},${f.y + dy}`;
                        STATE.mapEntities[key] = {
                            type: 'fortress',
                            name: `${f.clanName} Fortress`,
                            clanId: f.clanId,
                            clanName: f.clanName,
                            clanTag: f.clanTag,
                            fortressX: f.x, // Top-left corner
                            fortressY: f.y,
                            isCenter: (dx === 0 && dy === 0) // Only top-left is "center"
                        };
                    }
                }
            });
        }

        console.log(`Synced ${data.players.length} cities and ${data.fortresses?.length || 0} fortresses from server`);

        // Re-render if looking at world map
        if (document.getElementById('world-map-grid')) {
            renderWorldMap();
        }
    } catch (err) {
        console.error("Failed to sync world:", err);
    }
}

window.handleRegister = async function () {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const msg = document.getElementById('login-msg');

    if (!user || !pass) {
        msg.innerText = "אנא מלא שם משתמש וסיסמא";
        msg.style.color = "#ef4444";
        return;
    }

    msg.innerText = "בודק חיבור לשרת...";
    msg.style.color = "#fbbf24";

    try {
        const SAFE_DEFAULT = JSON.parse(JSON.stringify(DEFAULT_STATE));

        // RANDOM SPAWN LOGIC (World is 100x100)
        // Spawn within range 10-90 to avoid edges
        const startX = Math.floor(Math.random() * 80) + 10;
        const startY = Math.floor(Math.random() * 80) + 10;

        SAFE_DEFAULT.homeCoords = { x: startX, y: startY };
        SAFE_DEFAULT.viewport = { x: startX, y: startY };

        // Create initial City Entity
        SAFE_DEFAULT.mapEntities[`${startX},${startY}`] = {
            type: 'city',
            name: `${user}'s City`,
            user: user,
            level: 1,
            isMyCity: true,
            lastLogin: Date.now()
        };

        const data = await API.register(user, pass, SAFE_DEFAULT);

        if (data.success) {
            msg.innerText = data.mode === 'offline'
                ? "נרשמת בהצלחה (מצב גיבוי)! מתחבר..."
                : "נרשמת בהצלחה! מתחבר...";
            msg.style.color = "#22c55e";
            setTimeout(() => handleLogin(), 1000);
        } else {
            msg.innerText = data.message || "שגיאה בהרשמה";
            msg.style.color = "#ef4444";
        }
    } catch (err) {
        msg.innerText = err.message || "שגיאה בהרשמה";
        msg.style.color = "#ef4444";
    }
};

window.handleLogin = async function () {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const msg = document.getElementById('login-msg');

    if (!user || !pass) {
        msg.innerText = "אנא מלא שם משתמש וסיסמא";
        msg.style.color = "#ef4444";
        return;
    }

    msg.innerText = "מתחבר...";

    try {
        const data = await API.login(user, pass);

        if (data.success) {
            msg.innerText = "התחברת בהצלחה!";
            msg.style.color = "#22c55e";

            // Load User
            CURRENT_USER = data.username || user; // Fix: Use canonical casing
            STATE = data.state;

            // Migration / Init checks
            initializeGameState();

            // FIX: Always center on home when logging in
            if (STATE.homeCoords) {
                STATE.viewport = { ...STATE.homeCoords };
            }

            switchView('world');
            updateUI();

            // Show Connection Status Indicator
            updateConnectionStatusUI();

        } else {
            msg.innerText = data.message || "שגיאה בהתחברות";
            msg.style.color = "#ef4444";
        }
    } catch (err) {
        console.error(err);
        msg.innerText = err.message || "שגיאת שרת";
        msg.style.color = "#ef4444";
    }
};

function updateConnectionStatusUI() {
    let statusEl = document.getElementById('conn-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'conn-status';
        statusEl.style.position = 'fixed';
        statusEl.style.bottom = '10px';
        statusEl.style.left = '10px';
        statusEl.style.padding = '5px 10px';
        statusEl.style.borderRadius = '5px';
        statusEl.style.fontSize = '0.8rem';
        statusEl.style.fontWeight = 'bold';
        statusEl.style.zIndex = '10000';
        document.body.appendChild(statusEl);
    }

    if (IS_ONLINE) {
        statusEl.innerText = "🟢 מחובר לשרת";
        statusEl.style.background = "rgba(22, 163, 74, 0.8)";
        statusEl.style.color = "white";
    } else {
        statusEl.innerText = "🟠 מצב גיבוי (Offline)";
        statusEl.style.background = "rgba(234, 88, 12, 0.8)";
        statusEl.style.color = "white";
    }
}

// Override Save
async function saveGame() {
    if (!CURRENT_USER) return;
    await API.save(CURRENT_USER, STATE);
    // Silent save, maybe update indicator if status changed
    updateConnectionStatusUI();
}

function initializeGameState() {
    // Ensure vital state objects exist (migration from old saves)
    if (!STATE.viewport) STATE.viewport = { x: 500, y: 500 };
    if (!STATE.mapEntities) STATE.mapEntities = {};
    if (!STATE.homeCoords) STATE.homeCoords = { x: 500, y: 500 }; // Default home

    // Ensure Player City Exists on Map
    const homeKey = `${STATE.homeCoords.x},${STATE.homeCoords.y}`;
    if (!STATE.mapEntities[homeKey]) {
        STATE.mapEntities[homeKey] = {
            type: 'city',
            name: `${CURRENT_USER} City`,
            user: CURRENT_USER,
            level: 1,
            isMyCity: true
        };
        // Auto-save this critical fix
        setTimeout(() => saveGame(), 1000);
    }

    if (!STATE.army) STATE.army = JSON.parse(JSON.stringify(DEFAULT_STATE.army));
    if (!STATE.research) STATE.research = JSON.parse(JSON.stringify(DEFAULT_STATE.research));

    // Buildings
    const buildingKeys = Object.keys(DEFAULT_STATE.buildings);
    for (const key of buildingKeys) {
        if (!STATE.buildings[key]) {
            STATE.buildings[key] = JSON.parse(JSON.stringify(DEFAULT_STATE.buildings[key]));
        }
        STATE.buildings[key].name = DEFAULT_STATE.buildings[key].name; // Sync names
    }

    notify(`ברוך הבא, ${CURRENT_USER}!`, "success");

    // ROBUST RECOVERY: Ensure city exists and is visible
    ensureCityExistsAndRender();

    // MAILBOX INIT
    if (!STATE.reports) STATE.reports = [];
    if (window.Mailbox) {
        Mailbox.updateBadge();
        // Welcome Mail if empty
        if (STATE.reports.length === 0) {
            Mailbox.addReport('system', 'ברוך הבא!', { loot: {} });
        }
    }

    // MISSIONS INIT
    if (window.Missions) Missions.init();
}


window.runDiagnostics = function () {
    const v = STATE.viewport;
    const h = STATE.homeCoords;
    const key = `${h.x},${h.y}`;
    const entity = STATE.mapEntities[key];
    const domEl = document.querySelector('.entity-my-city');

    const report = `
    === DIAGNOSTICS ===
    Viewport: ${v.x}, ${v.y}
    Home: ${h.x}, ${h.y}
    Distance: ${Math.sqrt(Math.pow(v.x - h.x, 2) + Math.pow(v.y - h.y, 2))}
    
    Entity Data: ${entity ? 'EXISTS' : 'MISSING'}
    Entity Type: ${entity ? entity.type : 'N/A'}
    
    DOM Element: ${domEl ? 'VISIBLE' : 'NOT FOUND'}
    Grid Children: ${document.getElementById('world-map-grid')?.children.length || 0}
    `;

    alert(report);

};


function switchView(viewName) {
    try {
        window.activeView = viewName; // Track current view
        const main = els.mainView;
        if (!main) {
            console.error("Main view element not found!");
            notify("שגיאה קריטית: אלמנט ראשי חסר", "error");
            return;
        }

        main.innerHTML = ''; // Clear current view

        // Toggle Global UI based on Login state
        if (viewName === 'login') {
            if (els.nav) els.nav.style.display = 'none';
            if (els.header) els.header.style.display = 'none';

            const tpl = document.getElementById('template-login');
            if (tpl) {
                main.appendChild(tpl.content.cloneNode(true));
            } else {
                console.error("Template 'template-login' not found!");
            }

        } else {
            if (els.nav) els.nav.style.display = 'flex';
            if (els.header) els.header.style.display = 'flex';

            if (viewName === 'city') {
                const tpl = document.getElementById('template-city');
                if (!tpl) {
                    throw new Error("Template 'template-city' not found!");
                }
                main.appendChild(tpl.content.cloneNode(true));
                renderCityStats();
                setupCityInteractions(); // Bind events directly to elements

                // Update building labels with current levels - INLINE
                setTimeout(() => {
                    const labelMap = {
                        'townHall': 'label-townhall-lvl',
                        'academy': 'label-academy-lvl',
                        'warehouse': 'label-warehouse-lvl',
                        'barracks': 'label-barracks-lvl',
                        'lumber': 'label-lumber-lvl',
                        'mine': 'label-mine-lvl',
                        'port': 'label-port-lvl'
                    };

                    for (const [key, labelId] of Object.entries(labelMap)) {
                        const building = STATE.buildings[key];
                        const labelEl = document.getElementById(labelId);
                        if (building && labelEl) {
                            labelEl.innerText = building.level;
                        }
                    }
                }, 100);

                // TUTORIAL TRIGGER
                if (window.Tutorial) {
                    setTimeout(() => Tutorial.init(), 500);
                }

                // CENTER SCROLL (Desktop & Mobile)
                if (typeof centerCityView === 'function') {
                    // Single attempt after slight delay to allow layout
                    setTimeout(centerCityView, 100);
                }
            } else if (viewName === 'island') {
                // DEPRECATED: Redirect to World
                switchView('world');
                return;
            } else if (viewName === 'world') {
                const tpl = document.getElementById('template-world');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                    // Load territories from server first, then render map
                    loadAllTerritories().then(() => {
                        renderWorldMap();
                        requestAnimationFrame(centerMapOnHome);
                    }).catch(err => {
                        console.error('Error loading territories:', err);
                        // Render anyway even if territories fail to load
                        renderWorldMap();
                        requestAnimationFrame(centerMapOnHome);
                    });
                } else {
                    throw new Error("Template 'template-world' not found!");
                }
            } else if (viewName === 'mailbox') {
                const tpl = document.getElementById('template-mailbox');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                } else {
                    throw new Error("Template 'template-mailbox' not found!");
                }
            } else if (viewName === 'missions') {
                const tpl = document.getElementById('template-missions');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                } else {
                    throw new Error("Template 'template-missions' not found!");
                }
            } else if (viewName === 'clan') {
                const tpl = document.getElementById('template-clan');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                    if (window.ClanUI) {
                        ClanUI.render();
                    }
                } else {
                    throw new Error("Template 'template-clan' not found!");
                }
            } else if (viewName === 'players') {
                const tpl = document.getElementById('template-players');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                } else {
                    throw new Error("Template 'template-players' not found!");
                }
            } else if (viewName === 'market') {
                const tpl = document.getElementById('template-market');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                    if (window.Market) {
                        Market.init();
                    }
                } else {
                    throw new Error("Template 'template-market' not found!");
                }
            } else if (viewName === 'rankings') {
                const tpl = document.getElementById('template-rankings');
                if (tpl) {
                    main.appendChild(tpl.content.cloneNode(true));
                    if (window.Rankings) {
                        Rankings.init();
                    }
                } else {
                    throw new Error("Template 'template-rankings' not found!");
                }
            } else {
                throw new Error("Unknown view: " + viewName);
            }
        }
    } catch (err) {
        notify("שגיאה בטעינת המסך: " + err.message, "error");
    }
}

// --- CHEATS ---
window.activateCheat = function () {
    // Only add army, no resources!
    if (!STATE.army) STATE.army = {};
    STATE.army.spearman = (STATE.army.spearman || 0) + 10000;
    STATE.army.archer = (STATE.army.archer || 0) + 10000;
    STATE.army.swordsman = (STATE.army.swordsman || 0) + 10000;
    STATE.army.axeman = (STATE.army.axeman || 0) + 10000;
    STATE.army.cavalry = (STATE.army.cavalry || 0) + 10000;

    updateUI();
    saveGame();
    notify("⚔️ 50,000 חיילים נוספו לצבא שלך!", "success");
};
window.boostAccount = function () {
    if (!confirm("⚠️ אזהרה: כפתור זה הוא למטרות פיתוח בלבד!\nהוא יעלה את כל המשאבים והמבנים לרמה מקסימלית.\nלהמשיך?")) return;

    // 1. Resources
    Object.keys(STATE.resources).forEach(key => {
        STATE.resources[key] = 1000000;
    });

    // 2. Army
    if (!STATE.army) STATE.army = {};
    Object.keys(STATE.army).forEach(key => {
        STATE.army[key] = 1000000;
    });

    // 3. Buildings
    if (STATE.buildings) {
        Object.keys(STATE.buildings).forEach(key => {
            STATE.buildings[key].level = 50;
        });
    }

    saveGame();
    updateUI();
    notify("🚀 God Mode Activated! Power Overwhelming!", "success_major");
    setTimeout(() => location.reload(), 1500);
};

// Add Hidden Cheat Button (DISABLED PER USER REQUEST)
/*
setTimeout(() => {
    const header = document.querySelector('header');
    if (header) {
        const btn = document.createElement('button');
        btn.innerText = '⚡';
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.fontSize = '1.2rem';
        btn.style.cursor = 'pointer';
        btn.onclick = window.boostAccount;
        btn.title = 'God Mode (Admin)';
        header.appendChild(btn);
    }
}, 2000);
*/

// --- Menu & Guide Logic ---
window.toggleMainMenu = function () {
    const menu = document.getElementById('main-menu-dropdown');
    if (menu) {
        if (menu.style.display === 'none') {
            menu.style.display = 'flex';
            // Update badges in menu
            updateMenuBadges();
        } else {
            menu.style.display = 'none';
        }
    }
};

function updateMenuBadges() {
    // Mail Badge
    const mailBadge = document.getElementById('menu-badge-mail');
    // Check for NEW messages (using simpler logic for now: do we have unread reports?)
    // Actually, Mailbox logic handles its own badges. Let's try to sync.
    // Ideally Mailbox.js should update this, but we can do a quick check here
    const unreadReports = (STATE.reports || []).filter(r => !r.read && r.type !== 'chat').length;
    // Check chats?
    // We reuse the logic from Mailbox.updateChatBadge if possible, or just check generic
    // Simple check:
    if (mailBadge) {
        if (unreadReports > 0) {
            mailBadge.style.display = 'inline-block';
            mailBadge.innerText = unreadReports;
        } else {
            mailBadge.style.display = 'none'; // Or show dot for chats
            // If chat badge exists in DOM (it's inside Mailbox usually), we can check it
            const chatBadge = document.getElementById('chat-badge');
            if (chatBadge && chatBadge.style.display !== 'none') {
                mailBadge.style.display = 'inline-block';
                mailBadge.innerText = '!';
            }
        }
    }

    // Missions Badge
    const missionBadge = document.getElementById('menu-badge-missions');
    const unclaimed = (STATE.missions?.daily || []).filter(m => m.current >= m.target && !m.claimed).length +
        (STATE.missions?.weekly || []).filter(m => m.current >= m.target && !m.claimed).length;

    if (missionBadge) {
        if (unclaimed > 0) {
            missionBadge.style.display = 'inline-block';
            missionBadge.innerText = unclaimed;
        } else {
            missionBadge.style.display = 'none';
        }
    }
}

// Close menu when clicking outside
window.addEventListener('click', (e) => {
    const menu = document.getElementById('main-menu-dropdown');
    const btn = document.getElementById('btn-main-menu');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
    }
});

window.openGameGuide = function () {
    if (window.GAME_GUIDE_HTML) {
        openModal("מדריך למשחק", window.GAME_GUIDE_HTML, "סגור", closeModal);
    } else {
        notify("טוען מדריך...", "info");
    }
};

// --- INITIALIZATION ---

// --- GAME LOAD LOGIC ---
window.loadGame = async function () {
    console.log("📥 Loading game...");

    // 1. Try to load from Server first (Source of Truth)
    if (IS_ONLINE) {
        try {
            console.log("Fetching state from server...");
            const res = await fetch(`/api/user/${encodeURIComponent(CURRENT_USER)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.state) {
                    STATE = data.state;
                    console.log("✅ Game loaded from Server.");

                    initializeGameState();

                    // Update LocalStorage as backup
                    const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
                    users[CURRENT_USER] = {
                        password: '***', // don't store plain pass
                        state: STATE,
                        lastLogin: Date.now()
                    };
                    localStorage.setItem('vikings_users', JSON.stringify(users));
                    return; // Done
                }
            }
        } catch (err) {
            console.warn("⚠️ Failed to load from server (will try local):", err);
        }
    }

    // 2. Fallback to LocalStorage
    console.warn("⚠️ Loading from LocalStorage (Offline/Fallback)...");
    const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
    if (users[CURRENT_USER]) {
        STATE = users[CURRENT_USER].state;
        console.log("✅ Game loaded from LocalStorage.");
    } else {
        console.log("⚠️ No save found for this user.");
    }

    initializeGameState();

    // 3. Sync Up (Push to Server if Online and we loaded locally)
    // RISK: If server had newer data but fetch failed, we urge caution.
    // But usually fetch fails if offline.
    if (IS_ONLINE) {
        // If we loaded locally but are online, maybe we should NOT auto-save immediately to avoid overwrite?
        // But if fetch failed, we might be offline effectively.
        // We will do a save after a delay to ensure connection.
        console.log("Syncing local state to server...");
        saveGame();
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    console.log("Game Initializing...");

    // Check Connection First
    await API.checkConnection();

    // Init Clan System
    if (window.ClanSystem) {
        ClanSystem.init().then(() => {
            // Verify state after clans are loaded
            if (CURRENT_USER) ClanSystem.verifyPlayerClanState();
        });
    }

    // Check Login
    const savedUser = localStorage.getItem('vikings_user');
    if (savedUser) {
        CURRENT_USER = savedUser;

        // Ensure loadGame exists before calling (it might be missing in some versions)
        if (typeof loadGame === 'function') {
            await loadGame();
        } else {
            // Fallback if loadGame is missing: Load from localStorage manualy
            console.warn("loadGame function missing, loading manually from keys");
            const users = JSON.parse(localStorage.getItem('vikings_users') || '{}');
            if (users[CURRENT_USER]) {
                STATE = users[CURRENT_USER].state;
                initializeGameState();
            }
        }

        // Start Loops
        setInterval(gameLoop, 1000);
        setInterval(saveGame, 5000);

        // Initial View
        if (typeof renderResources === 'function') renderResources();
        switchView('city');

        notify(`Welcome back, ${CURRENT_USER}!`, 'success');

    } else {
        switchView('login');
    }
});


// ========================================
// PLAYERS LEADERBOARD SYSTEM
// ========================================

/**
 * Open Players Leaderboard View
 */
window.openPlayersLeaderboard = async function () {
    console.log('🏆 Opening players leaderboard...');

    // Switch to players view
    switchView('players');

    // Show load indicator
    const listEl = document.getElementById('players-list');
    if (listEl) {
        listEl.innerHTML = '<p style="text-align:center; color:#fbbf24;">טוען שחקנים... ⏳</p>';
    }

    // Fetch all players from server
    const players = await fetchAllPlayers();

    // Render the leaderboard
    renderPlayersLeaderboard(players);
};

/**
 * Fetch all players from server
 */
async function fetchAllPlayers() {
    try {
        const res = await fetch('/api/players');

        if (!res.ok) {
            throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }

        const data = await res.json();

        // Calculate score for each player
        const playersWithScores = data.players.map(player => ({
            ...player,
            score: calculatePlayerScore(player)
        }));

        // Sort by score descending
        playersWithScores.sort((a, b) => b.score - a.score);

        console.log('✅ Loaded ' + playersWithScores.length + ' players');
        return playersWithScores;

    } catch (err) {
        console.error('❌ Failed to fetch players:', err);
        notify('שגיאה בטעינת שחקנים', 'error');
        return [];
    }
}

/**
 * Calculate player score from their data
 */
function calculatePlayerScore(playerData) {
    let score = 0;

    // Buildings (100 points per level)
    if (playerData.buildings) {
        Object.values(playerData.buildings).forEach(b => {
            score += (b.level || 0) * 100;
        });
    }

    // Army (5 points per unit)
    if (playerData.army) {
        Object.values(playerData.army).forEach(count => {
            score += (count || 0) * 5;
        });
    }

    // Research (200 points per level)
    if (playerData.research) {
        Object.values(playerData.research).forEach(lvl => {
            score += (lvl || 0) * 200;
        });
    }

    // Wins/Losses
    if (playerData.stats) {
        score += (playerData.stats.wins || 0) * 50;
        score -= (playerData.stats.losses || 0) * 10;
    }

    // Territories (300 points each)
    if (playerData.mapEntities) {
        const ownedCount = Object.values(playerData.mapEntities).filter(e =>
            e.owner === playerData.username
        ).length;
        score += ownedCount * 300;
    }

    return Math.max(0, score); // Never negative
}

/**
 * Render players leaderboard UI
 */
function renderPlayersLeaderboard(players) {
    const listEl = document.getElementById('players-list');
    if (!listEl) {
        console.error('❌ players-list element not found!');
        return;
    }

    if (players.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color:#64748b;">אין שחקנים להצגה</p>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';

    players.forEach((player, index) => {
        const rank = index + 1;
        let medal;
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';
        else medal = '#' + rank;

        const isMe = player.username === CURRENT_USER;
        const bgStyle = isMe ?
            'background: rgba(251, 191, 36, 0.15); border: 2px solid #fbbf24;' :
            'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);';
        const bgHover = isMe ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255,255,255,0.1)';
        const bgNormal = isMe ? 'rgba(251, 191, 36, 0.15)' : 'rgba(0,0,0,0.3)';
        const youLabel = isMe ? ' (אתה)' : '';
        const wins = (player.stats && player.stats.wins) ? player.stats.wins : 0;
        const townLevel = (player.buildings && player.buildings.townHall && player.buildings.townHall.level) ? player.buildings.townHall.level : 1;
        const scoreFormatted = player.score.toLocaleString();

        html += '<div class="player-item" ' +
            'onclick="openPlayerProfile(\'' + player.username + '\')" ' +
            'style="' + bgStyle + ' padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;" ' +
            'onmouseover="this.style.background=\'' + bgHover + '\'" ' +
            'onmouseout="this.style.background=\'' + bgNormal + '\'">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
            '<span style="font-size:1.5rem; min-width:50px; text-align:center;">' + medal + '</span>' +
            '<div>' +
            '<div style="font-weight:bold; color:#fbbf24; font-size:1.1rem;">' + player.username + youLabel + '</div>' +
            '<div style="font-size:0.85rem; color:#94a3b8; margin-top:2px;">⚔️ ' + wins + ' נצחונות | 🏛️ רמה ' + townLevel + '</div>' +
            '</div>' +
            '</div>' +
            '<div style="text-align:left;">' +
            '<div style="font-size:1.3rem; font-weight:bold; color:#fff;">' + scoreFormatted + '</div>' +
            '<div style="font-size:0.75rem; color:#64748b;">נקודות</div>' +
            '</div>' +
            '</div>';
    });

    html += '</div>';
    listEl.innerHTML = html;

    console.log('✅ Rendered ' + players.length + ' players to leaderboard');
}

/**
 * Open a specific player's profile
 */
window.openPlayerProfile = async function (username) {
    console.log('👤 Opening profile for: ' + username);

    try {
        // Find player's city in current map entities
        let foundEntity = null;
        let foundX = null;
        let foundY = null;

        for (const [key, entity] of Object.entries(STATE.mapEntities || {})) {
            if (entity.type === 'city' && entity.user === username) {
                foundEntity = entity;
                const coords = key.split(',');
                foundX = Number(coords[0]);
                foundY = Number(coords[1]);
                break;
            }
        }

        if (foundEntity && foundX !== null && foundY !== null) {
            // Use existing interactEntity function
            console.log('✅ Found ' + username + ' city at (' + foundX + ', ' + foundY + ')');
            interactEntity(foundX, foundY, foundEntity);
            return;
        }

        // If not found in map, fetch from server
        console.log('⏳ Fetching ' + username + ' data from server...');
        const res = await fetch('/api/player/' + username);

        if (!res.ok) {
            throw new Error('Player not found: ' + username);
        }

        const playerData = await res.json();

        // Create temporary entity for profile display
        const tempEntity = {
            type: 'city',
            user: username,
            name: playerData.cityName || (username + "'s City"),
            level: playerData.buildings?.townHall?.level || 1,
            wins: playerData.stats?.wins || 0,
            losses: playerData.stats?.losses || 0,
            lastLogin: playerData.lastLogin || Date.now(),
            isMyCity: false
        };

        console.log('✅ Opening profile for ' + username);
        interactEntity(0, 0, tempEntity);

    } catch (err) {
        console.error('❌ Failed to open player profile:', err);
        notify('שגיאה בטעינת פרופיל', 'error');
    }
};

// --- VIEW CENTERING LOGIC ---
window.centerCityView = function () {
    const container = document.querySelector('.city-landscape');

    // Only center if we are in city view and elements exist
    if (container && container.offsetParent !== null) {
        const viewport = document.querySelector('.iso-viewport');
        if (!viewport) return;

        // 1. Get Dimensions
        const clientW = container.clientWidth;
        const clientH = container.clientHeight;

        // Visual dimensions (after scale(0.7))
        const viewRect = viewport.getBoundingClientRect();
        // Fallback if rect is 0 (hidden)
        const visualW = viewRect.width || (viewport.offsetWidth * 0.7);
        const visualH = viewRect.height || (viewport.offsetHeight * 0.7);

        // Reset margins first
        viewport.style.marginLeft = '';
        viewport.style.marginTop = '';

        // 2. Logic: If Viewport fits entirely, center via Margin. If not, Scroll.
        // Visual Target (Island Center) = 588px (X), 546px (Y) based on 0.7 scale
        const visualTargetX = 588;
        const visualTargetY = 546;

        // --- HORIZONTAL ---
        if (visualW < clientW) {
            // Fits horizontally -> Center via Margin
            // Formula: MarginLeft = ScreenCenter - VisualTargetX
            const margX = (clientW / 2) - visualTargetX;
            viewport.style.marginLeft = Math.floor(margX) + 'px';
            container.scrollLeft = 0;
        } else {
            // Mobile: Scroll to Target
            // Formula: ScrollLeft = VisualTargetX - ScreenCenter
            container.scrollLeft = Math.max(0, visualTargetX - (clientW / 2));
        }

        // --- VERTICAL ---
        if (visualH < clientH) {
            const margY = (clientH / 2) - visualTargetY;
            viewport.style.marginTop = Math.floor(margY) + 'px';
            container.scrollTop = 0;
        } else {
            container.scrollTop = Math.max(0, visualTargetY - (clientH / 2));
        }

        console.log("🎯 Centered City Hybrid", {
            mode: (visualW < clientW) ? 'Margin' : 'Scroll',
            clientW, visualW, visualTargetX
        });
    }
};

