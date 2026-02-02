import os

file_path = 'main.js'

new_function_body = """function centerMapOnFortress() {
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
             console.log(`🏰 Jumping directly to coords: ${x}, ${y}`);
        } else {
             notify('לקלאן שלך אין מבצר עם קואורדינטות תקינות', 'error');
        }
    }, 50); // Small delay to clear event stack
}"""

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of the function
start_marker = "function centerMapOnFortress() {"
start_idx = content.find(start_marker)

if start_idx == -1:
    print("Error: Function not found!")
    exit(1)

# Find the end of the function (counting braces)
open_braces = 0
end_idx = -1
in_function = False

for i in range(start_idx, len(content)):
    if content[i] == '{':
        open_braces += 1
        in_function = True
    elif content[i] == '}':
        open_braces -= 1
    
    if in_function and open_braces == 0:
        end_idx = i + 1
        break

if end_idx == -1:
    print("Error: Could not find end of function!")
    exit(1)

# Replace the content
new_content = content[:start_idx] + new_function_body + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated centerMapOnFortress!")
