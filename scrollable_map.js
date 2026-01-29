// =====================================================
// SCROLLABLE MAP SYSTEM (TRUE GLOBAL GRID)
// =====================================================

const MAP_CONFIG = {
    WORLD_SIZE: 1000,           // 1000x1000 tiles
    TILE_SIZE: 30,              // 30px per tile
    BUFFER: 5,                  // Render a few extra tiles around edges
    SCROLL_DEBOUNCE: 50         // ms delay for rendering while scrolling
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
    grid.style.overflow = 'hidden'; // Content outside is invalid logic-wise anyway

    // 2. Ensure background pattern covers it all
    grid.classList.add('map-grid');

    // 3. Center logic
    let homeX = 500;
    let homeY = 500;

    // Try to get from STATE if available
    if (STATE.homeCoords && STATE.homeCoords.x > 0) {
        homeX = STATE.homeCoords.x;
        homeY = STATE.homeCoords.y;
    }

    // Calculate scroll position to center coordinates
    const vpW = viewport.clientWidth || window.innerWidth;
    const vpH = viewport.clientHeight || window.innerHeight;

    viewport.scrollLeft = (homeX * MAP_CONFIG.TILE_SIZE) - (vpW / 2);
    viewport.scrollTop = (homeY * MAP_CONFIG.TILE_SIZE) - (vpH / 2);

    console.log(`📍 Centered on (${homeX}, ${homeY}). Scroll: ${viewport.scrollLeft}, ${viewport.scrollTop}`);

    // 4. Attach Scroll Listener
    viewport.onscroll = handleScroll;

    // 5. Initial Render
    renderVisibleArea();
}

function handleScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(renderVisibleArea, MAP_CONFIG.SCROLL_DEBOUNCE);
}

function renderVisibleArea() {
    const viewport = document.getElementById('world-map-viewport');
    const grid = document.getElementById('world-map-grid');
    if (!viewport || !grid) return;

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

    // 2. Clear Grid (Preserve Marches)
    const linesLayer = document.getElementById('march-lines-layer');
    const armiesLayer = document.getElementById('march-armies-layer');
    if (linesLayer) linesLayer.remove();
    if (armiesLayer) armiesLayer.remove();

    grid.innerHTML = '';

    if (linesLayer) grid.appendChild(linesLayer);
    if (armiesLayer) grid.appendChild(armiesLayer);

    // 3. Render Tiles
    const fragment = document.createDocumentFragment();
    let entityCount = 0;

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {

            // Generate Terrain
            const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const val = noise - Math.floor(noise);

            let type = 'water';
            let bgColor = 'transparent'; // Only water is transparent

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

            // Create Tile DOM
            const tile = document.createElement('div');
            tile.className = `map-tile tile-${type}`;

            // INLINE STYLES TO FORCE VISIBILITY
            tile.style.position = 'absolute';
            tile.style.left = `${x * MAP_CONFIG.TILE_SIZE}px`;
            tile.style.top = `${y * MAP_CONFIG.TILE_SIZE}px`;
            tile.style.width = `${MAP_CONFIG.TILE_SIZE}px`;
            tile.style.height = `${MAP_CONFIG.TILE_SIZE}px`;
            tile.style.zIndex = '10';

            // Force background if not water
            if (type !== 'water') {
                tile.style.backgroundColor = bgColor;
                tile.style.opacity = '0.7';
                tile.style.border = '1px solid rgba(255,255,255,0.2)';
            }

            if (entity) {
                entityCount++;
                const el = createEntityDOM(entity, x, y);
                tile.appendChild(el);
            }

            fragment.appendChild(tile);
        }
    }

    grid.appendChild(fragment);

    // AGGRESSIVE DEBUG OUTPUT
    const debugOutput = document.getElementById('debug-content');
    if (debugOutput) {
        const vp = document.getElementById('world-map-viewport');
        const gr = document.getElementById('world-map-grid');
        const tile = gr.querySelector('.map-tile');

        // Check computed styles
        const vpStyle = window.getComputedStyle(vp);
        const grStyle = window.getComputedStyle(gr);

        debugOutput.innerHTML = `
        <strong>Viewport:</strong> ${vp.clientWidth}x${vp.clientHeight} (Scroll: ${vp.scrollLeft}, ${vp.scrollTop})<br>
        <strong>Grid:</strong> ${gr.clientWidth}x${gr.clientHeight} (Children: ${gr.children.length})<br>
        <strong>Center Tile:</strong> ${STATE.viewport.x}, ${STATE.viewport.y}<br>
        <strong>Entities Rendered:</strong> ${entityCount}<br>
        <hr>
        <strong>CSS Check:</strong><br>
        VP Display: ${vpStyle.display}, Z-Index: ${vpStyle.zIndex}<br>
        Grid Display: ${grStyle.display}, Position: ${grStyle.position}<br>
        First Tile Visible? ${tile ? 'YES' : 'NO'}<br>
        First Tile Pos: ${tile ? tile.style.left + ',' + tile.style.top : 'N/A'}
        `;
    }
}

function createEntityDOM(entity, x, y) {
    const div = document.createElement('div');
    div.classList.add('map-entity', `entity-${entity.type}`);

    if (entity.isMyCity) div.classList.add('entity-my-city');
    else if (entity.owner === CURRENT_USER) div.classList.add('entity-owned');

    // Icon
    let icon = '❓';
    if (typeof getTypeIcon === 'function') icon = getTypeIcon(entity.type || entity.resource);
    else icon = getDefaultIcon(entity.type);

    div.innerHTML = `
        <div class="entity-icon">${icon}</div>
        <div class="entity-label">
            ${entity.clanTag ? `<span style='color:#fbbf24'>[${entity.clanTag}]</span> ` : ''}
            ${entity.name || entity.type}
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

// Auto-init logic
function tryAutoInit() {
    // Only init if we are on the map view
    const worldView = document.getElementById('world-view');
    if (worldView && worldView.style.display !== 'none') {
        const viewport = document.getElementById('world-map-viewport');
        if (viewport && !viewport.getAttribute('data-init-done')) {
            console.log("🔄 Auto-triggering map init...");
            initScrollableMap();
            viewport.setAttribute('data-init-done', 'true');
        }
    }
}

// Check every 500ms if we should init (safeguard)
setInterval(tryAutoInit, 500);

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
