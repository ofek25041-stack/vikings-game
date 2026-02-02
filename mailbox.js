window.Mailbox = {
    // Report Structure:
    // { id: uuid, type: 'attack', title: 'Victory!', timestamp: 123456, read: false, data: {...} }

    addReport: function (type, title, data) {
        if (!STATE.reports) STATE.reports = [];

        const report = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            timestamp: Date.now(),
            read: false,
            type: type, // 'attack', 'defense', 'gather', 'system'
            title: title,
            data: data
        };

        STATE.reports.unshift(report); // Add to top

        // Limit storage (keep last 50)
        if (STATE.reports.length > 50) STATE.reports.pop();

        saveGame();
        this.updateBadge();

        // Notify user visibly
        notify(`דואר חדש: ${title}`, 'success');
    },

    getUnreadCount: function () {
        return (STATE.reports || []).filter(r => !r.read).length;
    },

    updateBadge: function () {
        const count = this.getUnreadCount();
        const badge = document.getElementById('mailbox-badge');
        if (badge) {
            badge.innerText = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    markAsRead: function (reportId) {
        const report = STATE.reports.find(r => r.id === reportId);
        if (report) {
            report.read = true;
            saveGame();
            this.updateBadge();
            this.renderList(); // Re-render to show read status
        }
    },

    currentTab: 'system', // 'system' or 'chat'
    activeChatPartner: null, // For Chat View

    // UI RENDERERS
    open: function () {
        switchView('mailbox');
        this.activeChatPartner = null; // Reset
        this.renderList();
    },

    setTab: function (tab) {
        this.currentTab = tab;
        this.activeChatPartner = null;
        this.renderList();
    },

    renderList: function () {
        const list = document.getElementById('mailbox-list');
        if (!list) return;

        // Clean up any active view styling
        const contentArea = document.getElementById('mailbox-viewer');
        if (contentArea) contentArea.style.display = 'none';

        // Render Tabs
        const isSystem = this.currentTab === 'system';

        // Calculate Unread Counts
        const systemUnread = (STATE.reports || []).filter(r => !r.read && r.type !== 'chat').length;

        let chatUnread = 0;
        if (STATE.chats) {
            // Simple logic: If we haven't opened this chat locally? 
            // For now, let's just count total messages that are NOT from me? 
            // We need a proper 'read' flag on messages or conversation.
            // Since we don't have that yet, let's assume all are read if we are in the view?
            // User requested "Notification". 
            // Let's rely on a strictly local "lastChecked" for now or just generic "New".
            // Implementation: We will count messages that are newer than 'lastChatCheck'
        }

        list.innerHTML = `
            <div class="mailbox-tabs" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <button class="btn-tab ${isSystem ? 'active' : ''}" onclick="Mailbox.setTab('system')" style="flex:1; background:${isSystem ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; position:relative;">
                    📢 מערכת
                    ${systemUnread > 0 ? `<span class="badge">${systemUnread}</span>` : ''}
                </button>
                <button class="btn-tab ${!isSystem ? 'active' : ''}" onclick="Mailbox.setTab('chat')" style="flex:1; background:${!isSystem ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}; position:relative;">
                    💬 צ'אטים
                    <span id="chat-badge" class="badge" style="display:none">●</span>
                </button>
            </div>
            ${isSystem ? `
            <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px;">
                <button class="btn-primary" style="width:100%" onclick="Mailbox.openTradeUI()">➕ צור הצעת מסחר</button>
            </div>` : ''}
        `;

        // Check for new chats to show badge
        this.updateChatBadge();

        if (this.currentTab === 'system') {
            this.renderSystemMessages(list);
        } else {
            this.renderChatList(list);
        }
    },

    updateChatBadge: function () {
        // Logic: Check if there's any message timestamp > lastReadTimestamp
        // We need to store lastRead in localStorage or STATE
        const lastRead = parseInt(localStorage.getItem('vikings_chat_last_read') || '0');
        let hasNew = false;

        if (STATE.chats) {
            Object.values(STATE.chats).forEach(history => {
                if (history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    if (lastMsg && lastMsg.timestamp && lastMsg.timestamp > lastRead && lastMsg.from !== CURRENT_USER) {
                        hasNew = true;
                    }
                }
            });
        }

        const badge = document.getElementById('chat-badge');
        if (badge) badge.style.display = hasNew ? 'inline-flex' : 'none';
    },

    setTab: function (tab) {
        this.currentTab = tab;
        this.activeChatPartner = null;
        if (tab === 'chat') {
            // Update read timestamp when opening tab
            localStorage.setItem('vikings_chat_last_read', Date.now().toString());
            this.updateChatBadge();
        }
        this.renderList();
    },

    renderSystemMessages: function (container) {
        if (!STATE.reports || STATE.reports.length === 0) {
            container.innerHTML += '<div class="empty-state">אין הודעות מערכת</div>';
            return;
        }

        // Filter system messages
        const filtered = STATE.reports.filter(r => r.type !== 'chat');

        if (filtered.length === 0) {
            container.innerHTML += `<div class="empty-state">אין הודעות מערכת</div>`;
            return;
        }

        filtered.forEach(report => {
            const item = document.createElement('div');
            item.className = `mail-item ${report.read ? 'read' : 'unread'} type-${report.type}`;
            item.onclick = () => this.showDetail(report);

            item.innerHTML = `
                <div class="mail-icon">${this.getIcon(report.type)}</div>
                <div class="mail-info">
                    <div class="mail-title">${report.title}</div>
                    <div class="mail-time">${new Date(report.timestamp).toLocaleString()}</div>
                </div>
            `;
            container.appendChild(item);
        });
    },

    renderChatList: function (container) {
        // STATE.chats structure: { "PartnerName": [ {msg}, {msg} ] }
        const chats = STATE.chats || {};
        const partners = Object.keys(chats);

        if (partners.length === 0) {
            container.innerHTML += '<div class="empty-state">אין שיחות פעילות<br><br>שלח הודעה לשחקן דרך המפה כדי להתחיל!</div>';
            return;
        }

        // Sort by last message timestamp
        partners.sort((a, b) => {
            const chatA = chats[a] || [];
            const chatB = chats[b] || [];

            // Get last valid message or fallback to now
            const lastMsgA = chatA.length > 0 ? chatA[chatA.length - 1] : null;
            const lastMsgB = chatB.length > 0 ? chatB[chatB.length - 1] : null;

            const lastA = (lastMsgA && lastMsgA.timestamp) || Date.now();
            const lastB = (lastMsgB && lastMsgB.timestamp) || Date.now();

            return lastB - lastA;
        });

        partners.forEach(partner => {
            const history = chats[partner];
            if (!history) return;

            // Handle empty history (newly started chat)
            const lastMsg = history.length > 0
                ? history[history.length - 1]
                : { content: '<em>שיחה חדשה</em>', timestamp: Date.now() };

            const item = document.createElement('div');
            item.className = `mail-item chat-item`;
            item.onclick = () => this.openChat(partner);

            item.innerHTML = `
                <div class="mail-icon" style="background:#8b5cf6; border-color:#d8b4fe">👤</div>
                <div class="mail-info">
                    <div class="mail-title" style="color:#e9d5ff">${partner}</div>
                    <div class="mail-preview" style="color:#94a3b8; font-size:0.9em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${lastMsg.content}</div>
                </div>
                <div class="mail-time" style="font-size:0.8em; color:#64748b">${new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            container.appendChild(item);
        });
    },

    openChat: function (partner) {
        this.activeChatPartner = partner;
        const viewer = document.getElementById('mailbox-viewer');
        const content = document.getElementById('mailbox-content');
        const list = document.getElementById('mailbox-list');

        if (viewer && content) {
            viewer.style.display = 'flex';
            // Hide the list to show only the chat
            if (list) list.style.display = 'none';

            // Custom Chat UI rendering
            content.innerHTML = this.renderChatInterface(partner);

            // Scroll to bottom
            const messagesDiv = document.getElementById('chat-messages');
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    },

    renderChatInterface: function (partner) {
        const history = (STATE.chats && STATE.chats[partner]) || [];

        let html = `
            <div class="chat-container">
                <div class="chat-header">
                    <h3>${partner}</h3>
                    <button class="btn-secondary" style="padding: 2px 8px; font-size: 0.8em;" onclick="Mailbox.closeDetail()">סגור שיחה ❌</button>
                </div>
                
                <div id="chat-messages" class="chat-messages">
        `;

        // Filter out any invalid messages
        history.filter(msg => msg && msg.content).forEach(msg => {
            const isMe = msg.from === CURRENT_USER;
            const timestamp = msg.timestamp || Date.now();
            html += `
                <div class="chat-bubble ${isMe ? 'me' : 'them'}">
                    <div class="chat-text">${msg.content}</div>
                    <div class="chat-meta">
                        ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div class="chat-input-area">
                    <textarea id="chat-input" rows="1" placeholder="כתוב הודעה..."></textarea>
                    <button class="chat-send-btn" onclick="Mailbox.sendChatMessage('${partner}')">🚀</button>
                </div>
            </div>
        `;
        return html;
    },

    sendChatMessage: async function (partner) {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content) return;

        input.value = ''; // Clear early

        // Optimistic UI Update
        if (!STATE.chats) STATE.chats = {};
        if (!STATE.chats[partner]) STATE.chats[partner] = [];

        const tempMsg = {
            id: 'temp_' + Date.now(),
            from: CURRENT_USER,
            to: partner,
            content: content,
            timestamp: Date.now()
        };

        STATE.chats[partner].push(tempMsg);
        this.openChat(partner); // Re-render to show new message

        // Send to Server
        const result = await this.sendMessage(partner, 'Chat', content);
        if (!result.success) {
            notify("שגיאה בשליחת ההודעה", "error");
        } else {
            // Update with real message if needed or just keep going
            // Ideally we'd replace the temp message but for now it's fine
            saveGame(); // Save local state with history
        }
    },

    sendMessage: async function (toUser, subject, content) {
        try {
            const response = await fetch('/api/message/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: toUser,
                    subject: subject,
                    content: content,
                    from: CURRENT_USER
                })
            });
            return await response.json();
        } catch (err) {
            console.error(err);
            return { success: false, message: 'שגיאה ברשת' };
        }
    },

    showDetail: function (report) {
        this.markAsRead(report.id);

        const viewer = document.getElementById('mailbox-viewer');
        const content = document.getElementById('mailbox-content');
        const list = document.getElementById('mailbox-list');

        if (viewer && content) {
            viewer.style.display = 'flex';
            // Hide the list to show only the report
            if (list) list.style.display = 'none';

            let html = this.formatReportData(report);
            content.innerHTML = html;
        }
    },

    // Legacy reply - now just opens chat
    replyTo: function (to, subject) {
        this.closeDetail();
        this.setTab('chat');
        // Initialize chat if empty
        if (!STATE.chats) STATE.chats = {};
        if (!STATE.chats[to]) STATE.chats[to] = [];
        this.openChat(to);
    },

    closeDetail: function () {
        const viewer = document.getElementById('mailbox-viewer');
        const list = document.getElementById('mailbox-list');

        if (viewer) viewer.style.display = 'none';
        // Show the list again when closing
        if (list) list.style.display = 'block';

        this.activeChatPartner = null;
    },

    getIcon: function (type) {
        switch (type) {
            case 'attack': return '⚔️';
            case 'defense': return '🛡️';
            case 'gather': return '🌾';
            case 'system': return '📢';
            case 'clan_invite': return '📩';
            case 'chat': return '💬';
            default: return '📩';
        }
    },

    formatReportData: function (report) {
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h2 style="margin: 0;">${report.title}</h2>
                <button class="btn-secondary" style="background: #ef4444; padding: 8px 16px;" onclick="Mailbox.closeDetail()">✕ סגור</button>
            </div>
        `;
        html += `<div class="meta">${new Date(report.timestamp).toLocaleString()}</div>`;
        if (report.from) html += `<div class="meta" style="color:#a78bfa">מאת: ${report.from}</div>`;
        html += `<hr>`;

        // Chat in system tab? Should not happen often but handle legacy
        if (report.type === 'chat') {
            html += `<div style="white-space: pre-wrap; font-size:1.1rem; line-height:1.5;">${report.content}</div>`;
            html += `
                <div style="margin-top:20px; text-align:center;">
                    <button class="btn-primary" onclick="Mailbox.replyTo('${report.from}', '')">עבור לצ'אט מלא</button>
                </div>
            `;
            return html;
        }

        // If report has pre-formatted content (from server), use it directly
        if (report.content) {
            html += report.content;
            return html;
        }

        // ... legacy formatters ...
        // Otherwise, format based on type and data (legacy/local reports)
        if (report.type === 'gather') {
            html += `<h3>משאבים שנאספו:</h3>`;
            html += `<ul class="res-list">`;
            for (const [res, amount] of Object.entries(report.data.loot || {})) {
                if (amount > 0) html += `<li>${this.getResourceName(res)}: <b>${amount}</b></li>`;
            }
            html += `</ul>`;
        } else if (report.type === 'attack') {
            // Enhanced battle report with visual cards - MOBILE OPTIMIZED
            const isVictory = report.data.winner;
            const enemy = report.data.enemy || 'Unknown';
            const enemyLevel = report.data.enemyLevel || 1;
            const defenderArmy = report.data.defenderArmy || {};
            const defenderPower = report.data.defenderPower || 0;
            const loot = report.data.loot || {};
            const lost = report.data.unitsLost || {};
            const returned = report.data.unitsReturned || {};

            // Calculate totals
            let totalLoot = 0;
            Object.values(loot).forEach(v => totalLoot += v);

            let totalLost = 0;
            Object.values(lost).forEach(v => totalLost += v);

            let totalReturned = 0;
            Object.values(returned).forEach(v => totalReturned += v);

            let totalDefenders = 0;
            Object.values(defenderArmy).forEach(v => totalDefenders += v);

            html += `
                <style>
                    @media (max-width: 600px) {
                        .battle-grid-3 { grid-template-columns: 1fr !important; }
                        .battle-grid-2 { grid-template-columns: 1fr !important; }
                    }
                </style>
                
                <div style="text-align: center; padding: 12px; background: rgba(${isVictory ? '34,197,94' : '239,68,68'}, 0.1); border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 2.5rem; margin-bottom: 5px;">${isVictory ? '🎉' : '💀'}</div>
                    <h3 style="color: ${isVictory ? '#22c55e' : '#ef4444'}; margin: 5px 0; font-size: 1.1rem;">
                        ${isVictory ? 'ניצחון!' : 'תבוסה'}
                    </h3>
                    <p style="color: #cbd5e1; font-size: 0.9rem; margin: 0;">נגד ${enemy}</p>
                </div>
                
                <!-- Defender Info -->
                <div style="background: rgba(168,85,247,0.1); padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid rgba(168,85,247,0.2);">
                    <h4 style="color: #a855f7; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                        <span style="font-size: 1.1rem;">🛡️</span> מידע על היעד
                    </h4>
                    <div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                            <div style="color: #a855f7; font-size: 1.2rem; font-weight: bold;">${enemyLevel}</div>
                            <div style="color: #94a3b8; font-size: 0.7rem;">רמה</div>
                        </div>
                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                            <div style="color: #a855f7; font-size: 1.2rem; font-weight: bold;">${totalDefenders}</div>
                            <div style="color: #94a3b8; font-size: 0.7rem;">מגנים</div>
                        </div>
                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                            <div style="color: #a855f7; font-size: 1.2rem; font-weight: bold;">${defenderPower}</div>
                            <div style="color: #94a3b8; font-size: 0.7rem;">כוח</div>
                        </div>
                    </div>
            `;

            // Show defender army composition if exists
            if (totalDefenders > 0) {
                html += `
                    <div style="margin-top: 8px;">
                        <div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                `;
                for (const [unit, amount] of Object.entries(defenderArmy)) {
                    if (amount > 0) {
                        const unitIcon = unit === 'spearman' ? '🔱' : unit === 'archer' ? '🏹' : '⚔️';
                        html += `
                            <div style="background: rgba(168,85,247,0.1); padding: 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.75rem;">
                                <span style="font-size: 1rem;">${unitIcon}</span>
                                <div style="color: #cbd5e1;">${amount}</div>
                            </div>
                        `;
                    }
                }
                html += `
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="text-align: center; margin-top: 8px; padding: 8px; background: rgba(34,197,94,0.1); border-radius: 6px;">
                        <div style="color: #22c55e; font-size: 0.8rem;">🎯 ללא הגנה!</div>
                    </div>
                `;
            }

            html += `</div>
                
                <!-- Summary Cards -->
                <div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                    <div style="background: rgba(251,191,36,0.1); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid rgba(251,191,36,0.3);">
                        <div style="font-size: 1.5rem;">💰</div>
                        <div style="color: #fbbf24; font-size: 1.1rem; font-weight: bold;">${totalLoot.toLocaleString()}</div>
                        <div style="color: #94a3b8; font-size: 0.7rem;">שלל</div>
                    </div>
                    <div style="background: rgba(239,68,68,0.1); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid rgba(239,68,68,0.3);">
                        <div style="font-size: 1.5rem;">⚔️</div>
                        <div style="color: #ef4444; font-size: 1.1rem; font-weight: bold;">${totalLost}</div>
                        <div style="color: #94a3b8; font-size: 0.7rem;">אבדות</div>
                    </div>
                    <div style="background: rgba(34,197,94,0.1); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid rgba(34,197,94,0.3);">
                        <div style="font-size: 1.5rem;">🏃</div>
                        <div style="color: #22c55e; font-size: 1.1rem; font-weight: bold;">${totalReturned}</div>
                        <div style="color: #94a3b8; font-size: 0.7rem;">חזרו</div>
                    </div>
                </div>
            `;

            // Loot section
            if (totalLoot > 0) {
                html += `
                    <div style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(16,185,129,0.2);">
                        <h4 style="color: #10b981; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                            <span style="font-size: 1.1rem;">💰</span> שלל
                        </h4>
                        <div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                `;

                for (const [res, amount] of Object.entries(loot)) {
                    if (amount > 0) {
                        const icon = res === 'gold' ? '💰' : res === 'wood' ? '🌲' : '📦';
                        html += `
                            <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                                <span style="font-size: 1.2rem;">${icon}</span>
                                <div style="color: #10b981; font-size: 1rem; font-weight: bold; margin-top: 4px;">${amount.toLocaleString()}</div>
                                <div style="color: #94a3b8; font-size: 0.65rem;">${this.getResourceName(res)}</div>
                            </div>
                        `;
                    }
                }
                html += `
                        </div>
                    </div>
                `;
            }

            // Casualties section
            html += `
                <div style="background: rgba(239,68,68,0.1); padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(239,68,68,0.2);">
                    <h4 style="color: #ef4444; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                        <span style="font-size: 1.1rem;">💀</span> אבדות
                    </h4>
            `;

            if (totalLost > 0) {
                html += `<div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">`;
                for (const [unit, amount] of Object.entries(lost)) {
                    if (amount > 0) {
                        const unitIcon = unit === 'spearman' ? '🔱' : unit === 'archer' ? '🏹' : '⚔️';
                        const unitName = window.UNIT_TYPES?.[unit]?.name || unit;
                        html += `
                            <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                                <span style="font-size: 1.2rem;">${unitIcon}</span>
                                <div style="color: #ef4444; font-size: 1rem; font-weight: bold; margin-top: 4px;">${amount}</div>
                                <div style="color: #94a3b8; font-size: 0.65rem;">${unitName}</div>
                            </div>
                        `;
                    }
                }
                html += `</div>`;
            } else {
                html += `
                    <div style="text-align: center; padding: 12px; background: rgba(34,197,94,0.1); border-radius: 6px;">
                        <div style="font-size: 1.5rem; margin-bottom: 5px;">🎊</div>
                        <div style="color: #22c55e; font-size: 0.85rem; font-weight: bold;">ניצחון ללא אבדות!</div>
                    </div>
                `;
            }
            html += `</div>`;

            // Returning units section
            if (totalReturned > 0) {
                html += `
                    <div style="background: rgba(59,130,246,0.1); padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(59,130,246,0.2);">
                        <h4 style="color: #3b82f6; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                            <span style="font-size: 1.1rem;">🏃</span> חזרו
                        </h4>
                        <div class="battle-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                `;
                for (const [unit, amount] of Object.entries(returned)) {
                    if (amount > 0) {
                        const unitIcon = unit === 'spearman' ? '🔱' : unit === 'archer' ? '🏹' : '⚔️';
                        const unitName = window.UNIT_TYPES?.[unit]?.name || unit;
                        html += `
                            <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; text-align: center;">
                                <span style="font-size: 1.2rem;">${unitIcon}</span>
                                <div style="color: #3b82f6; font-size: 1rem; font-weight: bold; margin-top: 4px;">${amount}</div>
                                <div style="color: #94a3b8; font-size: 0.65rem;">${unitName}</div>
                            </div>
                        `;
                    }
                }
                html += `
                        </div>
                    </div>
                `;
            }
        } else if (report.type === 'trade') {
            html += `< h3 > הצעת מסחר</h3 > `;
            html += `< div style = "display:flex; justify-content:space-between; margin-bottom:20px;" >
                        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; width:45%;">
                            <h4 style="color:#ef4444">אתה נותן:</h4>
                            <ul class="res-list">
                                ${this.formatResourceList(report.data.give)}
                            </ul>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; width:45%;">
                            <h4 style="color:#22c55e">אתה מקבל:</h4>
                            <ul class="res-list">
                                ${this.formatResourceList(report.data.get)}
                            </ul>
                        </div>
                    </div > `;
            if (!report.data.accepted) {
                // Determine if I am the sender or receiver
                // For now, let's assume this is a report of a SENT offer or RECEIVED offer
                // If I am the receiver (implementation detail for future P2P), allow accept.
                // Since this is a local prototype, let's treat it as a "Posted Offer Report".
                html += `< p style = "color:#94a3b8; text-align:center;" > ההצעה פורסמה בשוק.</p > `;
            }
        } else if (report.type === 'clan_invite') {
            // Clan invitation
            html += `< div style = "text-align:center; padding:20px;" >
                        <div style="font-size:3rem; margin-bottom:15px;">🏰</div>
                        <h3 style="color:#fbbf24;">${report.data.from} מזמין אותך!</h3>
                        <p>להצטרף לקלאן <strong>[${report.data.clanTag}] ${report.data.clanName}</strong></p>
                        <div style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
                            <button class="btn-primary" style="background: linear-gradient(135deg, #22c55e, #16a34a);" 
                                    onclick="ClanSystem.joinClan('${report.data.clanId}'); Mailbox.closeDetail();">
                                ✅ קבל הזמנה
                            </button>
                            <button class="btn-secondary" onclick="Mailbox.closeDetail()">
                                ❌ דחה
                            </button>
                        </div>
                    </div > `;
        }

        return html;
    },

    getResourceName: function (key) {
        const map = { gold: 'זהב', wood: 'עץ', wine: 'יין', marble: 'שיש', crystal: 'קריסטל', sulfur: 'גופרית' };
        return map[key] || key;
    },

    formatResourceList: function (resources) {
        if (!resources) return '<li>אין</li>';
        let html = '';
        for (const [res, amount] of Object.entries(resources)) {
            if (amount > 0) html += `< li > ${this.getResourceName(res)}: <b>${amount}</b></li > `;
        }
        return html || '<li>אין</li>';
    },

    // --- TRADE SYSTEM ---
    openTradeUI: function () {
        // Replace list with Trade UI
        const list = document.getElementById('mailbox-list');
        list.innerHTML = `
                < div class="trade-ui" >
                <h3>צור הצעת מסחר חדשה</h3>
                
                <div class="trade-section">
                    <h4>מה אתה נותן?</h4>
                    <div class="resource-inputs" id="trade-give-inputs">
                        ${this.renderResourceInputs('give')}
                    </div>
                </div>

                <div class="trade-section">
                    <h4>מה אתה מבקש?</h4>
                    <div class="resource-inputs" id="trade-get-inputs">
                        ${this.renderResourceInputs('get')}
                    </div>
                </div>

                <div class="trade-actions" style="margin-top:20px; text-align:center;">
                    <button class="btn-primary" onclick="Mailbox.submitTrade()">פרסם הצעה</button>
                    <button class="btn-secondary" onclick="Mailbox.renderList()">ביטול</button>
                </div>
            </div >
                `;
    },

    renderResourceInputs: function (prefix) {
        const resources = ['gold', 'wood', 'wine', 'marble', 'crystal', 'sulfur'];
        let html = '';
        resources.forEach(res => {
            html += `
                < div class="res-input-group" >
                    <span class="res-icon">${getIcon(res)}</span>
                    <input type="number" id="${prefix}-${res}" placeholder="0" min="0" class="trade-input">
                </div>
            `;
        });
        return html;
    },

    submitTrade: function () {
        const give = {}, get = {};
        let hasGive = false, hasGet = false;

        ['gold', 'wood', 'wine', 'marble', 'crystal', 'sulfur'].forEach(res => {
            const giveVal = parseInt(document.getElementById(`give - ${res} `).value) || 0;
            const getVal = parseInt(document.getElementById(`get - ${res} `).value) || 0;

            if (giveVal > 0) { give[res] = giveVal; hasGive = true; }
            if (getVal > 0) { get[res] = getVal; hasGet = true; }
        });

        if (!hasGive || !hasGet) {
            notify("עליך לבחור לפחות משאב אחד לתת ואחד לקבל!", "error");
            return;
        }

        // Verify user has resources
        for (const [res, amount] of Object.entries(give)) {
            if (STATE.resources[res] < amount) {
                notify(`אין לך מספיק ${this.getResourceName(res)} !`, "error");
                return;
            }
        }

        // Deduct resources immediately (Market Escrow)
        for (const [res, amount] of Object.entries(give)) {
            STATE.resources[res] -= amount;
        }
        updateUI();

        // Add Report/Message
        this.addReport('trade', 'הצעת מסחר נשלחה', { give, get, accepted: false });

        notify("ההצעה פורסמה בהצלחה!", "success");
        this.renderList(); // Return to list
    }
};
