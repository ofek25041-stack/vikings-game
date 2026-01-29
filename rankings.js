// ===========================
// CLAN RANKINGS SYSTEM
// ===========================

window.Rankings = {
    async init() {
        await this.render();
    },

    async render() {
        const container = document.getElementById('rankings-content');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">טוען דירוגים...</div>';

        try {
            const response = await fetch('/api/clans/rankings');
            const data = await response.json();

            if (!data.success || !data.rankings || data.rankings.length === 0) {
                container.innerHTML =
                    '<div style="text-align:center; padding:40px; color:#94a3b8;">' +
                    '<div style="font-size:3rem;">' + '\uD83C\uDFC6' + '</div>' +
                    '<p>אין קלאנים דורגו עדיין</p>' +
                    '</div>';
                return;
            }

            let html = '<div style="display:grid; gap:15px;">';

            for (const clan of data.rankings) {
                // Medal for TOP 3
                let medal = '';
                let backgroundColor = 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))';

                if (clan.rank === 1) {
                    medal = '\uD83E\uDD47'; // 🥇
                    backgroundColor = 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(218,165,32,0.2))';
                } else if (clan.rank === 2) {
                    medal = '\uD83E\uDD48'; // 🥈
                    backgroundColor = 'linear-gradient(135deg, rgba(192,192,192,0.2), rgba(169,169,169,0.2))';
                } else if (clan.rank === 3) {
                    medal = '\uD83E\uDD49'; // 🥉
                    backgroundColor = 'linear-gradient(135deg, rgba(205,127,50,0.2), rgba(184,115,51,0.2))';
                }

                // Highlight player's clan
                const isPlayerClan = STATE.clan && STATE.clan.id === clan.id;
                if (isPlayerClan) {
                    backgroundColor = 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.3))';
                }

                html += `
                    <div style="background:${backgroundColor}; padding:15px; border-radius:12px; border:${isPlayerClan ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)'};">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:15px;">
                                <div style="font-size:2rem; font-weight:bold; color:#fbbf24; min-width:40px;">
                                    ${medal || '#' + clan.rank}
                                </div>
                                <div>
                                    <div style="font-size:1.5rem; font-weight:bold; color:white;">
                                        ${clan.icon} [${clan.tag}] ${clan.name}
                                        ${isPlayerClan ? '<span style="color:#3b82f6; font-size:0.9rem; margin-right:10px;">⭐ הקלאן שלך</span>' : ''}
                                    </div>
                                    <div style="color:#94a3b8; font-size:0.9rem; margin-top:5px;">
                                        👥 ${clan.members} חברים | 
                                        ${clan.hasFortress ? '🏰 מבצר |' : ''} 
                                        ⚔️ ${clan.victories} ניצחונות |
                                        📈 רמה ממוצעת: ${clan.avgLevel}
                                    </div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:1.8rem; font-weight:bold; color:#fbbf24;">
                                    ${clan.score.toLocaleString()}
                                </div>
                                <div style="color:#94a3b8; font-size:0.8rem;">נקודות</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            html += '</div>';

            // Add legend
            html +=
                '<div style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:8px;">' +
                '<h4 style="color:#fbbf24; margin-bottom:10px;">חישוב ציון:</h4>' +
                '<div style="color:#cbd5e1; font-size:0.9rem; line-height:1.8;">' +
                '• חברים: x100 נקודות<br>' +
                '• שטחים: x500 נקודות<br>' +
                '• ניצחונות: x200 נקודות<br>' +
                '• מבצר: +2000 נקודות<br>' +
                '• רמה ממוצעת: x150 נקודות<br>' +
                '• עושר: /1000 נקודות' +
                '</div>' +
                '</div>';

            container.innerHTML = html;

        } catch (err) {
            console.error('Error loading rankings:', err);
            container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">שגיאה בטעינת הדירוגים</div>';
        }
    }
};
