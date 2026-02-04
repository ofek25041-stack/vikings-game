// ======================================
// MAP NAVIGATION CONTROLS
// Simple arrow buttons to navigate the map
// ======================================

function addMapNavigationControls() {
    // Create navigation container
    const navDiv = document.createElement('div');
    navDiv.id = 'map-nav-arrows';
    navDiv.style.cssText = `
        position: absolute;
        bottom: 80px;
        right: 20px;
        display: grid;
        grid-template-columns: repeat(3, 50px);
        grid-template-rows: repeat(3, 50px);
        gap: 5px;
        z-index: 500;
    `;

    // Navigation buttons
    const buttons = [
        { dir: 'NW', x: -50, y: -50, pos: 0, icon: '↖' },
        { dir: 'N', x: 0, y: -50, pos: 1, icon: '⬆' },
        { dir: 'NE', x: 50, y: -50, pos: 2, icon: '↗' },
        { dir: 'W', x: -50, y: 0, pos: 3, icon: '⬅' },
        { dir: 'Home', x: 0, y: 0, pos: 4, icon: '🏠', special: true },
        { dir: 'E', x: 50, y: 0, pos: 5, icon: '➡' },
        { dir: 'SW', x: -50, y: 50, pos: 6, icon: '↙' },
        { dir: 'S', x: 0, y: 50, pos: 7, icon: '⬇' },
        { dir: 'SE', x: 50, y: 50, pos: 8, icon: '↘' }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.icon;
        button.title = btn.special ? 'Go Home' : `Move ${btn.dir}`;
        button.style.cssText = `
            width: 50px;
            height: 50px;
            background: ${btn.special ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(15, 23, 42, 0.8)'};
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: white;
            font-size: ${btn.special ? '24px' : '20px'};
            cursor: pointer;
            backdrop-filter: blur(10px);
            transition: all 0.2s;
            grid-column: ${(btn.pos % 3) + 1};
            grid-row: ${Math.floor(btn.pos / 3) + 1};
        `;

        button.onmouseenter = () => {
            button.style.transform = 'scale(1.1)';
            button.style.background = btn.special ?
                'linear-gradient(135deg, #fbbf24, #f59e0b)' :
                'rgba(59, 130, 246, 0.8)';
        };

        button.onmouseleave = () => {
            button.style.transform = 'scale(1)';
            button.style.background = btn.special ?
                'linear-gradient(135deg, #f59e0b, #d97706)' :
                'rgba(15, 23, 42, 0.8)';
        };

        button.onclick = () => {
            const viewport = document.getElementById('world-map-viewport');

            if (btn.special) {
                // Go to home
                const hx = STATE.homeCoords?.x || 500;
                const hy = STATE.homeCoords?.y || 500;
                if (window.jumpToMapCoords) window.jumpToMapCoords(hx, hy);
            } else {
                // Scroll in direction (Relative scroll)
                if (viewport) {
                    const scrollAmount = 300; // 10 tiles approx
                    viewport.scrollBy({
                        left: btn.x * (scrollAmount / 50), // Scale 50 to 300
                        top: btn.y * (scrollAmount / 50),
                        behavior: 'smooth'
                    });
                }
            }
        };

        navDiv.appendChild(button);
    });

    // Add to map viewport
    const viewport = document.getElementById('world-map-viewport');
    if (viewport) {
        // Remove old nav if exists
        const oldNav = document.getElementById('map-nav-arrows');
        if (oldNav) oldNav.remove();

        viewport.appendChild(navDiv);
        console.log('✅ Map navigation controls added');
    }
}

// Add AI Players quick jump list
function addAIPlayersQuickJump() {
    const aiPlayers = [
        { name: 'נמרוד_הכובש', x: 894, y: 232 },
        { name: 'הראלד_הכחול', x: 655, y: 447 },
        { name: 'אולף_המלומד', x: 599, y: 869 },
        { name: 'ביורן_הברזל', x: 517, y: 479 },
        { name: 'סיגורד_הנחש', x: 155, y: 361 }
    ];

    const listDiv = document.createElement('div');
    listDiv.id = 'ai-players-jump-list';
    listDiv.style.cssText = `
        position: absolute;
        top: 60px;
        right: 20px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        padding: 10px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 500;
        max-width: 200px;
    `;

    const title = document.createElement('div');
    title.textContent = '🎯 שחקני AI';
    title.style.cssText = `
        color: #fbbf24;
        font-weight: 600;
        margin-bottom: 8px;
        text-align: center;
    `;
    listDiv.appendChild(title);

    aiPlayers.forEach(player => {
        const btn = document.createElement('button');
        btn.textContent = player.name;
        btn.title = `קפוץ ל-${player.name} (${player.x}, ${player.y})`;
        btn.style.cssText = `
            display: block;
            width: 100%;
            padding: 6px 8px;
            margin-bottom: 4px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: right;
        `;

        btn.onmouseenter = () => {
            btn.style.background = 'rgba(59, 130, 246, 0.3)';
            btn.style.transform = 'translateX(-2px)';
        };

        btn.onmouseleave = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.05)';
            btn.style.transform = 'translateX(0)';
        };

        btn.onclick = () => {
            if (window.jumpToMapCoords) {
                window.jumpToMapCoords(player.x, player.y);
                notify(`קפיצה אל ${player.name}`, 'info');
            }
        };

        listDiv.appendChild(btn);
    });

    const viewport = document.getElementById('world-map-viewport');
    if (viewport) {
        const oldList = document.getElementById('ai-players-jump-list');
        if (oldList) oldList.remove();

        viewport.appendChild(listDiv);
        console.log('✅ AI Players quick jump added');
    }
}

// Initialize when map is shown
function initMapNavigation() {
    // addMapNavigationControls(); // DISABLED per user request
    // addAIPlayersQuickJump();    // DISABLED per user request
}

// Auto-init when switching to world view
const originalSwitchView = window.switchView;
if (originalSwitchView) {
    window.switchView = function (view) {
        originalSwitchView(view);
        if (view === 'world') {
            setTimeout(initMapNavigation, 100);
        }
    };
}

// Export
window.initMapNavigation = initMapNavigation;
