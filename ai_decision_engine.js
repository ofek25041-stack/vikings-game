// =====================================
// AI DECISION ENGINE
// =====================================

const { AI_PERSONALITIES } = require('./ai_personalities');

/**
 * Decision priorities - determines what AI considers important
 */
const DECISION_PRIORITIES = {
    critical: [
        'collect_overflow_resources',  // Resources at max
        'feed_army',                    // Low food with army
        'defend_territory'              // Under attack
    ],
    high: [
        'upgrade_town_hall',            // If affordable
        'build_missing_essential',      // Must-have buildings
        'train_minimum_army',           // Maintain min troops
        'research_available'            // Tech upgrades
    ],
    medium: [
        'upgrade_buildings',
        'conquer_nearby_territory',
        'trade_excess_resources',
        'train_additional_army',
        'upgrade_conquered_territories'
    ],
    low: [
        'send_random_message',
        'attack_weak_player',
        'create_trade_offer',
        'join_clan_activity'
    ]
};

/**
 * Decision Engine - Evaluates game state and returns best action
 */
class AIDecisionEngine {
    constructor(aiPlayer, personality) {
        this.aiPlayer = aiPlayer;
        this.personality = personality;
        this.weights = AI_PERSONALITIES[personality].weights;
        this.traits = AI_PERSONALITIES[personality].traits;
    }

    /**
     * Main decision function - evaluates state and returns action
     */
    async decide(gameState) {
        const actions = [];

        // Check each priority level
        for (const priority of ['critical', 'high', 'medium', 'low']) {
            const priorityActions = DECISION_PRIORITIES[priority];

            for (const actionType of priorityActions) {
                const action = await this.evaluateAction(actionType, gameState);
                if (action) {
                    actions.push({
                        type: actionType,
                        priority,
                        score: action.score,
                        data: action.data
                    });
                }
            }

            // If we found critical/high priority actions, execute immediately
            if (actions.length > 0 && (priority === 'critical' || priority === 'high')) {
                break;
            }
        }

        if (actions.length === 0) {
            return null; // Nothing to do
        }

        // Sort by score and return best action
        actions.sort((a, b) => b.score - a.score);
        return actions[0];
    }

    /**
     * Evaluate specific action type
     */
    async evaluateAction(actionType, gameState) {
        switch (actionType) {
            case 'collect_overflow_resources':
                return this.evaluateCollectResources(gameState);

            case 'feed_army':
                return this.evaluateFeedArmy(gameState);

            case 'upgrade_town_hall':
                return this.evaluateUpgradeTownHall(gameState);

            case 'build_missing_essential':
                return this.evaluateBuildEssential(gameState);

            case 'train_minimum_army':
                return this.evaluateTrainArmy(gameState, true);

            case 'upgrade_buildings':
                return this.evaluateUpgradeBuildings(gameState);

            case 'conquer_nearby_territory':
                return this.evaluateConquerTerritory(gameState);

            case 'trade_excess_resources':
                return this.evaluateTrade(gameState);

            case 'train_additional_army':
                return this.evaluateTrainArmy(gameState, false);

            case 'attack_weak_player':
                return this.evaluateAttackPlayer(gameState);

            case 'send_random_message':
                return this.evaluateSendMessage(gameState);

            case 'upgrade_conquered_territories':
                return this.evaluateUpgradeTerritories(gameState);

            case 'join_clan_activity':
                return this.evaluateJoinClan(gameState);

            default:
                return null;
        }
    }

    /**
     * Individual evaluation functions
     */

    evaluateCollectResources(state) {
        // Check if any resource is near max capacity
        const warehouse = state.buildings?.warehouse || { level: 1 };
        const capacity = 10000 + (warehouse.level * 5000);

        for (const [resource, amount] of Object.entries(state.resources || {})) {
            if (amount >= capacity * 0.95) {
                return {
                    score: 100, // Highest priority
                    data: { resource, amount }
                };
            }
        }
        return null;
    }

    evaluateFeedArmy(state) {
        const army = state.army || {};
        const totalArmy = (army.spearman || 0) + (army.archer || 0) + (army.swordsman || 0);
        const foodConsumption = totalArmy * 0.5; // 0.5 food per soldier per hour
        const currentFood = state.resources?.food || 0;

        // If food will run out in < 2 hours
        if (currentFood < foodConsumption * 2) {
            return {
                score: 90,
                data: { needed: foodConsumption * 10 } // Need for 10 hours
            };
        }
        return null;
    }

    evaluateUpgradeTownHall(state) {
        const townHall = state.buildings?.townHall || { level: 1 };
        const nextLevel = townHall.level + 1;

        // Check if we can afford upgrade
        const cost = this.calculateBuildingCost('townHall', nextLevel);
        if (!this.canAfford(state.resources, cost)) {
            return null;
        }

        // Town Hall is high priority - unlocks other upgrades
        const score = 80 * this.weights.build;
        return {
            score,
            data: { building: 'townHall', nextLevel, cost }
        };
    }

    evaluateBuildEssential(state) {
        const essential = ['barracks', 'warehouse', 'farm'];
        const missing = essential.find(b => !state.buildings?.[b]);

        if (missing) {
            const cost = this.calculateBuildingCost(missing, 1);
            if (this.canAfford(state.resources, cost)) {
                return {
                    score: 75,
                    data: { building: missing, level: 1, cost }
                };
            }
        }
        return null;
    }

