// =====================================================
// SCROLLABLE MAP SYSTEM (TRUE GLOBAL GRID)
// =====================================================

const MAP_CONFIG = {
    WORLD_SIZE: 1000,           // 1000x1000 tiles
    TILE_SIZE: 30,              // 30px per tile
    BUFFER: 5,                  // Render a few extra tiles around edges
    SCROLL_DEBOUNCE: 10         // Faster debounce for smoother feel
};

let scrollTimer = null;

function initScrollableMap() {
    console.log("🗺️ Initializing True Scrollable Map...");

    const viewport = document.getElementById('world-map-viewport');
    const grid = document.getElementById('world-map-grid');

    if (!viewport || !grid) {
        console.error("❌ Map elements not found!");
        return;
    }

    // 1. Set the massive grid size
    const totalPixels = MAP_CONFIG.WORLD_SIZE * MAP_CONFIG.TILE_SIZE;
    grid.style.width = `${totalPixels}px`;
    grid.style.height = `${totalPixels}px`;
    grid.style.position = 'relative';
    grid.style.overflow = 'hidden';
    grid.classList.add('map-grid');

    // 2. Ensure Layers Exist
    if (!document.getElementById('map-tiles-layer')) {
        const tilesLayer = document.createElement('div');
        tilesLayer.id = 'map-tiles-layer';
        tilesLayer.style.position = 'absolute';
        tilesLayer.style.top = '0';
        tilesLayer.style.left = '0';
        tilesLayer.style.width = '100%';
        tilesLayer.style.height = '100%';
        tilesLayer.style.zIndex = '1';
        // HTML click-through behavior is default, but let's be explicit on children
        grid.prepend(tilesLayer);
    }

    // FORCE pointer-events: none on overlays to be 100% sure
    const lines = document.getElementById('march-lines-layer');
    const armies = document.getElementById('march-armies-layer');
    if (lines) lines.style.pointerEvents = 'none';
    if (armies) armies.style.pointerEvents = 'none';

    // 3. Center logic (Only if not already centered/scrolled)

    // 3. Center logic (Only if not already centered/scrolled)
    // If scroll is near 0,0 it implies it's fresh. 
    // If init is called while user is browsing, DO NOT RE-CENTER.
    if (viewport.scrollLeft < 100 && viewport.scrollTop < 100) {
        let homeX = 500;
        let homeY = 500;

        if (STATE.homeCoords && STATE.homeCoords.x > 0) {
            homeX = STATE.homeCoords.x;
            homeY = STATE.homeCoords.y;
        }

        const vpW = viewport.clientWidth || window.innerWidth;
        const vpH = viewport.clientHeight || window.innerHeight;

        viewport.scrollLeft = (homeX * MAP_CONFIG.TILE_SIZE) - (vpW / 2);
        viewport.scrollTop = (homeY * MAP_CONFIG.TILE_SIZE) - (vpH / 2);

        console.log(`📍 Centered on (${homeX}, ${homeY}).`);
    }

    // 4. Attach Scroll Listener
    viewport.onscroll = handleScroll;

    // 5. Global Interaction Listener (Delegation) to fix click issues
    // We attach to the GRID, so it moves with the scroll.
    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;

    grid.onmousedown = (e) => {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isDragging = false;
    };

    grid.onmousemove = (e) => {
        // Simple drag threshold
        if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
            isDragging = true;
        }
    };

    grid.onmouseup = (e) => {
        if (isDragging) return; // It was a drag, ignore

        // It was a click! Calculate Tile Coordinates.
        const rect = grid.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // x position within the element.
        const clickY = e.clientY - rect.top;  // y position within the element.

        const tileX = Math.floor(clickX / MAP_CONFIG.TILE_SIZE);
        const tileY = Math.floor(clickY / MAP_CONFIG.TILE_SIZE);

        console.log(`🖱️ Global Click: ${tileX}, ${tileY}`);

        // Handle the Logic
        handleGlobalClick(tileX, tileY);
    };

    // Mark as done
    viewport.setAttribute('data-init-done', 'true');

    // 6. Initial Render
    renderVisibleArea();
}

function handleGlobalClick(x, y) {
    // Check bounds
    if (x < 0 || y < 0 || x >= MAP_CONFIG.WORLD_SIZE || y >= MAP_CONFIG.WORLD_SIZE) return;

    const key = `${x},${y}`;
    const entity = STATE.mapEntities ? STATE.mapEntities[key] : null;

    if (entity) {
        // Interact with Entity
        if (typeof interactEntity === 'function') interactEntity(x, y, entity);
    } else {
        // Empty Tile -> Teleport
        handleTileClick(x, y);
    }
}

function handleScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(renderVisibleArea, MAP_CONFIG.SCROLL_DEBOUNCE);
}

// Expose for Main.js
window.renderScrollableMap = renderVisibleArea;

// Unified Jump Logic
window.jumpToScrollableCoords = function (x, y) {
    const viewport = document.getElementById('world-map-viewport');
    if (!viewport) return;

    // Centering calculation:
    // Target pixel - Half Viewport
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;

    viewport.scrollLeft = (x * MAP_CONFIG.TILE_SIZE) - (vpW / 2);
    viewport.scrollTop = (y * MAP_CONFIG.TILE_SIZE) - (vpH / 2);

    // Force immediate render
    renderVisibleArea();
}

function renderVisibleArea() {
    const viewport = document.getElementById('world-map-viewport');
    // Using layer instead of grid to avoid killing other layers
    const tilesLayer = document.getElementById('map-tiles-layer');

    if (!viewport || !tilesLayer) return;

    // 1. Calculate Visible Coordinates
    const scrollLeft = viewport.scrollLeft;
    const scrollTop = viewport.scrollTop;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    // Start Tile X/Y
    let startX = Math.floor(scrollLeft / MAP_CONFIG.TILE_SIZE) - MAP_CONFIG.BUFFER;
    let startY = Math.floor(scrollTop / MAP_CONFIG.TILE_SIZE) - MAP_CONFIG.BUFFER;

    // End Tile X/Y
    let endX = Math.floor((scrollLeft + width) / MAP_CONFIG.TILE_SIZE) + MAP_CONFIG.BUFFER;
    let endY = Math.floor((scrollTop + height) / MAP_CONFIG.TILE_SIZE) + MAP_CONFIG.BUFFER;

    // Clamp
    startX = Math.max(0, startX);
    startY = Math.max(0, startY);
    endX = Math.min(MAP_CONFIG.WORLD_SIZE - 1, endX);
    endY = Math.min(MAP_CONFIG.WORLD_SIZE - 1, endY);

    // Update STATE
    if (!STATE.viewport) STATE.viewport = {};
    const centerX = Math.floor((startX + endX) / 2);
    const centerY = Math.floor((startY + endY) / 2);
    STATE.viewport.x = centerX;
    STATE.viewport.y = centerY;

    // Update HUD coordinates
    const hudX = document.getElementById('map-x');
    const hudY = document.getElementById('map-y');
    if (hudX) hudX.innerText = centerX;
    if (hudY) hudY.innerText = centerY;

    // 2. Render Tiles (Efficiently)
    // We create a new fragment and SWAP the entire tile layer content.
    // This is faster than 1000 appendChild calls on live DOM, but still replaces everything.
    // For specific tile updates (mobs moving) we might need smarter logic, 
    // but for scrolling this solves the "flicker of other layers".

    const fragment = document.createDocumentFragment();
    let entityCount = 0;

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {

            // Generate Terrain
            const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const val = noise - Math.floor(noise);

            let type = 'water';
            let bgColor = 'transparent';
            let hasEntity = false;

            if (val < 0.15) { type = 'grass'; bgColor = '#4ade80'; }
            else if (val < 0.22) { type = 'forest'; bgColor = '#166534'; }
            else if (val < 0.27) { type = 'mountain'; bgColor = '#94a3b8'; }
            else if (val < 0.30) { type = 'desert'; bgColor = '#fde047'; }

            // Check for Entity
            const key = `${x},${y}`;
            let entity = STATE.mapEntities ? STATE.mapEntities[key] : null;

            if (!entity && typeof window.generateVirtualEntity === 'function') {
                entity = window.generateVirtualEntity(x, y, type);
                if (entity && entity.type === 'city' && entity.user === 'NPC') entity = null;
            }

            // Create Tile DOM for visual only
            const tile = document.createElement('div');
            tile.className = `map-tile tile-${type}`;

            // INLINE STYLES - Absolute positioning relative to grid
            tile.style.position = 'absolute';
            tile.style.left = `${x * MAP_CONFIG.TILE_SIZE}px`;
            tile.style.top = `${y * MAP_CONFIG.TILE_SIZE}px`;
            tile.style.width = `${MAP_CONFIG.TILE_SIZE}px`;
            tile.style.height = `${MAP_CONFIG.TILE_SIZE}px`;
            tile.style.zIndex = '10';

            // Background
            if (type !== 'water') {
                tile.style.backgroundColor = bgColor;
                tile.style.opacity = '0.7';
                tile.style.border = '1px solid rgba(255,255,255,0.2)';
            }

            if (entity) {
                entityCount++;
                const el = createEntityDOM(entity, x, y);

                // FORTRESS SPECIAL: Keep click handler and make tile bigger
                if (entity.type === 'fortress') {
                    // Fortress needs to be clickable and larger
                    el.style.pointerEvents = 'auto';
                    tile.style.width = '60px';
                    tile.style.height = '60px';
                    tile.style.zIndex = '20';
                    // CRITICAL: Tile must be non-clickable so grid handler doesn't fire
                    tile.style.pointerEvents = 'none';
                } else {
                    // Regular entities: remove click handler
                    el.onclick = null;
                    el.style.pointerEvents = 'none';
                }

                tile.appendChild(el);
            } else {
                // Empty tile - Visual cue on hover (via CSS)
                // NO individual listeners!
            }

            // Pointer events none for tiles so click penetrates to grid?
            // NO! If tiles have pointer-events:none, e.target is grid.
            // If tiles have auto, e.target is tile.
            // We want e.target to bubble up to grid. grid.onmouseup handles it.
            // But we need coordinate calculation.
            // If we click on tile, e.clientX is global. rect is global.
            // Math works regardless of potential target!

            // Just to be safe and clean:
            // tile.style.pointerEvents = 'none'; // Make visual tiles essentially ghosts
            // BUT we want hover effects?
            // CSS :hover requires pointer-events: auto.
            // Let's keep auto. The MouseUp event will bubble from Tile -> Grid.
            tile.style.pointerEvents = 'auto';

            fragment.appendChild(tile);
        }
    }

    // SWAP CONTENT
    tilesLayer.innerHTML = '';
    tilesLayer.appendChild(fragment);

    // FORTRESS FORCE RENDER: Always render ALL fortresses from ALL_CLANS
    // This ensures fortresses are displayed even if there are viewport or entity state issues
    if (window.ALL_CLANS) {
        console.log('[FORTRESS_RENDER] Force-rendering fortresses from ALL_CLANS...');
        Object.values(window.ALL_CLANS).forEach(clan => {
            if (clan.fortress && clan.fortress.x != null && clan.fortress.y != null) {
                const fx = Number(clan.fortress.x);
                const fy = Number(clan.fortress.y);

                // Check if fortress is in current viewport
                if (fx >= startX && fx <= endX && fy >= startY && fy <= endY) {
                    const fortressEntity = {
                        type: 'fortress',
                        x: fx,
                        y: fy,
                        clanId: clan.id,
                        clanTag: clan.tag,
                        name: `מבצר [${clan.tag}]`,
                        level: clan.fortress.level || 1,
                        hp: clan.fortress.hp || 5000,
                        maxHp: clan.fortress.maxHp || 5000,
                        owner: 'Clan'
                    };

                    console.log(`[FORTRESS_RENDER] Rendering fortress for ${clan.tag} at ${fx},${fy}`);

                    // Create tile for fortress
                    const tile = document.createElement('div');
                    tile.className = 'map-tile';
                    tile.style.position = 'absolute';
                    tile.style.left = `${fx * MAP_CONFIG.TILE_SIZE}px`;
                    tile.style.top = `${fy * MAP_CONFIG.TILE_SIZE}px`;
                    tile.style.width = `${MAP_CONFIG.TILE_SIZE}px`;
                    tile.style.height = `${MAP_CONFIG.TILE_SIZE}px`;
                    tile.style.zIndex = '20'; // Higher z-index to appear above other tiles

                    // Create fortress DOM
                    const fortressDOM = createEntityDOM(fortressEntity, fx, fy);
                    fortressDOM.onclick = null;
                    fortressDOM.style.pointerEvents = 'none';
                    tile.appendChild(fortressDOM);

                    tile.style.pointerEvents = 'auto';
                    tilesLayer.appendChild(tile);
                }
            }
        });
    }

    // AGGRESSIVE DEBUG OUTPUT
    const debugOutput = document.getElementById('debug-content');
    if (debugOutput) {
        debugOutput.innerHTML = `
        <strong>Center:</strong> ${STATE.viewport.x}, ${STATE.viewport.y}<br>
        <strong>Entities:</strong> ${entityCount}<br>
        `;
    }
}

