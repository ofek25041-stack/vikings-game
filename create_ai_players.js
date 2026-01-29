// =========================================
// SIMPLIFIED AI MANAGER (No External Deps)
// =========================================

const { AI_PLAYERS } = require('./ai_personalities');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'users');

/**
 * Simplified AI Manager - Works without network calls
 * Directly modifies player files for testing
 */
class SimpleAIManager {
    constructor() {
        this.aiPlayers = [];
        this.running = false;
    }

    async initialize() {
        console.log('🤖 Initializing Simple AI Manager...');
        console.log(`📊 Creating ${AI_PLAYERS.length} AI players...\n`);

        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        for (const profile of AI_PLAYERS) {
            try {
                this.createOrLoadPlayer(profile);
                this.aiPlayers.push(profile);
                console.log(`✅ ${profile.username} (${profile.personality})`);
            } catch (error) {
                console.error(`❌ Failed: ${profile.username}`, error.message);
            }
        }

        console.log(`\n🎉 Created ${this.aiPlayers.length} AI players!`);
    }

    createOrLoadPlayer(profile) {
        const filePath = this.getUserFilePath(profile.username);

        if (fs.existsSync(filePath)) {
            console.log(`  (already exists, skipping)`);
            return;
        }

        // Create new AI player
        const homeCoords = {
            x: 100 + Math.floor(Math.random() * 800),
            y: 100 + Math.floor(Math.random() * 800)
        };

        const userData = {
            username: profile.username,
            password: 'ai_player',
            state: {
                homeCoords,
                resources: profile.startingResources,
                buildings: {
                    townHall: { level: Math.max(1, profile.level - 5) },
                    barracks: { level: Math.max(1, profile.level - 7) },
                    warehouse: { level: Math.max(1, profile.level - 8) },
                    farm: { level: Math.max(1, profile.level - 6) },
                    lumberMill: { level: Math.max(1, profile.level - 7) }
                },
                army: {
                    spearman: profile.level * 20,
                    archer: profile.level * 10,
                    swordsman: profile.level * 5
                },
                research: {},
                stats: {
                    battles: Math.floor(Math.random() * profile.level * 5),
                    wins: Math.floor(Math.random() * profile.level * 3),
                    losses: Math.floor(Math.random() * profile.level * 2)
                },
                city: {
                    population: profile.level * 100,
                    happiness: 75 + Math.floor(Math.random() * 20)
                },
                mapEntities: {
                    // Add player's city first
                    [`${homeCoords.x},${homeCoords.y}`]: {
                        type: 'city',
                        name: profile.username,
                        user: profile.username,
                        level: Math.max(1, profile.level - 5),
                        x: homeCoords.x,
                        y: homeCoords.y,
                        isMyCity: false,
                        motto: profile.motto
                    },
                    // Add conquered territories
                    ...this.createInitialTerritories(homeCoords, profile.level, profile.username)
                },
                lastLogin: Date.now(),
                reports: [],
                chats: {},
                motto: profile.motto
            }
        };

        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
    }

    createInitialTerritories(homeCoords, level, username) {
        const territories = {};
        const territoryCount = Math.floor(level / 3); // 1 territory per 3 levels

        for (let i = 0; i < territoryCount; i++) {
            const x = homeCoords.x + Math.floor(Math.random() * 40) - 20;
            const y = homeCoords.y + Math.floor(Math.random() * 40) - 20;
            const key = `${x},${y}`;

            const types = [
                { type: 'field', resource: 'food', name: 'שדה חיטה' },
                { type: 'wood', resource: 'wood', name: 'מחנה חוטבים' },
                { type: 'farm', resource: 'wine', name: 'כרם ענבים' }
            ];

            const chosen = types[Math.floor(Math.random() * types.length)];

            territories[key] = {
                ...chosen,
                owner: username,
                level: 1 + Math.floor(Math.random() * 3),
                x,
                y
            };
        }

        return territories;
    }

    getUserFilePath(username) {
        const safeName = username.replace(/[^a-z0-9_א-ת]/gi, '_');
        return path.join(DATA_DIR, `${safeName}.json`);
    }

    start() {
        console.log('\n🚀 AI Players created and ready!');
        console.log('📝 Note: This is a simplified version - AI players are static');
        console.log('💡 Full AI behavior (actions, messages) requires additional setup\n');
    }
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════');
    console.log('   VIKINGS GAME - AI PLAYERS SETUP');
    console.log('═══════════════════════════════════════\n');

    const manager = new SimpleAIManager();
    await manager.initialize();
    manager.start();

    console.log('✅ AI Players are now in the game!');
    console.log('🎮 Restart the server and you\'ll see them on the map\n');
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = SimpleAIManager;
