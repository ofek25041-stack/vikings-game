// Emergency: Create fortress directly in MongoDB via API endpoint
// Add this at the end of server.js to allow manual fortress creation

app.post('/api/emergency/create-fortress', async (req, res) => {
    try {
        if (!db) {
            return res.json({ success: false, error: 'Database not connected' });
        }

        const { clanTag, x, y } = req.body;

        // Find clan by tag
        const clan = await db.collection('clans').findOne({ tag: clanTag });

        if (!clan) {
            return res.json({ success: false, error: `Clan ${clanTag} not found` });
        }

        if (clan.fortress) {
            return res.json({ success: false, error: 'Fortress already exists', existing: clan.fortress });
        }

        // Create fortress
        const fortress = {
            x: parseInt(x),
            y: parseInt(y),
            level: 1,
            hp: 5000,
            maxHp: 5000,
            garrison: {},
            deposits: {},
            createdAt: Date.now()
        };

        // Save to database
        await db.collection('clans').updateOne(
            { id: clan.id },
            { $set: { fortress: fortress } }
        );

        console.log(`[EMERGENCY] Created fortress for clan ${clanTag} at (${x}, ${y})`);

        res.json({
            success: true,
            fortress: fortress,
            message: `Fortress created at (${x}, ${y})`
        });

    } catch (error) {
        console.error('[EMERGENCY] Fortress creation error:', error);
        res.json({ success: false, error: error.message });
    }
});