function createEntityDOM(entity, x, y) {
    const div = document.createElement('div');
    div.classList.add('map-entity', `entity-${entity.type}`);

    // FORTRESS RENDERING (60x60px, 2x2 tiles)
    if (entity.type === 'fortress') {
        div.classList.add('fortress-entity');
        div.style.width = '60px';
        div.style.height = '60px';
        div.style.zIndex = '20';

        const isMyClan = STATE.clan && (STATE.clan.id === entity.clanId || STATE.clan.tag === entity.clanTag);
        if (isMyClan) div.classList.add('entity-my-fortress');

        div.innerHTML = `
            <div class="fortress-icon">🏯</div>
            <div class="entity-label">
                <div class="name">${entity.name || `מבצר [${entity.clanTag}]`}</div>
            </div>
        `;

        div.onclick = (e) => {
            e.stopPropagation();
            if (typeof interactEntity === 'function') interactEntity(x, y, entity);
        };

        return div;
    }

    // REGULAR ENTITY RENDERING
    if (entity.isMyCity) div.classList.add('entity-my-city');
    else if (entity.owner === CURRENT_USER) div.classList.add('entity-owned');

    let icon = '❓';
    if (typeof getTypeIcon === 'function') icon = getTypeIcon(entity.type || entity.resource);
    else icon = getDefaultIcon(entity.type);

    let displayName = entity.name || entity.type;

    div.innerHTML = `
        <div class="entity-icon">${icon}</div>
        <div class="entity-label">
            ${displayName}
            ${(entity.owner && entity.owner !== CURRENT_USER) ? `<div style='font-size:0.6rem;color:#4ade80'>${entity.owner}</div>` : ''}
        </div>
    `;

    div.onclick = (e) => {
        e.stopPropagation();
        if (typeof interactEntity === 'function') interactEntity(x, y, entity);
    };

    return div;
}

