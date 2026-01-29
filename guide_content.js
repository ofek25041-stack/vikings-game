
window.GAME_GUIDE_HTML = `
<div class="guide-content" style="padding:15px; line-height:1.6; text-align:right; direction:rtl; max-height:70vh; overflow-y:auto;">
    <h2 style="color:#fbbf24; text-align:center; border-bottom:2px solid rgba(251,191,36,0.3); padding-bottom:10px; margin-bottom:20px;">🛡️ מדריך מלא למשחק ויקינגים 🛡️</h2>
    
    <h3 style="color:#10b981; margin-top:20px;">🎯 מטרת המשחק</h3>
    <p>בנה אימפריה חזקה! הגדל את יכולת הייצור, אמן צבא אדיר, כבוש טריטוריות, הצטרף לקלאן, וסחור עם שחקנים אחרים. הניקוד נקבע לפי אוכלוסייה, צבא, וטריטוריות.</p>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#fbbf24;">💎 7 המשאבים</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:8px 0;">💰 <strong>זהב:</strong> המשאב העיקרי - נדרש לכל בנייה ואימון</li>
        <li style="margin:8px 0;">🌲 <strong>עץ:</strong> חיוני לבנייה - בנה מנסרות ותכבוש מחנות חוטבים</li>
        <li style="margin:8px 0;">🌾 <strong>אוכל:</strong> מתחזק את הצבא שבעיר (לא בתקיפה!)</li>
        <li style="margin:8px 0;">🍷 <strong>יין:</strong> נדרש ליחידות מתקדמות ואושר תושבים</li>
        <li style="margin:8px 0;">🏛️ <strong>שיש:</strong> למבנים ברמה גבוהה (חומה, ארמון)</li>
        <li style="margin:8px 0;">💎 <strong>קריסטל:</strong> דלק למחקרים באקדמיה</li>
        <li style="margin:8px 0;">🔥 <strong>גפרית:</strong> טכנולוגיות מתקדמות וביצורים</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#fbbf24;">🗺️ כיבוש וניהול טריטוריות</h3>
    <p><strong>כיבוש שדות:</strong> צא למפת העולם וחפש שדות משאבים (🌲🌾🍷). תקוף אותם עם הצבא שלך לכבוש אותם.</p>
    
    <div style="background:rgba(16,185,129,0.1); padding:10px; border-radius:8px; margin:10px 0; border-right:3px solid #10b981;">
        <strong style="color:#10b981;">⬆️ שדרוג טריטוריות (חדש!)</strong>
        <p style="margin:5px 0;">כל טריטוריה כבושה ניתנת לשדרוג עד רמה 10!</p>
        <p style="margin:5px 0;">• רמה 1 → 2: +20% ייצור</p>
        <p style="margin:5px 0;">• רמה 5: +140% ייצור (400% מהבסיס)</p>
        <p style="margin:5px 0;">• רמה 10: +540% ייצור (2200% מהבסיס!) 🚀</p>
        <p style="margin:5px 0; font-size:0.9em; color:#94a3b8;">עלויות משמעותיות בכל 7 המשאבים</p>
    </div>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#fbbf24;">🏗️ מבנים חיוניים</h3>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:8px 0;">🏛️ <strong>Town Hall:</strong> קובע תקרת רמה לכל המבנים. שדרג ראשון!</li>
        <li style="margin:8px 0;">⚔️ <strong>Barracks:</strong> אימון חיילים - שדרוג פותח יחידות חזקות יותר</li>
        <li style="margin:8px 0;">🎓 <strong>Academy:</strong> מחקרים לשיפור צבא, בנייה, וכלכלה</li>
        <li style="margin:8px 0;">📦 <strong>Warehouse:</strong> מגן על משאבים מפני ביזה</li>
        <li style="margin:8px 0;">🛡️ <strong>Wall:</strong> מגדיל הגנה משמעותית נגד תקיפות</li>
        <li style="margin:8px 0;">🏠 <strong>בתי מגורים:</strong> מגדילים אוכלוסייה וניקוד</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#ef4444;">⚔️ מערכת הקרב</h3>
    <p><strong>סוגי יחידות:</strong></p>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">🔱 <strong>Spearman:</strong> זול, טוב להגנה - 10 כוח</li>
        <li style="margin:5px 0;">🏹 <strong>Archer:</strong> נזק בינוני, מאוזן - 15 כוח</li>
        <li style="margin:5px 0;">⚔️ <strong>Swordsman:</strong> יקר וחזק - 20 כוח</li>
    </ul>
    
    <div style="background:rgba(239,68,68,0.1); padding:10px; border-radius:8px; margin:10px 0; border-right:3px solid #ef4444;">
        <strong style="color:#ef4444;">💡 טיפ חשוב מאוד!</strong>
        <p style="margin:5px 0;">חיילים בתקיפה או במבצר הקלאן <strong>לא צורכים אוכל!</strong></p>
        <p style="margin:5px 0;">רק חיילים שנמצאים בעיר שלך צורכים אוכל מדי שעה.</p>
        <p style="margin:5px 0; font-size:0.9em; color:#94a3b8;">→ אסטרטגיה: שמור חיילים במבצר או שלח במשלחות כדי לחסוך אוכל!</p>
    </div>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#a855f7;">🏰 מערכת הקלאנים</h3>
    <p><strong>הצטרף או צור קלאן משלך!</strong></p>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">👥 <strong>חברים:</strong> עד 50 חברים בקלאן</li>
        <li style="margin:5px 0;">💰 <strong>אוצר משותף:</strong> תרום משאבים ומנהיג יכול לחלק לחברים</li>
        <li style="margin:5px 0;">🏰 <strong>מבצר:</strong> בנה מבצר משותף לאחסון חיילים</li>
        <li style="margin:5px 0;">⚔️ <strong>תקיפות משותפות:</strong> מנהיג יכול לשלוח את צבא המבצר לתקוף</li>
        <li style="margin:5px 0;">🏆 <strong>דירוג קלאנים:</strong> התחרו להיות הקלאן החזק ביותר!</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#0ea5e9;">🏪 שוק המסחר</h3>
    <p>סחור עם שחקנים אחרים!</p>
    <ul style="list-style-type: none; padding:0; margin-left:10px;">
        <li style="margin:5px 0;">📊 <strong>הצעות פעילות:</strong> צור או קבל הצעות מסחר</li>
        <li style="margin:5px 0;">📜 <strong>היסטוריה:</strong> עקוב אחרי כל העסקאות שלך</li>
        <li style="margin:5px 0;">💱 <strong>חליפין:</strong> החלף משאב אחד במשאב אחר</li>
    </ul>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <h3 style="color:#f59e0b;">💡 טיפים מתקדמים</h3>
    <div style="background:rgba(245,158,11,0.1); padding:12px; border-radius:8px; margin:10px 0;">
        <p style="margin:5px 0;"><strong>🎯 כלכלה:</strong></p>
        <ul style="margin:5px 0 5px 15px; font-size:0.95em;">
            <li>שדרג Town Hall מוקדם - זה פותח אפשרויות</li>
            <li>כבוש שדות משאבים ושדרג אותם לרמות גבוהות</li>
            <li>שמור על יתרת אוכל חיובית - צבא גדול צורך הרבה!</li>
        </ul>

        <p style="margin:10px 0 5px 0;"><strong>⚔️ מלחמה:</strong></p>
        <ul style="margin:5px 0 5px 15px; font-size:0.95em;">
            <li>לפני תקיפה - שים חיילים בעיר כדי להגן מפני נקמה</li>
            <li>חומה חזקה מקטינה אבדות משמעותית</li>
            <li>חיילים בתקיפה לא צורכים אוכל - נצל את זה!</li>
        </ul>

        <p style="margin:10px 0 5px 0;"><strong>👥 קלאן:</strong></p>
        <ul style="margin:5px 0 5px 15px; font-size:0.95em;">
            <li>תרום לאוצר הקלאן - מנהיג יכול לעזור לך מאוחר יותר</li>
            <li>פרוס חיילים למבצר - הם לא צורכים אוכל שם!</li>
            <li>תקשר עם חברי הקלאן בצ'אט המשותף</li>
        </ul>

        <p style="margin:10px 0 5px 0;"><strong>🚀 התקדמות:</strong></p>
        <ul style="margin:5px 0 5px 15px; font-size:0.95em;">
            <li>עקוב אחרי המשימות - הן נותנות פרסים טובים</li>
            <li>סחור בשוק כדי להשיג משאבים נדירים</li>
            <li>שדרג טריטוריות כבושות לייצור מקסימלי</li>
        </ul>
    </div>

    <hr style="border-color:rgba(255,255,255,0.1); margin:15px 0;">

    <div style="text-align:center; padding:15px; background:rgba(251,191,36,0.1); border-radius:8px; margin-top:20px;">
        <p style="color:#fbbf24; font-size:1.1em; margin:0;"><strong>🎮 בהצלחה, ויקינג! 🎮</strong></p>
        <p style="color:#94a3b8; font-size:0.9em; margin:5px 0 0 0;">זכור: התמדה היא המפתח לניצחון!</p>
    </div>
</div>
`;
