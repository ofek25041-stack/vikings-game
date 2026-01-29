// Clan invitation function - called from player profile
async function invitePlayerToClan(targetUser) {
    if (!STATE.clan?.id) {
        notify('אתה לא בקלאן!', 'error');
        return;
    }

    if (!targetUser || targetUser === 'NPC') {
        notify('לא ניתן להזמין שחקן זה', 'error');
        return;
    }

    try {
        const response = await fetch('/api/clan/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clanId: STATE.clan.id,
                targetUser: targetUser,
                from: CURRENT_USER
            })
        });

        const data = await response.json();
        if (data.success) {
            notify(`הזמנה נשלחה ל-${targetUser}! ✉️`, 'success');
            closeModal();
        } else {
            notify(data.message || 'שגיאה בשליחת הזמנה', 'error');
        }
    } catch (err) {
        console.error('Invite error:', err);
        notify('שגיאה בשליחת הזמנה', 'error');
    }
}
