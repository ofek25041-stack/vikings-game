
const { MongoClient } = require('mongodb');

// URI from your previous context or environment
const uri = "mongodb+srv://ofek:ofek25041@cluster0.1k1da.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function checkDuplicates() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('vikings_db'); // Verify DB name from server.js

        console.log("Connected to DB. Checking users...");

        const users = await db.collection('users').find({}).toArray();
        console.log(`Total users: ${users.length}`);

        const names = {};
        users.forEach(u => {
            const lower = u.username.toLowerCase();
            if (!names[lower]) names[lower] = [];
            names[lower].push({
                original: u.username,
                coords: u.state.homeCoords,
                id: u._id
            });
        });

        let found = false;
        for (const [key, list] of Object.entries(names)) {
            if (list.length > 1) {
                console.log(`⚠️ DUPLICATE/CASE-VARIANT FOUND for "${key}":`);
                list.forEach(item => console.log(JSON.stringify(item, null, 2)));
                found = true;
            }
        }

        if (!found) console.log("✅ No duplicates found.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

checkDuplicates();
