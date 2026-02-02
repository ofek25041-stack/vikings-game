const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'main.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Update Map Tile Icon
    // Look for the fortress-icon div
    const iconRegex = /<div class="fortress-icon">🏰<\/div>/;
    if (iconRegex.test(content)) {
        content = content.replace(iconRegex, '<div class="fortress-icon">🏯</div>');
        console.log('✅ Updated map tile icon.');
    } else {
        console.warn('⚠️ Could not find map tile icon to update (might be already updated).');
    }

    // 2. Update getEntityIcon function
    // Look for the city case and append fortress case
    const switchRegex = /case 'city': return '🏰';/;
    if (switchRegex.test(content)) {
        // Check if fortress case already exists
        if (!content.includes("case 'fortress': return '🏯';")) {
            content = content.replace(switchRegex, "case 'city': return '🏰';\n        case 'fortress': return '🏯';");
            console.log('✅ Updated getEntityIcon switch.');
        } else {
            console.log('ℹ️ Fortress case already exists in switch.');
        }
    } else {
        console.warn('⚠️ Could not find switch case to update.');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('🎉 main.js updated successfully!');

} catch (err) {
    console.error('❌ Error updating file:', err);
    process.exit(1);
}
