# 🌐 חלופות חינמיות ל-ngrok

## 🥇 אפשרות 1: Cloudflare Tunnel (הכי מומלץ!)

### יתרונות:
- ✅ חינמי לחלוטין
- ✅ URL קבוע שלא משתנה
- ✅ אין מגבלת זמן
- ✅ מהירות גבוהה
- ✅ אבטחה מעולה (DDoS protection)

### התקנה:

**שלב 1:** הורד את cloudflared
1. לך לכאן: https://github.com/cloudflare/cloudflared/releases/latest
2. הורד: `cloudflared-windows-amd64.exe`
3. שנה שם ל: `cloudflared.exe`
4. העתק לתיקיית המשחק או הוסף ל-PATH

**שלב 2:** הפעל את הטנל
```bash
# בחלון אחד - הפעל שרת
start_server.bat

# בחלון שני - הפעל טנל
start_cloudflare_tunnel.bat
```

או ישירות:
```bash
cloudflared tunnel --url http://localhost:3000
```

**שלב 3:** קבל URL
תקבל משהו כמו:
```
https://xxx-xxx-xxx.trycloudflare.com
```

זה ה-URL שתשתף!

---

## 🥈 אפשרות 2: LocalTunnel (פשוט מאוד)

### התקנה:
```bash
npm install -g localtunnel
```

### שימוש:
```bash
# בחלון אחד
start_server.bat

# בחלון שני
lt --port 3000
```

תקבל: `https://xxx.loca.lt`

**חיסרון:** לפעמים יש דף אזהרה לפני כניסה

---

## 🥉 אפשרות 3: Serveo (ללא התקנה!)

### שימוש (SSH בלבד):
```bash
ssh -R 80:localhost:3000 serveo.net
```

תקבל URL ציבורי מיד!

**חיסרון:** צריך SSH client (יש ב-Windows 10+)

---

## 🌟 אפשרות 4: Deploy לענן (חינמי לצמיתות)

### Render.com (מומלץ למשחק קבוע!)

**יתרונות:**
- ✅ חינמי לצמיתות
- ✅ URL קבוע
- ✅ Auto-deploy מ-Git
- ✅ SSL חינמי
- ⚠️ שרת "ישן" אחרי 15 דקות חוסר פעילות (מתעורר אוטומטית)

**איך לעשות:**
1. העלה את הקוד ל-GitHub
2. צור חשבון ב-Render.com
3. חבר את ה-repo
4. Deploy!

---

## ✨ המלצה שלי:

### לשימוש מיידי (עכשיו):
👉 **Cloudflare Tunnel** - הכי טוב וחינמי

### לשימוש קבוע/ארוך טווח:
👉 **Render.com** - יעלה את המשחק פעם אחת ויישאר עולה תמיד

---

## 🚀 מה תרצה לעשות?

1. **אתקין לך Cloudflare Tunnel** (5 דקות)
2. **אעזור לך להעלות ל-Render** (15 דקות, אבל קבוע לצמיתות)
3. **ננסה LocalTunnel** (הכי פשוט, אבל פחות יציב)

תגיד לי מה אתה מעדיף!