function getDefaultIcon(type) {
    const map = { city: '🏛️', wood: '🌲', food: '🌾', mine: '⛏️', marble: '🏛', crystal: '💎', sulfur: '🌋', fortress: '🏰' };
    return map[type] || '📍';
}

// Ensure global access
window.initScrollableMap = initScrollableMap;
window.renderVisibleArea = renderVisibleArea;

// Auto-init logic - REDUCED AGGRESSION
function tryAutoInit() {
    const worldView = document.getElementById('world-view');
    if (worldView && worldView.style.display !== 'none') {
        const viewport = document.getElementById('world-map-viewport');
        if (viewport && !viewport.getAttribute('data-init-done')) {
            initScrollableMap();
        }
    }
}

// Check every 1000ms instead of 500
setInterval(tryAutoInit, 1000);

// Hook into switchView globally
const _origSwitch = window.switchView;
window.switchView = function (viewName) {
    if (_origSwitch) _origSwitch(viewName);
    if (viewName === 'world') {
        setTimeout(() => {
            initScrollableMap();
            renderVisibleArea();
        }, 100);
    }
}

// Quick Jump Helper
window.jumpToMapCoords = function (x, y) {
    const viewport = document.getElementById('world-map-viewport');
    if (!viewport) return;

    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;

    viewport.scrollLeft = (x * MAP_CONFIG.TILE_SIZE) - (vpW / 2);
    viewport.scrollTop = (y * MAP_CONFIG.TILE_SIZE) - (vpH / 2);

    // Render immediately
    setTimeout(renderVisibleArea, 0);
};

// ==========================================
// TELEPORTATION LOGIC
// ==========================================

