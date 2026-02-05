
window.GAME_GUIDE_HTML = `
<div class="guide-content" style="padding:15px; line-height:1.6; text-align:right; direction:rtl; max-height:70vh; overflow-y:auto;">
    <h2 style="color:#fbbf24; text-align:center; border-bottom:2px solid rgba(251,191,36,0.3); padding-bottom:10px; margin-bottom:20px;">🛡️ מדריך מלא למשחק ויקינגים 🛡️</h2>
    
    <h3 style="color:#10b981; margin-top:20px;">🎯 מטרת המשחק</h3>
    <p>בנה אימפריה ויקינגית חזקה, שלוט על שטחים, והובל את הקלאן שלך לניצחון. ההתקדמות נמדדת בניקוד אישי (אוכלוסייה, צבא, מבנים) ובדירוג הקלאן (טריטוריות, עושר, ניצחונות).</p>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#fbbf24;">💎 7 המשאבים והכלכלה</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:8px 0;">💰 <strong>זהב (Gold):</strong> המשאב העיקרי להכל. מיוצר ע"י מיסים (תלוי באוכלוסייה).</li>
        <li style="margin:8px 0;">🌲 <strong>עץ (Wood):</strong> בסיסי לבנייה. מיוצר במנסרה (Lumber).</li>
        <li style="margin:8px 0;">🌾 <strong>אוכל (Food):</strong> נדרש לאחזקת צבא (Upkeep) בעיר. מיוצר בחווה (Farm).</li>
        <li style="margin:8px 0;">🍷 <strong>יין (Wine):</strong> נדרש ליחידות מיוחדות וללוגיסטיקה.</li>
        <li style="margin:8px 0;">🏛️ <strong>שיש (Marble):</strong> למבנים מתקדמים והגנה.</li>
        <li style="margin:8px 0;">💎 <strong>קריסטל (Crystal):</strong> דלק למחקרים באקדמיה ונשק מתקדם.</li>
        <li style="margin:8px 0;">🔥 <strong>גופרית (Sulfur):</strong> נדרש למכונות מצור.</li>
        <li style="margin:8px 0;">👥 <strong>אזרחים (Citizens):</strong> מייצרים זהב וגדלים אוטומטית כשיש מקום.</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#fbbf24;">🏗️ ניהול העיר ומבנים</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:8px 0;">🏛️ <strong>Town Hall (עירייה):</strong> קובע את תקרת האוכלוסייה ומאפשר שדרוג מבנים אחרים.</li>
        <li style="margin:8px 0;">⚔️ <strong>Barracks (מחנה צבאי):</strong> לאימון חיילים. שדרוג פותח יחידות חזקות יותר.</li>
        <li style="margin:8px 0;">🎓 <strong>Academy (אקדמיה):</strong> לביצוע מחקרים (בנייה, התקפה, הגנה, לוגיסטיקה).</li>
        <li style="margin:8px 0;">📦 <strong>Warehouse (מחסן):</strong> מגן על משאבים מפני בזיזה.</li>
        <li style="margin:8px 0;">🛡️ <strong>Wall (חומה):</strong> משפרת משמעותית את ההגנה נגד תקיפות.</li>
        <li style="margin:8px 0;">⚓ <strong>Port (נמל):</strong> מאפשר מסחר עם שחקנים אחרים.</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#ef4444;">⚔️ צבא וקרבות</h3>
    <p><strong>סוגי יחידות:</strong></p>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">🛡️ <strong>בסיסי:</strong> חניתאי (הגנה), קשת (התקפה), לוחם חרב (מאוזן).</li>
        <li style="margin:5px 0;">🐴 <strong>פרשים (רמה 10+):</strong> מהירים וחזקים.</li>
        <li style="margin:5px 0;">⚔️ <strong>עלית:</strong> ברזרקר (התקפה גבוהה), חומת מגנים (הגנה גבוהה).</li>
        <li style="margin:5px 0;">🎯 <strong>מצור:</strong> קטפולטה ובליסטרה להריסת ביצורים.</li>
    </ul>
    
    <div style="background:rgba(239,68,68,0.1); padding:10px; border-radius:8px; margin:10px 0; border-right:3px solid #ef4444;">
        <strong style="color:#ef4444;">💡 מכניקת הקרב</strong>
        <p style="margin:5px 0;">• <strong>כוח:</strong> מחושב לפי סכום ההתקפה/הגנה של כל היחידות + בונוסי מחקר.</p>
        <p style="margin:5px 0;">• <strong>בזיזה:</strong> המנצח לוקח עד 30% מהמשאבים (מוגבל ע"י כושר הנשיאה - Cargo).</p>
        <p style="margin:5px 0;">• <strong>טיפ:</strong> חיילים בתקיפה או במבצר הקלאן <strong>לא צורכים אוכל!</strong></p>
    </div>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#a855f7;">🏰 מערכת הקלאנים</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">🏰 <strong>מבצר הקלאן:</strong> הלב של הקלאן. ניתן לאחסן בו צבא (Garrison) שלא צורך אוכל.</li>
        <li style="margin:5px 0;">⚔️ <strong>תקיפות מבצר:</strong> המנהיג יכול להוציא התקפות ענק עם כוחות הגריסון.</li>
        <li style="margin:5px 0;">💰 <strong>אוצר משותף:</strong> חברים תורמים משאבים לטובת הכלל.</li>
        <li style="margin:5px 0;">🏆 <strong>דירוג:</strong> התחרו מול קלאנים אחרים על שליטה ועושר.</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#0ea5e9;">🌍 מפה, משימות ושוק</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">🗺️ <strong>כיבוש שטחים:</strong> כבוש שדות משאבים (🌲🌾) להכנסה פסיבית. שדרג אותם לייצור מוגבר!</li>
        <li style="margin:5px 0;">📜 <strong>משימות:</strong> בצע משימות יומיות ושבועיות לפרסים יקרי ערך.</li>
        <li style="margin:5px 0;">⚖️ <strong>שוק:</strong> סחור בעודפי משאבים עם שחקנים אחרים להשלמת חוסרים.</li>
    </ul>

    <div style="text-align:center; padding:15px; background:rgba(251,191,36,0.1); border-radius:8px; margin-top:20px;">
        <p style="color:#fbbf24; font-size:1.1em; margin:0;"><strong>🎮 בהצלחה במסע, ויקינג! 🎮</strong></p>
    </div>
</div>
`;
