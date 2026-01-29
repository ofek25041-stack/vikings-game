// Attack from Fortress function - Uses garrison troops instead of personal army
window.attackFromFortress = async function (x, y, targetEntity) {
    // Verify leader status
    if (!STATE.clan || STATE.clan.role !== 'leader') {
        notify("רק מנהיג הקלאן יכול לתקוף מהמבצר!", "error");
        return;
    }

    // Get player's clan from ALL_CLANS
    const playerClan = window.ALL_CLANS[STATE.clan.id];
    if (!playerClan || !playerClan.fortress) {
        notify("אין מבצר לקלאן!", "error");
        return;
    }

    // Check for garrison (new) or troops (old) for backward compatibility
    const garrison = playerClan.fortress.garrison || playerClan.fortress.troops || {};

    if (Object.keys(garrison).length === 0 || Object.values(garrison).every(v => v === 0)) {
        notify("אין חיילים במבצר שלך! פרוס חיילים תחילה.", "error");
        return;
    }
    const key = `${x},${y}`;

    // Build army selection modal with GARRISON troops
    let html = `
        <div class="mission-setup-view">
            <div style="background: rgba(139,92,246,0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(139,92,246,0.4);">
                <strong style="color: #a78bfa;">🏰 תקיפה מהמבצר</strong>
                <p style="font-size: 0.85rem; margin: 5px 0 0 0; color: #cbd5e1;">
                    אתה משתמש בכוחות הגריסון של המבצר.
                    <br>שלל יועבר לאוצר הקלאן.
                </p>
            </div>
            <p>בחר את הכוחות מהגריסון לשליחה להתקפה על <b>${targetEntity.name || 'יעד'}</b>:</p>
            <div class="mission-units-grid">
    `;

    let hasUnits = false;
    for (const [type, count] of Object.entries(garrison)) {
        if (count > 0 && UNIT_TYPES[type]) {
            hasUnits = true;
            const unit = UNIT_TYPES[type];
            html += `
                <div class="mission-unit-row">
                    <div class="u-icon">${unit.icon}</div>
                    <div class="u-name">${unit.name} <span class="u-avail">(במבצר: ${count})</span></div>
                    <input type="number" data-type="${type}" value="${count}" min="0" max="${count}" class="u-input">
                </div>
            `;
        }
    }

    if (!hasUnits) {
        notify("אין חיילים בגריסון של המבצר!", "error");
        return;
    }

    html += `
            </div>
            <div class="attack-summary" style="margin-top:15px; border-top:1px solid #444; padding-top:10px; text-align:center; color:#eab308; font-weight:bold;">
                 ⚠️ התקפה יכולה להוביל לאבידות מהגריסון!
            </div>
        </div>
    `;

    openModal(`תקיפה מהמבצר - ${targetEntity.name || 'יעד'}`, html, "התקף! 🏰", () => confirmFortressAttack(x, y));
};

window.confirmFortressAttack = async function (x, y) {
    const key = `${x},${y}`;
    const targetEntity = STATE.mapEntities[key];

    // 1. Collect Selected Units
    const inputs = document.querySelectorAll('.mission-unit-row input');
    const selectedArmy = {};
    let totalUnits = 0;

    inputs.forEach(inp => {
        const type = inp.dataset.type;
        const amount = parseInt(inp.value) || 0;
        if (amount > 0) {
            selectedArmy[type] = amount;
            totalUnits += amount;
        }
    });

    if (totalUnits === 0) {
        notify("עליך לבחור לפחות חייל אחד!", "error");
        return;
    }

    // 2. Validate garrison has enough troops
    const playerClan = window.ALL_CLANS[STATE.clan.id];
    if (!playerClan || !playerClan.fortress) {
        notify("שגיאה: לא נמצא מבצר", "error");
        return;
    }

    // Check both garrison (new) and troops (old) for backward compatibility
    const garrison = playerClan.fortress.garrison || playerClan.fortress.troops || {};

    for (const [type, amount] of Object.entries(selectedArmy)) {
        if ((garrison[type] || 0) < amount) {
            notify(`שגיאה: אין מספיק ${UNIT_TYPES[type].name} בגריסון`, "error");
            return;
        }
    }

    // 3. Deduct from garrison locally (will be confirmed by server)
    for (const [type, amount] of Object.entries(selectedArmy)) {
        garrison[type] -= amount;
        if (garrison[type] <= 0) delete garrison[type];
    }

    // Update in the actual fortress object
    if (playerClan.fortress.garrison) {
        playerClan.fortress.garrison = garrison;
    } else if (playerClan.fortress.troops) {
        playerClan.fortress.troops = garrison;
    }

    notify("שולח כוחות מהמבצר...", "info");
    closeModal();

    // 4. Send attack to server with source: 'fortress'
    try {
        const response = await fetch('/api/attack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attacker: CURRENT_USER,
                targetX: x,
                targetY: y,
                troops: selectedArmy,
                source: 'fortress' // CRITICAL: Tell server this is a fortress attack
            })
        });

        const result = await response.json();
        console.log('[FORTRESS_ATTACK_CLIENT] Server response:', result);

        if (!result.success) {
            notify("שגיאה בהתקפה: " + result.message, "error");
            // Refund garrison troops if server failed
            for (const [type, amount] of Object.entries(selectedArmy)) {
                garrison[type] = (garrison[type] || 0) + amount;
            }
            return;
        }

        // 5. Create timer for fortress attack
        const fortressCoords = playerClan.fortress;
        const travelTime = Math.sqrt(Math.pow(fortressCoords.x - x, 2) + Math.pow(fortressCoords.y - y, 2)) * 2;
        const totalDuration = (travelTime * 2 + 5);

        STATE.timers.push({
            type: 'mission',
            subtype: 'fortress_attack',
            targetKey: key,
            originKey: `${fortressCoords.x},${fortressCoords.y}`,
            startTime: Date.now(),
            units: selectedArmy,
            endTime: Date.now() + (totalDuration * 1000),
            desc: `התקפת מבצר על ${targetEntity.name || 'יעד'}`,
            isFortressAttack: true,
            // Store attack params for deferred resolution
            deferredBattle: result.deferred || false,
            attackParams: {
                attacker: CURRENT_USER,
                targetX: x,
                targetY: y,
                troops: selectedArmy,
                source: 'fortress'
            }
        });

        notify(`כוחות המבצר יצאו לקרב! הגעה ב-${Math.ceil(travelTime)} שניות.`, "success");
        updateUI();

    } catch (e) {
        console.error(e);
        notify("שגיאת תקשורת עם השרת", "error");
        // Refund garrison troops
        for (const [type, amount] of Object.entries(selectedArmy)) {
            garrison[type] = (garrison[type] || 0) + amount;
        }
    }
};
