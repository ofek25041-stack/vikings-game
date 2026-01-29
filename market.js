// ===========================
// TRADING MARKET SYSTEM
// ===========================

// Helper function to get resource icon
window.getTypeIcon = function (type) {
    const icons = {
        gold: '\uD83D\uDCB0',      // 💰
        wood: '\uD83C\uDF32',      // 🌲
        food: '\uD83C\uDF3E',      // 🌾
        wine: '\uD83C\uDF77',      // 🍷
        marble: '\uD83C\uDFDB',    // 🏛️
        crystal: '\uD83D\uDC8E',   // 💎
        sulfur: '\uD83D\uDD25',    // 🔥
        citizens: '\uD83D\uDC65'   // 👥
    };
    return icons[type] || '\u2753';  // ❓
};

window.Market = {
    currentTab: 'browse',

    init() {
        this.render();
    },

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'rgba(255,255,255,0.1)';
        });

        const activeBtn = document.getElementById(`market-tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = '#3b82f6';
        }

        this.render();
    },

    async render() {
        const container = document.getElementById('market-content');
        if (!container) return;

        if (this.currentTab === 'browse') {
            await this.renderBrowse(container);
        } else if (this.currentTab === 'create') {
            this.renderCreate(container);
        } else if (this.currentTab === 'mytrades') {
            await this.renderMyTrades(container);
        }
    },

    async renderBrowse(container) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">טוען הצעות...</div>';

        try {
            const response = await fetch('/api/market/offers');
            const data = await response.json();

            if (!data.success || !data.offers || data.offers.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#94a3b8;">
                        <div style="font-size:3rem;">📭</div>
                        <p>אין הצעות פעילות כרגע</p>
                        <button class="btn-primary" onclick="Market.switchTab('create')">צור הצעה ראשונה</button>
                    </div>
                `;
                return;
            }

            let html = '<div style="display:grid; gap:15px;">';

            for (const offer of data.offers) {
                // Skip own offers
                if (offer.seller === CURRENT_USER) continue;

                const offeringStr = Object.entries(offer.offering)
                    .filter(([res, amt]) => amt > 0)
                    .map(([res, amt]) => `${amt} ${window.getTypeIcon(res)}`)
                    .join(' + ');

                const requestingStr = Object.entries(offer.requesting)
                    .filter(([res, amt]) => amt > 0)
                    .map(([res, amt]) => `${amt} ${window.getTypeIcon(res)}`)
                    .join(' + ');

                const timeLeft = Math.max(0, Math.floor((offer.expiresAt - Date.now()) / 1000 / 60 / 60));

                html += `
                    <div style="background:linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9)); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <div style="color:#fbbf24; font-weight:bold;">👤 ${offer.seller}</div>
                            <div style="color:#94a3b8; font-size:0.85rem;">⏳ ${timeLeft}h נותרו</div>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; margin:15px 0;">
                            <div style="flex:1; background:rgba(59,130,246,0.1); padding:10px; border-radius:8px; text-align:center;">
                                <div style="color:#60a5fa; font-size:0.85rem; margin-bottom:5px;">מציע</div>
                                <div style="color:white; font-size:1.1rem;">${offeringStr}</div>
                            </div>
                            
                            <div style="color:#fbbf24; font-size:1.5rem;">⇄</div>
                            
                            <div style="flex:1; background:rgba(251,191,36,0.1); padding:10px; border-radius:8px; text-align:center;">
                                <div style="color:#fbbf24; font-size:0.85rem; margin-bottom:5px;">מבקש</div>
                                <div style="color:white; font-size:1.1rem;">${requestingStr}</div>
                            </div>
                        </div>
                        
                        <button class="btn-primary" onclick="Market.acceptTrade('${offer.id}')" style="width:100%; background:linear-gradient(135deg, #10b981, #059669);">
                            ✅ קבל הצעה
                        </button>
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Error loading offers:', err);
            container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">שגיאה בטעינת הצעות</div>';
        }
    },

    renderCreate(container) {
        const resources = ['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'];

        let offeringHTML = '';
        let requestingHTML = '';

        for (const res of resources) {
            const icon = window.getTypeIcon(res);
            const available = STATE.resources[res] || 0;

            offeringHTML += `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <span style="font-size:1.2rem;">${icon}</span>
                    <input type="number" id="offer-${res}" min="0" max="${available}" value="0" 
                           style="flex:1; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:white;">
                    <span style="color:#94a3b8; font-size:0.85rem;">(יש: ${available})</span>
                </div>
            `;

            requestingHTML += `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <span style="font-size:1.2rem;">${icon}</span>
                    <input type="number" id="request-${res}" min="0" value="0" 
                           style="flex:1; padding:8px; border-radius:6px; border:1px solid #444; background:#222; color:white;">
                </div>
            `;
        }

        container.innerHTML = `
            <div style="max-width:600px; margin:0 auto;">
                <h3 style="color:#fbbf24; margin-bottom:15px;">צור הצעת מסחר חדשה</h3>
                
                <div style="background:rgba(59,130,246,0.1); padding:15px; border-radius:12px; margin-bottom:15px;">
                    <h4 style="color:#60a5fa; margin-bottom:10px;">💼 אני מציע למכירה:</h4>
                    ${offeringHTML}
                </div>
                
                <div style="background:rgba(251,191,36,0.1); padding:15px; border-radius:12px; margin-bottom:15px;">
                    <h4 style="color:#fbbf24; margin-bottom:10px;">💰 אני מבקש בתמורה:</h4>
                    ${requestingHTML}
                </div>
                
                <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem; color:#94a3b8;">
                    ⚠️ המשאבים שאתה מציע ינעלו עד שההצעה תתקבל או תפוג (24 שעות)
                </div>
                
                <button class="btn-primary" onclick="Market.createOffer()" style="width:100%; background:linear-gradient(135deg, #3b82f6, #2563eb);">
                    ➕ פרסם הצעה
                </button>
            </div>
        `;
    },

    async renderMyTrades(container) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">טוען היסטוריה...</div>';

        try {
            const response = await fetch(`/api/market/history/${CURRENT_USER}`);
            const data = await response.json();

            if (!data.success || !data.history || data.history.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#94a3b8;">
                        <div style="font-size:3rem;">📜</div>
                        <p>אין היסטוריית מסחר</p>
                    </div>
                `;
                return;
            }

            let html = '<div style="display:grid; gap:15px;">';

            for (const trade of data.history) {
                const isActive = trade.status === 'active';
                const isSeller = trade.seller === CURRENT_USER;

                const offeringStr = Object.entries(trade.offering)
                    .filter(([res, amt]) => amt > 0)
                    .map(([res, amt]) => `${amt} ${window.getTypeIcon(res)}`)
                    .join(' + ');

                const requestingStr = Object.entries(trade.requesting)
                    .filter(([res, amt]) => amt > 0)
                    .map(([res, amt]) => `${amt} ${window.getTypeIcon(res)}`)
                    .join(' + ');

                let statusBadge = '';
                if (trade.status === 'active') statusBadge = '<span style="background:#10b981; padding:4px 8px; border-radius:4px; font-size:0.8rem;">🟢 פעיל</span>';
                else if (trade.status === 'completed') statusBadge = '<span style="background:#3b82f6; padding:4px 8px; border-radius:4px; font-size:0.8rem;">✅ הושלם</span>';
                else if (trade.status === 'cancelled') statusBadge = '<span style="background:#ef4444; padding:4px 8px; border-radius:4px; font-size:0.8rem;">❌ בוטל</span>';
                else if (trade.status === 'expired') statusBadge = '<span style="background:#64748b; padding:4px 8px; border-radius:4px; font-size:0.8rem;">⏰ פג תוקף</span>';

                const cancelButton = (isActive && isSeller) ?
                    `<button class="btn-primary" onclick="Market.cancelTrade('${trade.id}')" style="background:#ef4444; padding:8px 15px;">ביטול הצעה</button>` : '';

                html += `
                    <div style="background:linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9)); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <div>${statusBadge}</div>
                            <div style="color:#94a3b8; font-size:0.85rem;">${new Date(trade.createdAt).toLocaleDateString('he-IL')}</div>
                        </div>
                        
                        <div style="color:#cbd5e1; font-size:0.9rem; margin-bottom:10px;">
                            ${isSeller ? '📤 מכירה ל: ' : '📥 קנייה מ: '}<strong>${isSeller ? (trade.acceptedBy || 'ממתין') : trade.seller}</strong>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; margin:10px 0;">
                            <div style="flex:1; text-align:center; color:#cbd5e1;">${offeringStr}</div>
                            <div>⇄</div>
                            <div style="flex:1; text-align:center; color:#cbd5e1;">${requestingStr}</div>
                        </div>
                        
                        ${cancelButton}
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Error loading trade history:', err);
            container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">שגיאה בטעינת היסטוריה</div>';
        }
    },

    async createOffer() {
        const offering = {};
        const requesting = {};
        const resources = ['gold', 'wood', 'food', 'wine', 'marble', 'crystal', 'sulfur'];

        let hasOffering = false;
        let hasRequesting = false;

        for (const res of resources) {
            const offerInput = document.getElementById(`offer-${res}`);
            const requestInput = document.getElementById(`request-${res}`);

            const offerVal = parseInt(offerInput ? offerInput.value : 0) || 0;
            const requestVal = parseInt(requestInput ? requestInput.value : 0) || 0;

            if (offerVal > 0) {
                offering[res] = offerVal;
                hasOffering = true;
            }
            if (requestVal > 0) {
                requesting[res] = requestVal;
                hasRequesting = true;
            }
        }

        if (!hasOffering || !hasRequesting) {
            notify('עליך להציע ולבקש משהו!', 'error');
            return;
        }

        try {
            const response = await fetch('/api/market/offer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seller: CURRENT_USER,
                    offering: offering,
                    requesting: requesting
                })
            });

            const data = await response.json();

            if (data.success) {
                notify('ההצעה פורסמה בהצלחה! ✅', 'success');
                // Reload resources from server
                fetch('/api/user/' + encodeURIComponent(CURRENT_USER))
                    .then(r => r.json())
                    .then(userData => {
                        STATE.resources = userData.state.resources;
                        saveGame();
                        this.switchTab('mytrades');
                    });
            } else {
                notify(data.message || 'שגיאה ביצירת הצעה', 'error');
            }
        } catch (err) {
            console.error('Error creating offer:', err);
            notify('שגיאה בחיבור לשרת', 'error');
        }
    },

    async acceptTrade(tradeId) {
        if (!confirm('האם אתה בטוח שברצונך לקבל את ההצעה?')) return;

        try {
            const response = await fetch('/api/market/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId: tradeId,
                    buyer: CURRENT_USER
                })
            });

            const data = await response.json();

            if (data.success) {
                notify('המסחר בוצע בהצלחה! 🎉', 'success');
                // Reload resources from server
                fetch('/api/user/' + encodeURIComponent(CURRENT_USER))
                    .then(r => r.json())
                    .then(userData => {
                        STATE.resources = userData.state.resources;
                        saveGame();
                        this.switchTab('browse');
                    });
            } else {
                notify(data.message || 'שגיאה בביצוע המסחר', 'error');
            }
        } catch (err) {
            console.error('Error accepting trade:', err);
            notify('שגיאה בחיבור לשרת', 'error');
        }
    },

    async cancelTrade(tradeId) {
        if (!confirm('האם אתה בטוח שברצונך לבטל את ההצעה?')) return;

        try {
            const response = await fetch('/api/market/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId: tradeId,
                    username: CURRENT_USER
                })
            });

            const data = await response.json();

            if (data.success) {
                notify('ההצעה בוטלה והמשאבים הוחזרו', 'success');
                // Reload resources from server
                fetch('/api/user/' + encodeURIComponent(CURRENT_USER))
                    .then(r => r.json())
                    .then(userData => {
                        STATE.resources = userData.state.resources;
                        saveGame();
                        this.switchTab('mytrades');
                    });
            } else {
                notify(data.message || 'שגיאה בביטול ההצעה', 'error');
            }
        } catch (err) {
            console.error('Error cancelling trade:', err);
            notify('שגיאה בחיבור לשרת', 'error');
        }
    }
};
