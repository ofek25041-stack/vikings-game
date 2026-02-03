// Quick DB Check Script
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'vikings_game';

async function checkFortresses() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const clans = await db.collection('clans').find({}).toArray();

        console.log(`\n📊 Found ${clans.length} clans:\n`);

        clans.forEach(c => {
            console.log(`Clan: ${c.tag} (ID: ${c.id})`);
            if (c.fortress) {
                console.log(`  🏰 Fortress:`, c.fortress);
            } else {
                console.log(`  ❌ NO FORTRESS DATA`);
            }
            console.log('');
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
    }
}

checkFortresses();
