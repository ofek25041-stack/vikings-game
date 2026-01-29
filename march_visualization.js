/**
 * March Visualization System
 * Shows animated lines and moving army icons for active attacks/conquest missions
 */

// Configuration constants - get from window (set by main.js) or use defaults
var MV_VIEW_COLS = 100;
var MV_VIEW_ROWS = 100;
var MV_TILE_SIZE = 30;

const MarchVisualization = {
    // Configuration
    ARMY_ICON: '⚔️',
    RETURN_ICON: '🏃',
    LINE_COLOR: '#ef4444',
    LINE_WIDTH: 3,

    // State
    initialized: false,
    animationFrameId: null,

    /**
     * Initialize the visualization layer
     */
    init: function () {
        if (this.initialized) return;

        console.log('🗡️ MarchVisualization initializing...');

        // Start animation loop
        this.startAnimation();
        this.initialized = true;

        console.log('✅ MarchVisualization ready');
    },

    /**
     * Start the animation loop
     */
    startAnimation: function () {
        const self = this;

        function loop() {
            self.render();
            self.animationFrameId = requestAnimationFrame(loop);
        }

        loop();
    },

    /**
     * Stop the animation loop
     */
    stopAnimation: function () {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    },

    /**
     * Convert map coordinates to screen pixels
     * Now uses ABSOLUTE coordinates on the 30,000px grid
     */
    coordsToPixels: function (x, y) {
        // Calculate Viewport Start (Same logic as main.js)
        var centerX = (STATE.viewport && STATE.viewport.x) ? STATE.viewport.x : (STATE.homeCoords ? STATE.homeCoords.x : 500);
        var centerY = (STATE.viewport && STATE.viewport.y) ? STATE.viewport.y : (STATE.homeCoords ? STATE.homeCoords.y : 500);

        // Viewport size defaults (should match main.js)
        var vCols = window.VIEW_COLS || 100;
        var vRows = window.VIEW_ROWS || 100;

        var startX = centerX - Math.floor(vCols / 2);
        var startY = centerY - Math.floor(vRows / 2);

        // Convert absolute world coord to relative viewport pixel
        var relX = x - startX;
        var relY = y - startY;

        var pixelX = relX * MV_TILE_SIZE + MV_TILE_SIZE / 2;
        var pixelY = relY * MV_TILE_SIZE + MV_TILE_SIZE / 2;

        return { x: pixelX, y: pixelY };
    },

    /**
     * Check if coordinates are visible within the grid
     * With the large map, everything is "visible" on the DOM layer
     */
    isVisible: function (screenX, screenY) {
        return true;
    },

    /**
     * Render all active marches
     */
    render: function () {
        var linesLayer = document.getElementById('march-lines-layer');
        var armiesLayer = document.getElementById('march-armies-layer');

        if (!linesLayer || !armiesLayer) return;

        // Ensure layers match the viewport size (100 * 30 = 3000)
        if (!linesLayer.getAttribute('data-resized')) {
            linesLayer.setAttribute('width', '3000');
            linesLayer.setAttribute('height', '3000');
            linesLayer.style.width = '3000px';
            linesLayer.style.height = '3000px';
            linesLayer.style.position = 'absolute';
            linesLayer.style.top = '0';
            linesLayer.style.left = '0';
            linesLayer.style.pointerEvents = 'none';
            linesLayer.setAttribute('data-resized', 'true');
        }

        // Clear previous frame contents (but not the element itself)
        linesLayer.innerHTML = '';
        armiesLayer.innerHTML = '';

        var now = Date.now();

        // Get all active missions with origin and target
        var missions = [];
        if (STATE && STATE.timers) {
            for (var i = 0; i < STATE.timers.length; i++) {
                var t = STATE.timers[i];
                if (t.type === 'mission' && t.originKey && t.targetKey && t.endTime > now) {
                    missions.push(t);
                }
            }
        }



        // Render each mission
        for (var m = 0; m < missions.length; m++) {
            this.renderMission(missions[m], linesLayer, armiesLayer, now);
        }
    },

    /**
     * Render a single mission
     */
    renderMission: function (mission, linesLayer, armiesLayer, now) {
        // Parse coordinates
        var originParts = mission.originKey.split(',');
        var targetParts = mission.targetKey.split(',');

        var originX = parseInt(originParts[0]);
        var originY = parseInt(originParts[1]);
        var targetX = parseInt(targetParts[0]);
        var targetY = parseInt(targetParts[1]);

        // Convert to screen pixels
        var origin = this.coordsToPixels(originX, originY);
        var target = this.coordsToPixels(targetX, targetY);

        // Skip if both points are off-screen
        if (!this.isVisible(origin.x, origin.y) && !this.isVisible(target.x, target.y)) {
            return;
        }

        // Calculate progress (0 = start, 1 = finished)
        var startTime = mission.startTime || (mission.endTime - 60000); // Default 60s if no startTime
        var totalTime = mission.endTime - startTime;
        var elapsed = now - startTime;
        var progress = Math.min(1, Math.max(0, elapsed / totalTime));

        // Calculate actual position along the path
        var actualProgress = progress;
        var isReturning = false;
        var icon = this.ARMY_ICON;

        if (mission.subtype === 'attack' || mission.subtype === 'fortress_attack') {
            // Round trip: go (0-0.4), fight (0.4-0.5), return (0.5-1)
            var goPhase = 0.4;
            var fightPhase = 0.5;

            if (progress < goPhase) {
                // Going to target
                actualProgress = progress / goPhase;
            } else if (progress < fightPhase) {
                // Fighting at target
                actualProgress = 1;
                icon = '💥';
            } else {
                // Returning home
                actualProgress = 1 - ((progress - fightPhase) / (1 - fightPhase));
                isReturning = true;
                icon = this.RETURN_ICON;
            }
        }

        // Draw the line
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', origin.x);
        line.setAttribute('y1', origin.y);
        line.setAttribute('x2', target.x);
        line.setAttribute('y2', target.y);
        line.setAttribute('class', 'march-line');

        // Color based on mission type
        if (mission.subtype === 'conquest') {
            line.style.stroke = '#22c55e'; // Green for conquest
        } else if (mission.subtype === 'fortress_attack' && !isReturning) {
            line.style.stroke = '#8b5cf6'; // Purple for fortress attack
        } else if (isReturning) {
            line.style.stroke = '#3b82f6'; // Blue for returning
        } else {
            line.style.stroke = '#ef4444'; // Red for attack
        }

        linesLayer.appendChild(line);

        // Calculate army position along the line
        var armyX = origin.x + (target.x - origin.x) * actualProgress;
        var armyY = origin.y + (target.y - origin.y) * actualProgress;

        // Create army icon
        var army = document.createElement('div');
        army.className = 'march-army';
        army.style.left = armyX + 'px';
        army.style.top = armyY + 'px';
        army.textContent = icon;

        // Add tooltip with mission info
        var timeLeft = Math.max(0, Math.ceil((mission.endTime - now) / 1000));
        army.title = mission.desc + ' - ' + timeLeft + 's';

        armiesLayer.appendChild(army);

        // Add origin and target markers
        this.renderMarker(origin.x, origin.y, '🏠', armiesLayer, 'origin-marker');
        this.renderMarker(target.x, target.y, '🎯', armiesLayer, 'target-marker');
    },

    /**
     * Render a small marker
     */
    renderMarker: function (x, y, icon, layer, className) {
        var marker = document.createElement('div');
        marker.className = 'march-marker ' + className;
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.textContent = icon;
        marker.style.fontSize = '0.8rem';
        marker.style.opacity = '0.6';
        layer.appendChild(marker);
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Delay init to ensure STATE is loaded
    setTimeout(function () {
        MarchVisualization.init();
    }, 1000);
});

// Export for global access
window.MarchVisualization = MarchVisualization;
