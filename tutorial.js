window.Tutorial = {
    state: {
        active: false,
        step: 0,
        completed: false
    },

    steps: [
        {
            id: 'intro',
            text: "ברוך הבא! המטרה שלך: לבנות אימפריה.\nבוא נתחיל בבניית מנסרה להשגת עצים.",
            target: null, // Dialog only
            action: 'next'
        },
        {
            id: 'build_lumber',
            text: "לחץ על השטח הריק ובחר 'מנסרה' (Lumber Mill).",
            target: '.spot-lumber',
            trigger: (state) => state.buildings?.lumber?.level > 0
        },
        {
            id: 'build_mine',
            text: "מצוין! עצים הם חשובים, אבל כדי לגדול אנחנו צריכים גם אבן וזהב.\nלחץ על ההר ובנה 'מכרה' (Mine).",
            target: '.spot-mine',
            trigger: (state) => state.buildings?.mine?.level > 0
        },
        {
            id: 'explain_resources',
            text: "עבודה יפה! המשאבים זורמים.\nכדי להאיץ את התהליך, נוכל לשלוח משלחות איסוף.\nלחץ על כפתור 'מפה' (World) בתפריט התחתון.",
            target: 'button[onclick="switchView(\'world\')"]',
            trigger: () => document.getElementById('world-map-grid') !== null
        },
        {
            id: 'find_forest',
            text: "זוהי מפת העולם. כאן תוכל למצוא יערות, מכרות וכפרים אחרים.\nחפש יער (משבצת ירוקה כהה) ולחץ עליה.",
            target: '.tile-forest', // Heuristic highlight
            trigger: () => document.getElementById('modal-overlay') && !document.getElementById('modal-overlay').classList.contains('hidden')
        },
        {
            id: 'send_gather',
            text: "בחלון שנפתח, בחר את החיילים שלך ולחץ 'שלח משלחת כרייה'.",
            target: '.btn-primary', // Heuristic
            trigger: (state) => state.timers.some(t => t.subtype === 'gather')
        },
        {
            id: 'return_city',
            text: "המשלחת יצאה! היא תחזור עם שלל בקרוב.\nבינתיים, בוא נחזור לעיר. לחץ על 'העיר שלי'.",
            target: 'button[onclick="switchView(\'city\')"]',
            trigger: () => document.getElementById('template-city') && !document.getElementById('world-map-grid')
        },
        {
            id: 'build_barracks',
            text: "העולם מסוכן. אנחנו צריכים צבא חזק.\nבנה את ה'בסיס הצבאי' (Barracks).",
            target: '.slot-barracks',
            trigger: (state) => state.buildings?.barracks?.level > 0
        },
        {
            id: 'open_barracks',
            text: "עכשיו כשיש לנו בסיס, בוא נאמן חיילים.\nלחץ על הבסיס הצבאי שבנית.",
            target: '.slot-barracks',
            trigger: () => document.querySelector('.barracks-view') !== null
        },
        {
            id: 'train_soldier',
            text: "חיילים עולים כסף ועצים.\nבחר כמות וגייס לפחות חייל אחד.",
            target: '.unit-action button',
            trigger: (state) => state.timers.some(t => t.type === 'unit')
        },
        {
            id: 'upgrade_hall',
            text: "מעולה! הצבא בדרך.\nלסיום, כדי לפתוח מבנים חדשים, עליך לשדרג את בית העירייה.\nלחץ על 'Town Hall' ושדרג אותו.",
            target: '.slot-town-hall',
            trigger: (state) => state.buildings?.townHall?.level > 1
        },
        {
            id: 'complete',
            text: "אתה מוכן, יארל!\nהמשך לבנות, לחקור ולהילחם. גורל הממלכה בידיך!",
            target: null,
            action: 'complete'
        }
    ],

    init: function () {
        // Load state from local storage if exists
        const saved = localStorage.getItem('vikings_tutorial');
        if (saved) {
            this.state = JSON.parse(saved);
        } else {
            // New user? Start tutorial
            this.start();
        }

        this.renderOverlay();
        this.checkStep();
    },

    start: function () {
        this.state.active = true;
        this.state.step = 0;
        this.save();
        this.showStep();
    },

    save: function () {
        localStorage.setItem('vikings_tutorial', JSON.stringify(this.state));
    },

    next: function () {
        if (this.state.completed) return;

        this.state.step++;
        if (this.state.step >= this.steps.length) {
            this.complete();
        } else {
            this.save();
            this.showStep();
        }
    },

    complete: function () {
        this.state.active = false;
        this.state.completed = true;
        this.save();
        this.hideOverlay();
        // Slightly delayed notification so it doesn't clash with click
        setTimeout(() => notify("המדריך הושלם! בהצלחה!", "success"), 500);
    },

    showStep: function () {
        const step = this.steps[this.state.step];
        if (!step) return;

        console.log("Tutorial Step:", step.id);

        // Show Dialog
        this.updateDialog(step.text);

        // Highlight Target
        this.clearHighlight();
        if (step.target) {
            this.highlight(step.target);
        }
    },

    highlight: function (selector) {
        const el = document.querySelector(selector);
        if (el) {
            el.classList.add('tutorial-highlight');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    clearHighlight: function () {
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    },

    updateDialog: function (text) {
        const dialog = document.getElementById('tutorial-dialog');
        const textEl = document.getElementById('tutorial-text');
        const nextBtn = document.getElementById('tutorial-next-btn');

        if (dialog && textEl) {
            dialog.style.display = 'flex';
            textEl.innerText = text;

            // Show/Hide "Next" button based on step type
            // If the step waits for a trigger (user action), hide the manual Next button
            const step = this.steps[this.state.step];
            if (step.trigger) {
                nextBtn.style.display = 'none';
                // Start checking for trigger
                this.startTriggerCheck(step.trigger);
            } else {
                nextBtn.style.display = 'block';
                this.stopTriggerCheck();
            }
        }
    },

    hideOverlay: function () {
        const dialog = document.getElementById('tutorial-dialog');
        if (dialog) dialog.style.display = 'none';
        this.clearHighlight();
    },

    renderOverlay: function () {
        if (document.getElementById('tutorial-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.innerHTML = `
            <div id="tutorial-dialog" style="display:none;">
                <div class="npc-portrait">🧙‍♂️</div>
                <div class="dialog-content">
                    <p id="tutorial-text">...</p>
                    <div class="tutorial-actions">
                        <button id="tutorial-skip-btn" onclick="Tutorial.skip()">דלג על המדריך</button>
                        <button id="tutorial-next-btn" onclick="Tutorial.next()">המשך</button>
                    </div>
                </div>
            </div>
            <style>
                .tutorial-highlight {
                    z-index: 1000 !important;
                    position: relative;
                    box-shadow: 0 0 0 9999px rgba(0,0,0,0.7) !important; /* Dim background */
                    border: 2px solid #fbbf24;
                    cursor: pointer; /* Encourage clicking */
                    animation: pulseborder 1.5s infinite;
                }
                @keyframes pulseborder {
                    0% { border-color: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
                    50% { border-color: #fff; box-shadow: 0 0 20px #fff; }
                    100% { border-color: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
                }

                #tutorial-dialog {
                    position: fixed;
                    top: 80px; /* Move to top to avoid blocking bottom nav/grid */
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 500px;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid #fbbf24;
                    border-radius: 12px;
                    padding: 15px;
                    display: flex;
                    align-items: flex-start;
                    gap: 15px;
                    z-index: 2000; /* Higher than waiting overlay */
                    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                    direction: rtl;
                    pointer-events: auto; /* Ensure clickable */
                }
                .npc-portrait {
                    font-size: 2.5rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 50%;
                    padding: 5px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .dialog-content {
                    flex: 1;
                    display: flex;
                    flex-col: column;
                }
                #tutorial-text {
                    color: #fff;
                    margin: 0 0 10px 0;
                    line-height: 1.4;
                    font-size: 1rem;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                }
                .tutorial-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 5px;
                }
                #tutorial-next-btn {
                    background: #fbbf24;
                    color: #000;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-family: inherit;
                    transition: transform 0.1s;
                }
                #tutorial-next-btn:active { transform: scale(0.95); }
                
                #tutorial-skip-btn {
                    background: transparent;
                    color: #94a3b8;
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                #tutorial-skip-btn:hover {
                    color: #fff;
                    border-color: #fff;
                }
            </style>
        `;
        document.body.appendChild(overlay);
    },

    // Trigger System
    triggerInterval: null,
    startTriggerCheck: function (predicate) {
        if (this.triggerInterval) clearInterval(this.triggerInterval);
        this.triggerInterval = setInterval(() => {
            // We need to access STATE from main.js, ensure it's available
            if (typeof STATE !== 'undefined' && predicate(STATE)) {
                this.stopTriggerCheck();
                this.next();
            }
        }, 1000);
    },
    stopTriggerCheck: function () {
        if (this.triggerInterval) {
            clearInterval(this.triggerInterval);
            this.triggerInterval = null;
        }
    },

    // Called periodically or on specific events to resume flow
    // Called periodically or on specific events to resume flow
    checkStep: function () {
        if (!this.state.active || this.state.completed) return;
        this.showStep();
    },

    skip: function () {
        if (confirm("האם אתה בטוח שברצונך לדלג על המדריך?")) {
            this.complete();
        }
    }
};