    evaluateTrainArmy(state, minimumOnly) {
        const army = state.army || {};
        const totalArmy = (army.spearman || 0) + (army.archer || 0) + (army.swordsman || 0);
        const minArmy = state.buildings?.townHall?.level || 1 * 10; // 10 per level minimum

        if (minimumOnly && totalArmy >= minArmy) {
            return null; // Already have minimum
        }

        const barracks = state.buildings?.barracks || { level: 1 };
        const unitType = this.chooseUnitToTrain(barracks.level);
        const cost = this.getUnitCost(unitType);

        if (!this.canAfford(state.resources, cost)) {
            return null;
        }

        const score = minimumOnly ? 70 : (40 * this.weights.attack);
        return {
            score,
            data: { unitType, cost, count: Math.floor(state.resources.gold / cost.gold) }
        };
    }

    evaluateConquerTerritory(state) {
        // Check if we have enough army
        const army = state.army || {};
        const armyPower = (army.spearman || 0) * 10 + (army.archer || 0) * 15 + (army.swordsman || 0) * 20;

        if (armyPower < 500) {
            return null; // Too weak
        }

        // Conquer score based on personality
        const score = 50 * this.weights.conquer;
        return {
            score,
            data: { armyPower }
        };
    }

    evaluateUpgradeBuildings(state) {
        // Find upgradeable building
        const townHallLevel = state.buildings?.townHall?.level || 1;

        for (const [building, data] of Object.entries(state.buildings || {})) {
            if (data.level < townHallLevel) {
                const cost = this.calculateBuildingCost(building, data.level + 1);
                if (this.canAfford(state.resources, cost)) {
                    const score = 45 * this.weights.build;
                    return {
                        score,
                        data: { building, nextLevel: data.level + 1, cost }
                    };
                }
            }
        }
        return null;
    }

    evaluateTrade(state) {
        // Find excess/shortage
        const resources = state.resources || {};
        let maxResource = null;
        let maxAmount = 0;
        let minResource = null;
        let minAmount = Infinity;

        for (const [resource, amount] of Object.entries(resources)) {
            if (amount > maxAmount) {
                maxAmount = amount;
                maxResource = resource;
            }
            if (amount < minAmount) {
                minAmount = amount;
                minResource = resource;
            }
        }

        if (maxAmount > 50000 && minAmount < 10000) {
            const score = 35 * this.weights.trade;
            return {
                score,
                data: { offer: maxResource, request: minResource }
            };
        }
        return null;
    }

    evaluateAttackPlayer(state) {
        const army = state.army || {};
        const armyPower = (army.spearman || 0) * 10 + (army.archer || 0) * 15 + (army.swordsman || 0) * 20;

        if (armyPower < 1000) {
            return null; // Not strong enough
        }

        // Attack based on personality
        const score = 30 * this.weights.attack;
        if (score < 20) return null; // Economic/peaceful AI won't attack

        return {
            score,
            data: { armyPower }
        };
    }

    evaluateSendMessage(state) {
        // Random chat - low priority
        const score = 10;
        return { score, data: {} };
    }

    evaluateUpgradeTerritories(state) {
        // Check owned territories
        const territories = Object.values(state.mapEntities || {}).filter(
            t => t.owner === this.aiPlayer.username && t.level && t.level < 5
        );

        if (territories.length > 0) {
            const territory = territories[0];
            const cost = this.getTerritoryUpgradeCost(territory.level || 1);

            if (this.canAfford(state.resources, cost)) {
                const score = 40 * this.weights.build;
                return {
                    score,
                    data: { x: territory.x, y: territory.y, cost }
                };
            }
        }
        return null;
    }

    evaluateJoinClan(state) {
        if (state.clan) return null; // Already in clan

        const townHallLevel = state.buildings?.townHall?.level || 1;

        // Ensure minimum level to care about clans
        if (townHallLevel < 3) return null;

        // Create Clan (Rare, High level only)
        if (townHallLevel >= 10 && Math.random() < 0.1) {
            const score = 50 * this.weights.build; // Using build weight as proxy for ambition
            return {
                score,
                data: { action: 'create' }
            };
        }

        // Join Clan
        const score = 30;
        return {
            score,
            data: { action: 'join' }
        };
    }

    /**
     * Utility functions
     */

    canAfford(resources, cost) {
        for (const [resource, amount] of Object.entries(cost)) {
            if ((resources[resource] || 0) < amount) {
                return false;
            }
        }
        return true;
    }

    calculateBuildingCost(building, level) {
        const baseCosts = {
            townHall: { gold: 1000, wood: 500 },
            barracks: { gold: 500, wood: 300 },
            warehouse: { gold: 400, wood: 250 },
            farm: { gold: 300, wood: 200 },
            lumberMill: { gold: 400, wood: 100 },
            wall: { gold: 800, wood: 400, marble: 200 }
        };

        const base = baseCosts[building] || { gold: 500, wood: 250 };
        const multiplier = Math.pow(1.5, level - 1);

        const cost = {};
        for (const [resource, amount] of Object.entries(base)) {
            cost[resource] = Math.floor(amount * multiplier);
        }
        return cost;
    }

    getUnitCost(unitType) {
        const costs = {
            spearman: { gold: 50, wood: 30, food: 20 },
            archer: { gold: 80, wood: 50, food: 30 },
            swordsman: { gold: 120, wood: 80, food: 50, wine: 10 }
        };
        return costs[unitType] || costs.spearman;
    }

    chooseUnitToTrain(barracksLevel) {
        if (barracksLevel >= 10 && Math.random() < 0.3) return 'swordsman';
        if (barracksLevel >= 5 && Math.random() < 0.5) return 'archer';
        return 'spearman';
    }

    getTerritoryUpgradeCost(currentLevel) {
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
}

module.exports = AIDecisionEngine;
