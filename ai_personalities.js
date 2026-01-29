// =====================================
// AI PERSONALITIES & PLAYER PROFILES
// =====================================

/**
 * 20 AI Players with unique personalities
 * Split into 4 categories: Aggressive, Economic, Balanced, Clan-focused
 */

const AI_PERSONALITIES = {
    // Aggressive Warriors - Focus on military expansion
    aggressive: {
        weights: {
            attack: 3.0,
            build: 0.5,
            trade: 0.3,
            conquer: 2.5,
            clan: 0.7
        },
        traits: {
            attackFrequency: 'high',      // Every 15-30 min
            targetPreference: 'weak',      // Attack weaker players
            armyRatio: 0.7,                // 70% of resources to army
            riskTolerance: 'high',         // Willing to take risks
            chatStyle: 'threatening'
        }
    },

    // Economic Builders - Focus on resource production
    economic: {
        weights: {
            attack: 0.3,
            build: 3.0,
            trade: 2.0,
            conquer: 1.0,
            clan: 1.2
        },
        traits: {
            attackFrequency: 'low',        // Rarely attacks
            targetPreference: 'resource',  // Only for resources
            armyRatio: 0.3,                // 30% to army
            riskTolerance: 'low',          // Cautious
            chatStyle: 'friendly'
        }
    },

    // Balanced Players - Jack of all trades
    balanced: {
        weights: {
            attack: 1.0,
            build: 1.0,
            trade: 1.0,
            conquer: 1.0,
            clan: 1.0
        },
        traits: {
            attackFrequency: 'medium',     // Opportunistic
            targetPreference: 'mixed',     // Various targets
            armyRatio: 0.5,                // Balanced
            riskTolerance: 'medium',       // Calculated risks
            chatStyle: 'diplomatic'
        }
    },

    // Clan Focused - Team players
    clan: {
        weights: {
            attack: 0.7,
            build: 1.5,
            trade: 1.0,
            conquer: 1.2,
            clan: 3.0
        },
        traits: {
            attackFrequency: 'low',        // Prefers clan attacks
            targetPreference: 'strategic', // Targets that help clan
            armyRatio: 0.5,
            riskTolerance: 'medium',
            chatStyle: 'cooperative'
        }
    }
};

/**
 * 20 AI Player Profiles
 */