window.handleTileClick = function (x, y) {
    // Double check if empty (though logic above handles it)
    const key = `${x},${y}`;
    if (STATE.mapEntities && STATE.mapEntities[key]) return;

    // Server check logic: ['gold', 'wood', 'food', 'wine', 'iron']
    // User check:
    const COST = 50000;
    const resources = ['gold', 'wood', 'food', 'wine', 'marble'];
    const missing = resources.filter(r => (STATE.resources[r] || 0) < COST);

    let costHtml = `
        <div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:8px; margin:15px 0; text-align:right;">
            <div style="margin-bottom:5px; font-weight:bold; color:#fbbf24;">עלות המעבר:</div>
            ${resources.map(r => `<div style="${(STATE.resources[r] || 0) < COST ? 'color:#ef4444' : 'color:#a7f3d0'}">${getIcon(r) || ''} 50,000 ${r}</div>`).join('')}
        </div>
        <div style="color:#fca5a5; font-size:0.9em; margin-bottom:15px;">
            ⚠️ שים לב: ניתן להעביר עיר רק פעם ב-7 ימים.<br>
            העיר תועבר למיקום (${x}, ${y}).
        </div>
    `;

    if (missing.length > 0) {
        costHtml += `<div style="color:#ef4444; font-weight:bold;">חסרים משאבים!</div>`;
    }

    openModal('העברת עיר', `
        <div style="text-align:center;">
            <div style="font-size:3rem; margin-bottom:10px;">🚚</div>
            <p>האם ברצונך להעביר את העיר שלך למיקום הזה?</p>
            ${costHtml}
            <button class="btn-primary" onclick="teleportCity(${x}, ${y})" ${missing.length > 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>אשר העברה</button>
        </div>
    `, 'ביטול', closeModal);
};

window.teleportCity = async function (x, y) {
    closeModal();
    notify('מנסה להעביר את העיר...', 'info');

    // OPTIMISTIC UPDATE: Update local state immediately for UX and Safety
    const oldX = STATE.homeCoords.x;
    const oldY = STATE.homeCoords.y;
    STATE.homeCoords = { x, y };

    // Update Map Entities Optimistically
    if (STATE.mapEntities) {
        // Remove old
        delete STATE.mapEntities[`${oldX},${oldY}`];
        // Add new (Visual only until next sync)
        STATE.mapEntities[`${x},${y}`] = {
            type: 'city',
            user: CURRENT_USER,
            isMyCity: true,
            name: (STATE.city && STATE.city.name) ? STATE.city.name : 'My City',
            level: (STATE.buildings && STATE.buildings.townHall) ? STATE.buildings.townHall.level : 1,
            owner: CURRENT_USER
        };
    }

    // Reload map center immediately
    if (window.initScrollableMap) window.initScrollableMap();

    try {
        const response = await fetch('/api/player/teleport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: CURRENT_USER, targetX: x, targetY: y })
        });
        const result = await response.json();

        if (result.success) {
            closeModal();
            // Deduct resources locally to match server
            const COST = 50000;
            ['gold', 'wood', 'food', 'wine', 'marble'].forEach(r => {
                if (STATE.resources[r]) STATE.resources[r] -= COST;
            });
            updateUI();
            notify('העיר הועברה בהצלחה! 🌍', 'success_major');

            // Force save to persist the new coordinates immediately (overwriting any stale auto-save)
            if (window.saveGame) window.saveGame();

        } else {
            // REVERT OPTIMISTIC UPDATE
            console.error("Teleport failed, reverting state.");
            STATE.homeCoords = { x: oldX, y: oldY };
            // Revert map entities
            if (STATE.mapEntities) {
                delete STATE.mapEntities[`${x},${y}`];
                STATE.mapEntities[`${oldX},${oldY}`] = {
                    type: 'city',
                    user: CURRENT_USER,
                    isMyCity: true,
                    name: STATE.city ? STATE.city.name : 'My City',
                    level: (STATE.buildings && STATE.buildings.townHall) ? STATE.buildings.townHall.level : 1,
                    owner: CURRENT_USER
                };
            }
            if (window.initScrollableMap) window.initScrollableMap();

            notify(result.error || 'שגיאה בהעברת העיר', 'error');
        }
    } catch (err) {
        // REVERT OPTIMISTIC UPDATE
        console.error("Teleport error, reverting state:", err);
        STATE.homeCoords = { x: oldX, y: oldY };
        // Revert map entities
        if (STATE.mapEntities) {
            delete STATE.mapEntities[`${x},${y}`];
            STATE.mapEntities[`${oldX},${oldY}`] = {
                type: 'city',
                user: CURRENT_USER,
                isMyCity: true,
                name: STATE.city ? STATE.city.name : 'My City',
                level: (STATE.buildings && STATE.buildings.townHall) ? STATE.buildings.townHall.level : 1,
                owner: CURRENT_USER
            };
        }
        if (window.initScrollableMap) window.initScrollableMap();

        notify('שגיאת תקשורת', 'error');
    }
};
