# 🛍️ Ido & Jonathan Shop

חנות מקוונת מתקדמת המשולבת עם Discord עם מערכת אימות, ניהול מוצרים, והנחות VIP.

## ✨ תכונות

- 🔐 **אימות Discord OAuth2** - התחברות מאובטחת דרך Discord
- 👥 **ניהול רולים** - הרשאות שונות למנהלים, קונים ו-VIP
- 🛒 **מערכת קנייה מתקדמת** - עם הגבלות כמות וקולדאון שבועי
- 💎 **הנחות VIP** - הנחות אוטומטיות למשתמשי VIP
- 🎫 **יצירת טיקטים אוטומטית** - הבוט פותח טיקט בדיסקורד לכל קנייה
- ⚙️ **פאנל ניהול** - ממשק ידידותי להוספה ועריכת מוצרים
- 📊 **היסטוריית קניות** - מעקב אחר כל הקניות במערכת

## 🚀 התקנה

### דרישות מקדימות

- Node.js (גרסה 16 ואילך)
- חשבון Discord Developer
- שרת Discord

### שלב 1: הגדרת Discord Application

1. היכנס ל-[Discord Developer Portal](https://discord.com/developers/applications)
2. לחץ על "New Application" וצור אפליקציה חדשה
3. עבור ל-**OAuth2** בתפריט הצד:
   - העתק את ה-**Client ID**
   - העתק את ה-**Client Secret**
   - הוסף Redirect URL: `http://localhost:3000/auth/callback`
4. עבור ל-**Bot** בתפריט הצד:
   - אפשר את ה-Privileged Gateway Intents:
     - ✅ SERVER MEMBERS INTENT
     - ✅ PRESENCE INTENT
5. הזמן את הבוט לשרת שלך:
   - עבור ל-OAuth2 → URL Generator
   - בחר: `bot` + `applications.commands`
   - בחר הרשאות: Administrator (או לפחות: Manage Channels, Send Messages, View Channels)
   - העתק את הקישור והזמן את הבוט

### שלב 2: קבלת מזהי Discord

1. **Guild ID (מזהה השרת)**:
   - לחץ ימין על השרת → Copy Server ID
   
2. **Role IDs (מזהי הרולים)**:
   - הרולים כבר מוגדרים בקוד:
     - Admin: `1487800359341785213`
     - Buyer: `1487800359396180048`
     - VIP: `1487800359379537968`
   
3. **Category ID (מזהה הקטגוריה לטיקטים)**:
   - לחץ ימין על הקטגוריה → Copy Category ID
   - כבר מוגדר: `1487800360465727646`

### שלב 3: התקנת הפרויקט

```bash
# התקן את החבילות
npm install

# ערוך את קובץ .env
# פתח את הקובץ .env והזן את הפרטים שלך:
# - DISCORD_CLIENT_ID
# - DISCORD_CLIENT_SECRET
# - GUILD_ID
```

### שלב 4: הפעלת השרת

```bash
npm start
```

השרת יעלה על: `http://localhost:3000`

## 📝 הגדרת קובץ .env

ערוך את הקובץ `.env` והזן את הערכים הבאים:

```env
# Discord Bot Token
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Discord OAuth2 - הזן את הפרטים שלך
DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Discord Server - הזן את מזהה השרת שלך
GUILD_ID=YOUR_GUILD_ID_HERE

# Discord Role IDs (כבר מוגדרים)
ADMIN_ROLE_ID=1487800359341785213
BUYER_ROLE_ID=1487800359396180048
VIP_ROLE_ID=1487800359379537968

# Discord Category for Tickets (כבר מוגדר)
TICKET_CATEGORY_ID=1487800360465727646

# Server
PORT=3000
SESSION_SECRET=your-random-secret-key-change-this
```

## 🎮 שימוש במערכת

### למשתמשים רגילים:

1. היכנס לאתר: `http://localhost:3000`
2. לחץ על "התחבר עם Discord"
3. אשר את ההרשאות
4. עבור לחנות ובחר מוצרים
5. לאחר הקנייה, יפתח לך טיקט בדיסקורד

### למנהלים:

1. התחבר לאתר
2. לחץ על כפתור "⚙️ ניהול"
3. הוסף מוצרים חדשים:
   - שם המוצר
   - תיאור
   - מחיר
   - כמות במלאי
   - מקסימום קנייה בפעם אחת
   - הנחת VIP (באחוזים)
   - קישור לתמונה (אופציונלי)
4. צפה בהיסטוריית הקניות

## 🔒 הרשאות ורולים

- **Admin Role** (`1487800359341785213`):
  - גישה מלאה לפאנל הניהול
  - יכולת להוסיף/לערוך/למחוק מוצרים
  - צפייה בהיסטוריית קניות

- **Buyer Role** (`1487800359396180048`):
  - גישה לחנות
  - יכולת לקנות מוצרים
  - קולדאון של 7 ימים בין קניות

- **VIP Role** (`1487800359379537968`):
  - כל ההרשאות של Buyer
  - הנחות אוטומטיות על מוצרים (לפי הגדרת המנהל)

## 🎫 מערכת הטיקטים

כאשר משתמש קונה מוצר:
1. הבוט יוצר ערוץ טיקט חדש בקטגוריה שהוגדרה
2. שם הערוץ: `קנייה-באתר-[שם-המשתמש]`
3. הטיקט כולל:
   - תיוג המשתמש
   - פרטי המוצר שנקנה
   - כמות
   - מחיר כולל
4. רק המשתמש והמנהלים יכולים לראות את הטיקט

## 📊 מסד הנתונים

המערכת משתמשת ב-JSON עם 3 אוספים:

- **products** - מוצרים בחנות
- **purchases** - היסטוריית קניות
- **cooldowns** - מעקב אחר קולדאון קניות

הקובץ: `shop.json` נוצר אוטומטית בהפעלה הראשונה.

## 🛠️ טכנולוגיות

- **Backend**: Node.js + Express
- **Database**: JSON File Storage
- **Discord**: Discord.js v14
- **Auth**: Discord OAuth2
- **Frontend**: HTML + CSS + Vanilla JavaScript

## ⚠️ הערות חשובות

1. **אבטחה**: שנה את `SESSION_SECRET` בקובץ `.env` למפתח אקראי חזק
2. **Production**: לשימוש בפרודקשן, שנה את ה-REDIRECT_URI לדומיין האמיתי שלך
3. **Backup**: גבה את קובץ `shop.json` באופן קבוע
4. **Bot Token**: אל תשתף את הטוקן של הבוט עם אף אחד!

## 🐛 פתרון בעיות

### הבוט לא מתחבר
- ודא שהטוקן נכון בקובץ `.env`
- בדוק שהבוט מוזמן לשרת
- ודא שהפעלת את ה-Intents הנדרשים

### לא מצליח להתחבר לאתר
- ודא שה-Client ID ו-Secret נכונים
- בדוק שה-Redirect URI תואם בדיוק
- ודא שאתה חבר בשרת הדיסקורד

### לא נפתח טיקט
- ודא שה-Category ID נכון
- בדוק שלבוט יש הרשאות ליצור ערוצים
- ודא שהקטגוריה קיימת בשרת

## 📞 תמיכה

קישור להצטרפות לשרת: https://discord.gg/Sbg5qpRru8

---

**נבנה עם ❤️ עבור Ido & Jonathan**