const AI_PLAYERS = [
    // === AGGRESSIVE WARRIORS (5) ===
    {
        username: 'נמרוד_הכובש',
        personality: 'aggressive',
        level: 15,
        startingResources: { gold: 50000, wood: 30000, food: 25000, wine: 5000, marble: 3000, crystal: 2000, sulfur: 1000 },
        motto: 'הכוח הוא הכל!',
        clanPreference: 'create' // Will create own clan
    },
    {
        username: 'סיגורד_האכזר',
        personality: 'aggressive',
        level: 12,
        startingResources: { gold: 40000, wood: 25000, food: 20000, wine: 4000, marble: 2500, crystal: 1500, sulfur: 800 },
        motto: 'רק החזקים שורדים',
        clanPreference: 'join' // Will join aggressive clans
    },
    {
        username: 'רגנר_הפורע',
        personality: 'aggressive',
        level: 14,
        startingResources: { gold: 45000, wood: 28000, food: 23000, wine: 4500, marble: 2800, crystal: 1800, sulfur: 900 },
        motto: 'כל הארץ תהיה שלי',
        clanPreference: 'join'
    },
    {
        username: 'ביורן_המלך',
        personality: 'aggressive',
        level: 13,
        startingResources: { gold: 42000, wood: 26000, food: 21000, wine: 4200, marble: 2600, crystal: 1600, sulfur: 850 },
        motto: 'אין כבוד בלי קרב',
        clanPreference: 'create'
    },
    {
        username: 'אייבר_חסר_העצמות',
        personality: 'aggressive',
        level: 11,
        startingResources: { gold: 38000, wood: 24000, food: 19000, wine: 3800, marble: 2300, crystal: 1400, sulfur: 750 },
        motto: 'פחד הוא חולשה',
        clanPreference: 'solo'
    },

    // === ECONOMIC BUILDERS (5) ===
    {
        username: 'הרלד_הסוחר',
        personality: 'economic',
        level: 16,
        startingResources: { gold: 60000, wood: 40000, food: 35000, wine: 8000, marble: 5000, crystal: 3000, sulfur: 1500 },
        motto: 'זהב פותח כל דלת',
        clanPreference: 'join'
    },
    {
        username: 'גונהילד_העשירה',
        personality: 'economic',
        level: 14,
        startingResources: { gold: 55000, wood: 38000, food: 32000, wine: 7000, marble: 4500, crystal: 2800, sulfur: 1300 },
        motto: 'עושר הוא כוח אמיתי',
        clanPreference: 'join'
    },
    {
        username: 'אולף_המלומד',
        personality: 'economic',
        level: 15,
        startingResources: { gold: 58000, wood: 39000, food: 34000, wine: 7500, marble: 4800, crystal: 2900, sulfur: 1400 },
        motto: 'חכמה עדיפה על כוח',
        clanPreference: 'solo'
    },
    {
        username: 'פרייה_הבונה',
        personality: 'economic',
        level: 13,
        startingResources: { gold: 52000, wood: 36000, food: 30000, wine: 6500, marble: 4200, crystal: 2600, sulfur: 1200 },
        motto: 'עיר חזקה היא מגן',
        clanPreference: 'create'
    },
    {
        username: 'תורסטן_החכם',
        personality: 'economic',
        level: 12,
        startingResources: { gold: 48000, wood: 34000, food: 28000, wine: 6000, marble: 3800, crystal: 2400, sulfur: 1100 },
        motto: 'תכנון הוא המפתח',
        clanPreference: 'join'
    },

    // === BALANCED PLAYERS (5) ===
    {
        username: 'אייריק_האדום',
        personality: 'balanced',
        level: 14,
        startingResources: { gold: 50000, wood: 32000, food: 28000, wine: 6000, marble: 3500, crystal: 2200, sulfur: 1000 },
        motto: 'איזון הוא המפתח',
        clanPreference: 'join'
    },
    {
        username: 'לגרתה_המלכה',
        personality: 'balanced',
        level: 15,
        startingResources: { gold: 53000, wood: 34000, food: 30000, wine: 6500, marble: 3800, crystal: 2400, sulfur: 1100 },
        motto: 'חכמה וכוח ביחד',
        clanPreference: 'create'
    },
    {
        username: 'רולו_הצפוני',
        personality: 'balanced',
        level: 13,
        startingResources: { gold: 48000, wood: 31000, food: 27000, wine: 5800, marble: 3400, crystal: 2100, sulfur: 950 },
        motto: 'הסתגלנות היא הישרדות',
        clanPreference: 'join'
    },
    {
        username: 'אסטריד_החזקה',
        personality: 'balanced',
        level: 14,
        startingResources: { gold: 51000, wood: 33000, food: 29000, wine: 6200, marble: 3600, crystal: 2300, sulfur: 1050 },
        motto: 'כוח באיזון',
        clanPreference: 'join'
    },
    {
        username: 'פלוקי_הבונה',
        personality: 'balanced',
        level: 12,
        startingResources: { gold: 46000, wood: 30000, food: 26000, wine: 5500, marble: 3200, crystal: 2000, sulfur: 900 },
        motto: 'הכל במידה',
        clanPreference: 'solo'
    },

    // === CLAN FOCUSED (5) ===
    {
        username: 'הראלד_הכחול',
        personality: 'clan',
        level: 16,
        startingResources: { gold: 55000, wood: 36000, food: 32000, wine: 7000, marble: 4000, crystal: 2500, sulfur: 1200 },
        motto: 'יחד אנחנו חזקים',
        clanPreference: 'create'
    },
    {
        username: 'יורוק_האחד',
        personality: 'clan',
        level: 14,
        startingResources: { gold: 52000, wood: 34000, food: 30000, wine: 6500, marble: 3700, crystal: 2300, sulfur: 1100 },
        motto: 'הקלאן הוא המשפחה',
        clanPreference: 'join'
    },
    {
        username: 'אודין_השליט',
        personality: 'clan',
        level: 15,
        startingResources: { gold: 54000, wood: 35000, food: 31000, wine: 6800, marble: 3900, crystal: 2400, sulfur: 1150 },
        motto: 'מנהיגות דרך שיתוף',
        clanPreference: 'create'
    },
    {
        username: 'פרגיה_האמיצה',
        personality: 'clan',
        level: 13,
        startingResources: { gold: 50000, wood: 33000, food: 29000, wine: 6200, crystal: 2200, sulfur: 1050 },
        motto: 'נלחם יחד או נפול לבד',
        clanPreference: 'join'
    },
    {
        username: 'קטגט_המגן',
        personality: 'clan',
        level: 14,
        startingResources: { gold: 53000, wood: 34500, food: 30500, wine: 6600, marble: 3800, crystal: 2350, sulfur: 1120 },
        motto: 'הגנה משותפת',
        clanPreference: 'join'
    }
];

module.exports = {
    AI_PERSONALITIES,
    AI_PLAYERS
};
