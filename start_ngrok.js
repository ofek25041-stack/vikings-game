const ngrok = require('ngrok');

(async function () {
    try {
        await ngrok.kill(); // Force kill old info
        console.log("Setting authtoken...");
        await ngrok.authtoken('3816uE3lTkX9uBuabKoBolJJIL3_2qtgpRAiMwkM9KLnz6AkP');

        console.log("Starting ngrok tunnel on port 3000...");
        const url = await ngrok.connect(3000);

        console.log('\n==================================================');
        console.log(' YOUR GAME IS LIVE AT:');
        console.log(` ${url}`);
        console.log('==================================================\n');

        console.log('Keep this window OPEN to keep the link active.');

        // Prevent script from exiting
        setInterval(() => { }, 1000 * 60 * 60);
    } catch (err) {
        if (err.body && err.body.msg === 'invalid tunnel configuration') {
            console.log("Tunnel already active, fetching URL...");
            try {
                const http = require('http');
                http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        process.stdout.write("Fetching...");
                        try {
                            const tunnels = JSON.parse(data).tunnels;
                            if (tunnels.length > 0) {
                                console.log('\n==================================================');
                                console.log(' YOUR GAME IS LIVE AT:');
                                console.log(` ${tunnels[0].public_url}`);
                                console.log('==================================================\n');
                                console.log('Keep this window OPEN to keep the link active.');
                                setInterval(() => { }, 1000 * 60 * 60);
                            } else {
                                console.log("\nNo active tunnels found in API.");
                            }
                        } catch (e) { console.error(e); }
                    });
                });
            } catch (e) {
                console.error("Could not fetch active tunnels", e);
            }
        } else {
            console.error("Error starting ngrok:", err);
        }
    }
})();
