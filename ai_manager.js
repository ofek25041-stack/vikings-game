// =====================================
// AI MANAGER - Main AI Service
// =====================================

const { AI_PLAYERS, AI_PERSONALITIES } = require('./ai_personalities');
const AIDecisionEngine = require('./ai_decision_engine');
const AIActions = require('./ai_actions');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const DATA_DIR = path.join(__dirname, 'data', 'users');

/**
 * Main AI Manager - Orchestrates all AI players
 */
class AIManager {
    constructor() {
        this.aiPlayers = [];
        this.running = false;
        this.cycleInterval = null;
    }

    /**
     * Initialize all AI players
     */
    async initialize() {
        console.log('🤖 Initializing AI Manager...');
        console.log(`📊 Creating ${AI_PLAYERS.length} AI players...`);

        for (const aiProfile of AI_PLAYERS) {
            try {
                const aiPlayer = await this.createAIPlayer(aiProfile);
                if (aiPlayer) {
                    this.aiPlayers.push(aiPlayer);
                    console.log(`✅ Created: ${aiProfile.username} (${aiProfile.personality})`);
                }
            } catch (error) {
                console.error(`❌ Failed to create ${aiProfile.username}:`, error.message);
            }
        }

        console.log(`\n🎉 AI Manager initialized with ${this.aiPlayers.length} players!`);
    }

    /**
     * Create a single AI player in the game
     */
    async createAIPlayer(profile) {
        // Check if player already exists
        const filePath = this.getUserFilePath(profile.username);

        if (fs.existsSync(filePath)) {
            console.log(`  Player ${profile.username} already exists, loading...`);
            const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
                profile,
                decisionEngine: new AIDecisionEngine(profile, profile.personality),
                actions: new AIActions(profile, SERVER_URL),
                state: existingData.state,
                lastActionTime: Date.now()
            };
        }

        // Create new AI player
        const homeCoords = this.generateRandomCoords();
        const initialState = this.createInitialState(profile, homeCoords);

        // Save to file
        const userData = {
            username: profile.username,
            password: 'ai_player_' + Math.random().toString(36).substr(2, 9),
            state: initialState
        };

        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

        return {
            profile,
            decisionEngine: new AIDecisionEngine(profile, profile.personality),
            actions: new AIActions(profile, SERVER_URL),
            state: initialState,
            lastActionTime: Date.now()
        };
    }

    /**
     * Create initial game state for AI player
     */
    createInitialState(profile, homeCoords) {
        return {
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
            mapEntities: {},
            clan: profile.clanPreference === 'create' ? null : undefined, // Will join/create clans later
            lastLogin: Date.now(),
            reports: [],
            chats: {}
        };
    }

    /**
     * Start the AI manager (decision cycles for all AI)
     */
    start() {
        if (this.running) {
            console.log('AI Manager is already running!');
            return;
        }

        this.running = true;
        console.log('\n🚀 AI Manager started!');
        console.log('🔄 AI players will make decisions every 2-5 minutes...\n');

        // Stagger AI decision cycles to avoid server overload
        this.aiPlayers.forEach((ai, index) => {
            const delay = index * 5000; // 5 second stagger
            setTimeout(() => {
                this.scheduleAICycle(ai);
            }, delay);
        });
    }

    /**
     * Schedule decision cycle for a single AI
     */
    scheduleAICycle(aiPlayer) {
        if (!this.running) return;

        const cycleLater = () => {
            if (this.running) {
                const randomDelay = (2 + Math.random() * 3) * 60 * 1000; // 2-5 minutes
                setTimeout(() => this.scheduleAICycle(aiPlayer), randomDelay);
            }
        };

        // Execute one decision cycle
        this.executeAICycle(aiPlayer)
            .then(() => cycleLater())
            .catch(error => {
                console.error(`Error in AI cycle for ${aiPlayer.profile.username}:`, error.message);
                cycleLater();
            });
    }

    /**
     * Execute one decision cycle for an AI player
     */
    async executeAICycle(aiPlayer) {
        try {
            // Load current game state
            const gameState = await this.loadAIGameState(aiPlayer.profile.username);
            if (!gameState) {
                console.error(`Failed to load state for ${aiPlayer.profile.username}`);
                return;
            }

            aiPlayer.state = gameState;

            // Make decision
            const decision = await aiPlayer.decisionEngine.decide(gameState);

            if (!decision) {
                console.log(`[${aiPlayer.profile.username}] No action needed`);
                return;
            }

            console.log(`[${aiPlayer.profile.username}] Decision: ${decision.type} (score: ${decision.score.toFixed(1)})`);

            // Execute action
            const success = await aiPlayer.actions.executeAction(decision, gameState);

            if (success) {
                aiPlayer.lastActionTime = Date.now();
            }

        } catch (error) {
            console.error(`AI Cycle error for ${aiPlayer.profile.username}:`, error);
        }
    }

    /**
     * Load AI game state from server
     */
    async loadAIGameState(username) {
        try {
            const response = await fetch(`${SERVER_URL}/api/user/${encodeURIComponent(username)}`);
            if (!response.ok) return null;

            const data = await response.json();
            return data.state;
        } catch (error) {
            console.error(`Failed to load state for ${username}:`, error.message);
            return null;
        }
    }

    /**
     * Stop the AI manager
     */
    stop() {
        this.running = false;
        console.log('\n⏸️  AI Manager stopped');
    }

    /**
     * Utility functions
     */

    getUserFilePath(username) {
        const safeName = username.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        return path.join(DATA_DIR, `${safeName}.json`);
    }

    generateRandomCoords() {
        return {
            x: 100 + Math.floor(Math.random() * 800), // Spread across map
            y: 100 + Math.floor(Math.random() * 800)
        };
    }

    /**
     * Get AI statistics
     */
    getStatistics() {
        return {
            totalAI: this.aiPlayers.length,
            running: this.running,
            byPersonality: {
                aggressive: this.aiPlayers.filter(ai => ai.profile.personality === 'aggressive').length,
                economic: this.aiPlayers.filter(ai => ai.profile.personality === 'economic').length,
                balanced: this.aiPlayers.filter(ai => ai.profile.personality === 'balanced').length,
                clan: this.aiPlayers.filter(ai => ai.profile.personality === 'clan').length
            }
        };
    }
}

// =====================================
// MAIN EXECUTION
// =====================================

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('     VIKINGS GAME - AI MANAGER');
    console.log('═══════════════════════════════════════\n');

    const manager = new AIManager();

    // Initialize AI players
    await manager.initialize();

    // Wait a bit for server to be ready
    console.log('\n⏳ Waiting 5 seconds for server...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Start AI manager
    manager.start();

    // Print statistics
    console.log('\n📊 AI Statistics:');
    console.log(manager.getStatistics());

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down AI Manager...');
        manager.stop();
        process.exit(0);
    });
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = AIManager;
