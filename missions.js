window.Missions = {
    // Mission State Structure (stored in STATE.missions)
    // {
    //    daily: [{id, type, target, current, reward, claimed}],
    //    weekly: [...],
    //    lastLogin: mismatch check for reset
    // }

    init: function () {
        if (!STATE.missions) {
            STATE.missions = {
                daily: [],
                weekly: [],
                lastDailyReset: 0,
                lastWeeklyReset: 0
            };
        }

        this.checkResets();
    },

    checkResets: function () {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;

        // Daily Reset
        if (now - STATE.missions.lastDailyReset > oneDay) {
            this.generateDailyMissions();
            STATE.missions.lastDailyReset = now;
            notify("משימות יומיות חדשות זמינות!", "success");
        }

        // Weekly Reset
        if (now - STATE.missions.lastWeeklyReset > oneWeek) {
            this.generateWeeklyMissions();
            STATE.missions.lastWeeklyReset = now;
            notify("משימות שבועיות חדשות זמינות!", "success_major");
        }
    },

    generateDailyMissions: function () {
        const missions = [];
        // Pool of possible daily tasks
        const types = [
            { type: 'gather', label: 'אסוף משאבים', min: 100, max: 500, rewardBase: 50 },
            { type: 'train', label: 'אמן חיילים', min: 5, max: 20, rewardBase: 100 },
            { type: 'build', label: 'שדרג מבנים', min: 1, max: 3, rewardBase: 200 }
        ];

        for (let i = 0; i < 3; i++) {
            const t = types[Math.floor(Math.random() * types.length)];
            const target = Math.floor(Math.random() * (t.max - t.min + 1)) + t.min;
            missions.push({
                id: 'd_' + Date.now() + '_' + i,
                title: `${t.label} (${target})`,
                type: t.type,
                target: target,
                current: 0,
                reward: { gold: target * 2, wood: target }, // Simple reward logic
                claimed: false
            });
        }
        STATE.missions.daily = missions;
        saveGame();
    },

    generateWeeklyMissions: function () {
        const missions = [];
        const types = [
            { type: 'attack', label: 'תקוף אויבים', min: 5, max: 10, rewardBase: 1000 },
            { type: 'gather', label: 'אסוף כמות גדולה', min: 5000, max: 20000, rewardBase: 500 }
        ];

        for (let i = 0; i < 2; i++) {
            const t = types[Math.floor(Math.random() * types.length)];
            const target = Math.floor(Math.random() * (t.max - t.min + 1)) + t.min;
            missions.push({
                id: 'w_' + Date.now() + '_' + i,
                title: `אתגר שבועי: ${t.label} (${target})`,
                type: t.type,
                target: target,
                current: 0,
                reward: { gold: target * 3, wine: Math.floor(target / 10) },
                claimed: false
            });
        }
        STATE.missions.weekly = missions;
        saveGame();
    },

    // Triggered by Game Events
    onEvent: function (type, amount) {
        if (!STATE.missions) return;
        let changed = false;

        // Check both lists
        ['daily', 'weekly'].forEach(category => {
            STATE.missions[category].forEach(m => {
                if (m.type === type && !m.claimed && m.current < m.target) {
                    m.current += amount;
                    if (m.current > m.target) m.current = m.target;
                    changed = true;

                    if (m.current === m.target) {
                        notify(`משימה הושלמה: ${m.title}!`, "success");
                    }
                }
            });
        });

        if (changed) saveGame();
    },

    claimReward: function (category, index) {
        const m = STATE.missions[category][index];
        if (m.current >= m.target && !m.claimed) {
            m.claimed = true;
            // Add rewards
            for (const [res, amount] of Object.entries(m.reward)) {
                STATE.resources[res] += amount;
            }
            updateUI();
            saveGame();
            notify("פרס נאסף בהצלחה!", "success");
            this.renderUI(); // Re-render if open
        }
    },

    // UI Rendering
    openUI: function () {
        this.checkResets(); // Ensure up to date
        switchView('missions'); // Need to create this view support
        this.renderUI();
    },

    renderUI: function () {
        const container = document.getElementById('missions-list');
        if (!container) return;

        let html = '';

        // Daily
        html += `<h2>📅 משימות יומיות</h2>`;
        html += this.renderList(STATE.missions.daily, 'daily');

        // Weekly
        html += `<h2>🏆 משימות שבועיות</h2>`;
        html += this.renderList(STATE.missions.weekly, 'weekly');

        container.innerHTML = html;
    },

    renderList: function (list, category) {
        if (!list || list.length === 0) return '<p>אין משימות פעילות.</p>';

        return list.map((m, idx) => {
            const progress = Math.min(100, (m.current / m.target) * 100);
            const isComplete = m.current >= m.target;
            const btnState = m.claimed ? 'disabled' : (isComplete ? '' : 'disabled');
            const btnText = m.claimed ? 'נאסף ✅' : (isComplete ? 'קבל פרס 🎁' : 'בתהליך...');
            const clickAction = isComplete && !m.claimed ? `Missions.claimReward('${category}', ${idx})` : '';

            // Format Rewards
            let rewardHtml = '';
            const rewardIcons = { gold: '💰', wood: '🌲', wine: '🍷', marble: '🏛️', crystal: '💎', sulfur: '🔥' };
            for (const [res, amount] of Object.entries(m.reward)) {
                if (amount > 0) rewardHtml += `<span class="reward-tag">${rewardIcons[res] || ''} ${amount}</span> `;
            }

            return `
            <div class="mission-card ${isComplete ? 'complete' : ''}">
                <div class="mission-info">
                    <div class="mission-title">${m.title}</div>
                    <div class="mission-bar-bg">
                        <div class="mission-bar-fill" style="width:${progress}%"></div>
                    </div>
                    <div class="mission-stats">
                        <span>${m.current} / ${m.target}</span>
                        <div class="mission-rewards">פרס: ${rewardHtml}</div>
                    </div>
                </div>
                <button class="mission-btn ${btnState}" onclick="${clickAction}">${btnText}</button>
            </div>
            `;
        }).join('');
    }
};
