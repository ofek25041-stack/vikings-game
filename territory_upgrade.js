// =====================================
// TERRITORY UPGRADE SYSTEM
// =====================================

/**
 * Get cost for upgrading territory to next level
 */
function getTerritoryUpgradeCost(currentLevel) {
    const nextLevel = currentLevel + 1;
    const multiplier = Math.pow(2, nextLevel - 1);

    return {
        gold: 10000 * multiplier,
        wood: 8000 * multiplier,
        food: 5000 * multiplier,
        wine: 3000 * multiplier,
        marble: 2000 * multiplier,
        crystal: 1500 * multiplier,
        sulfur: 1000 * multiplier
    };
}

/**
 * Calculate production rate for territory at given level
 */
function getTerritoryProduction(level) {
    const levelBonuses = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540];
    const bonusPercent = levelBonuses[(level || 1) - 1] || 0;
    const baseProduction = 3600; // per hour
    return Math.floor(baseProduction * (100 + bonusPercent) / 100);
}

/**
 * Upgrade territory at coordinates
 */
async function upgradeTerritoryAtCoords(x, y) {
    const key = `${x},${y}`;
    const territory = STATE.mapEntities[key];

    if (!territory) {
        notify('שטח לא נמצא', 'error');
        return;
    }

    if (territory.owner !== CURRENT_USER) {
        notify('אינך בעלים של השטח', 'error');
        return;
    }

    const currentLevel = territory.level || 1;

    if (currentLevel >= 10) {
        notify('השטח כבר ברמה מקסימלית!', 'info');
        return;
    }

    const cost = getTerritoryUpgradeCost(currentLevel);

    // Check if player has enough resources
    for (const [resource, amount] of Object.entries(cost)) {
        if ((STATE.resources[resource] || 0) < amount) {
            notify(`אין מספיק ${resource}! נדרש: ${amount.toLocaleString()}`, 'error');
            return;
        }
    }

    // Confirm upgrade
    const nextLevel = currentLevel + 1;
    const currentProd = getTerritoryProduction(currentLevel);
    const nextProd = getTerritoryProduction(nextLevel);

    const confirmMsg = `לשדרג ל-${nextLevel}?\n\nייצור נוכחי: ${currentProd.toLocaleString()}/שעה\nייצור חדש: ${nextProd.toLocaleString()}/שעה (+${(nextProd - currentProd).toLocaleString()})\n\nעלות:\n💰 ${cost.gold.toLocaleString()}\n🌲 ${cost.wood.toLocaleString()}\n🌾 ${cost.food.toLocaleString()}\n🍷 ${cost.wine.toLocaleString()}\n🏛️ ${cost.marble.toLocaleString()}\n💎 ${cost.crystal.toLocaleString()}\n🔥 ${cost.sulfur.toLocaleString()}`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const response = await fetch('/api/territory/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: CURRENT_USER, x, y })
        });

        const data = await response.json();

        if (data.success) {
            // Update local state
            STATE.mapEntities[key].level = data.newLevel;
            STATE.resources = data.resources;

            updateUI();
            notify(`🎉 שדרוג הושלם! השדה כעת ברמה ${data.newLevel}`, 'success');

            // Close any open modals
            if (typeof closeModal === 'function') {
                closeModal();
            }
        } else {
            notify(data.message || 'שגיאה בשדרוג', 'error');
        }
    } catch (err) {
        console.error('Error upgrading territory:', err);
        notify('שגיאת שרת', 'error');
    }
}

// Make function globally available
window.upgradeTerritoryAtCoords = upgradeTerritoryAtCoords;
window.getTerritoryUpgradeCost = getTerritoryUpgradeCost;
window.getTerritoryProduction = getTerritoryProduction;
