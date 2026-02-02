const fs = require('fs');

const filePath = 'main.js';

const newFunctionBody = `function centerMapOnFortress() {
    // Check if player is in a clan
    if (!STATE.clan || !STATE.clan.id) {
        notify('אתה לא שייך לקלאן', 'error');
        return;
    }

    // Get clan data
    const clan = window.ALL_CLANS[STATE.clan.id];

    // Check if fortress exists with coordinates
    if (!clan || !clan.fortress || clan.fortress.x === undefined || clan.fortress.y === undefined) {
        notify('לקלאן שלך אין מבצר', 'error');
        return;
    }

    // Use setTimeout to detach from the click event and ensure DOM is ready
    setTimeout(() => {
        const x = parseInt(clan.fortress.x);
        const y = parseInt(clan.fortress.y);
        
        if (!isNaN(x) && !isNaN(y)) {
             // Pass coordinates directly to the function
             // This bypasses any DOM input issues
             window.jumpToCoords(x, y);
             console.log(\`🏰 Jumping directly to coords: \${x}, \${y}\`);
        } else {
             notify('לקלאן שלך אין מבצר עם קואורדינטות תקינות', 'error');
        }
    }, 50); // Small delay to clear event stack
}`;

try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Find start of function
    const startMarker = 'function centerMapOnFortress() {';
    const startIdx = content.indexOf(startMarker);

    if (startIdx === -1) {
        console.error('Error: Function not found!');
        process.exit(1);
    }

    // Find end of function (brace counting)
    let openBraces = 0;
    let endIdx = -1;
    let inFunction = false;

    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            openBraces++;
            inFunction = true;
        } else if (content[i] === '}') {
            openBraces--;
        }

        if (inFunction && openBraces === 0) {
            endIdx = i + 1;
            break;
        }
    }

    if (endIdx === -1) {
        console.error('Error: Could not find end of function!');
        process.exit(1);
    }

    // Replace content
    const newContent = content.substring(0, startIdx) + newFunctionBody + content.substring(endIdx);

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully updated centerMapOnFortress!');

} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
