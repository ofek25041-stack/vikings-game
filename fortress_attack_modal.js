// Fortress Attack Modal Wrapper
function openFortressAttackModal(x, y, targetName) {
    // Build minimal entity object for attackFromFortress
    const targetEntity = {
        name: targetName,
        x: x,
        y: y,
        type: 'fortress'
    };

    // Call existing fortress attack function
    if (typeof window.attackFromFortress === 'function') {
        window.attackFromFortress(x, y, targetEntity);
    } else {
        notify("שגיאה: פונקציית תקיפת מבצר לא נמצאה", "error");
    }
}
