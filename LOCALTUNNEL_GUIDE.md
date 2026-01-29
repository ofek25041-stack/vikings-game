# 🌐 LocalTunnel - הדרך הכי פשוטה להעלות את המשחק!

## 🚀 שלב 1: התקנה (חד פעמית)

פתח CMD והרץ:
```bash
npm install -g localtunnel
```

זה יתקין את LocalTunnel גלובלית.

---

## 🎮 שלב 2: הפעלת המשחק

### אוטומטי (מומלץ):

פתח 2 חלונות CMD:

**חלון 1 - השרת:**
```bash
start_server.bat
```

**חלון 2 - הטנל:**
```bash
start_localtunnel.bat
```

### ידני (אם אתה מעדיף):

**חלון 1:**
```bash
cd C:\Users\Admin\.gemini\antigravity\scratch\vikings-game
node server.js
```

**חלון 2:**
```bash
cd C:\Users\Admin\.gemini\antigravity\scratch\vikings-game
lt --port 3000
```

---

## 📋 מה יקרה?

תקבל משהו כזה:
```
your url is: https://grumpy-cats-smile.loca.lt
```

**זה ה-URL שתשתף עם חברים!** 🎉

---

## ⚠️ דברים לשים לב אליהם:

### 1. דף אזהרה בפעם הראשונה
כשמישהו נכנס לראשונה, הוא יראה דף אזהרה:
```
This site is being served by localtunnel.me
To continue, enter the IP shown below
```

**זה נורמלי!** פשוט צריך ללחוץ "Continue" או להקליד את ה-IP.

### 2. ה-URL משתנה בכל הפעלה
בכל פעם שתפעיל מחדש את `lt`, תקבל URL חדש.

**פתרון**: אפשר לבקש subdomain קבוע:
```bash
lt --port 3000 --subdomain my-vikings-game
```

אז תקבל תמיד: `https://my-vikings-game.loca.lt`

*(אבל subdomain עלול להיות תפוס, נסה שמות שונים)*

---

## 🎯 סקריפט משופר עם subdomain:

צור קובץ `start_localtunnel_fixed.bat`:
```batch
@echo off
title LocalTunnel - Vikings Game
echo Starting tunnel with custom subdomain...
echo.

set SUBDOMAIN=vikings-game-%RANDOM%

echo Your game will be at: https://%SUBDOMAIN%.loca.lt
echo.

lt --port 3000 --subdomain %SUBDOMAIN%

pause
```

זה ייצור subdomain אקראי כמו `vikings-game-12345.loca.lt`

---

## 🛠️ פתרון בעיות:

### בעיה: "lt: command not found"
**פתרון:**
```bash
npm install -g localtunnel
```

### בעיה: "Error: Port 3000 is not reachable"
**פתרון:** ודא שהשרת רץ:
```bash
start_server.bat
```

### בעיה: "connection timeout"
**פתרון:** נסה שוב, לפעמים השרתים של localtunnel עמוסים.

---

## ✅ Ready?

1. הרץ: `start_server.bat`
2. הרץ: `start_localtunnel.bat`
3. העתק את ה-URL
4. שתף!

**זהו!** המשחק שלך בשידור חי! 🎮🌐
