
window.debugFortressState = function () {
    console.log("=== FORTRESS DEBUG ===");

    // 1. Check Clan System
    if (!window.ClanSystem) console.error("❌ ClanSystem is undefined");
    else console.log("✅ ClanSystem loaded");

    // 2. Check ALL_CLANS
    if (!window.ALL_CLANS) console.error("❌ ALL_CLANS is undefined");
    else {
        const clans = Object.values(window.ALL_CLANS);
        console.log(`✅ ALL_CLANS has ${clans.length} clans`);
        clans.forEach(c => {
            console.log(`- Clan [${c.tag}] ID: ${c.id}`);
            if (c.fortress) {
                console.log(`  🏰 Fortress at: ${c.fortress.x}, ${c.fortress.y} (Type: ${typeof c.fortress.x})`);
            } else {
                console.log(`  ❌ No Fortress data`);
            }
        });
    }

    // 3. Check Map Entities at Fortress Coords
    console.log("--- Checking Map Entities ---");
    if (window.ALL_CLANS) {
        Object.values(window.ALL_CLANS).forEach(c => {
            if (c.fortress && c.fortress.x != null) {
                const key = `${c.fortress.x},${c.fortress.y}`;
                const ent = STATE.mapEntities[key];
                if (ent) {
                    console.log(`At ${key}: Type=${ent.type}, Name="${ent.name}", ClanID=${ent.clanId}`);
                } else {
                    console.error(`❌ No entity at fortress coords ${key}!`);
                }
            }
        });
    }

    // 4. Check My Clan
    if (STATE.clan) {
        console.log(`👤 My Clan: ID=${STATE.clan.id}, Tag=${STATE.clan.tag}`);
    } else {
        console.log("👤 Player has no clan state");
    }

    alert("Check Console (F12) for Debug Info");
};

// Auto-run if possible
console.log("Run debugFortressState() in console to check status");
