/* --- IMAGE MAP INTERACTIONS --- */

// Global function accessible from HTML onclick attributes
window.openBuildingModal = function (buildingType) {
    console.log("🏗️ Opening building modal for:", buildingType);

    // Map image map building names to STATE.buildings keys
    const buildingMap = {
        'townhall': 'townHall',
        'academy': 'academy',
        'warehouse': 'warehouse',
        'barracks': 'barracks',
        'lumber': 'lumber',
        'mine': 'mine',
        'port': 'port'
    };

    const stateKey = buildingMap[buildingType] || buildingType;

    // Call existing interactBuilding function
    if (typeof interactBuilding === 'function') {
        interactBuilding(stateKey);
    } else {
        console.error("❌ interactBuilding function not found!");
    }
};

// Function to update building label levels
window.updateBuildingLabels = function () {
    // Access STATE from window
    const STATE = window.STATE;

    if (!STATE) {
        console.log("⏳ STATE not available yet");
        return;
    }

    if (!STATE.buildings) {
        console.log("⏳ STATE.buildings not available yet");
        return;
    }

    console.log("🔄 Updating building labels...");

    // Map of building keys to label IDs  
    const labelMap = {
        'townHall': 'label-townhall-lvl',
        'academy': 'label-academy-lvl',
        'warehouse': 'label-warehouse-lvl',
        'barracks': 'label-barracks-lvl',
        'lumber': 'label-lumber-lvl',
        'mine': 'label-mine-lvl',
        'port': 'label-port-lvl'
    };

    let updated = 0;
    let notFound = 0;

    for (const [key, b] of Object.entries(STATE.buildings)) {
        const labelId = labelMap[key];
        if (labelId) {
            const labelEl = document.getElementById(labelId);
            if (labelEl) {
                const oldValue = labelEl.innerText;
                labelEl.innerText = b.level;
                console.log(`  ${key}: ${oldValue} → ${b.level}`);
                updated++;
            } else {
                console.log(`  ⚠️ ${labelId} not found in DOM`);
                notFound++;
            }
        }
    }

    console.log(`✅ Updated ${updated} labels, ${notFound} not found`);
};

// Hook into switchView to update labels when city view is shown
setTimeout(function () {
    const originalSwitchView = window.switchView;
    if (originalSwitchView) {
        window.switchView = function (viewName) {
            const result = originalSwitchView.apply(this, arguments);
            if (viewName === 'city') {
                setTimeout(updateBuildingLabels, 100);
            }
            return result;
        };
    }

    if (typeof updateUI !== 'undefined') {
        const original = updateUI;
        window.updateUI = function () {
            if (original) original.apply(this, arguments);
            // Only update if in city view
            if (document.getElementById('label-townhall-lvl')) {
                updateBuildingLabels();
            }
        };
    }
}, 100);

// Auto-update every 3 seconds if in city view
setInterval(function () {
    if (window.STATE && document.getElementById('label-townhall-lvl')) {
        updateBuildingLabels();
    }
}, 3000);

// Initial updates
setTimeout(() => {
    console.log("🚀 Initial label update attempt");
    updateBuildingLabels();
}, 1000);

setTimeout(() => {
    console.log("🚀 Second label update attempt");
    updateBuildingLabels();
}, 3000);

console.log("✅ city_imagemap.js loaded successfully");
