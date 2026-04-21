# 🚀 מדריך התקנה מהיר - Ido & Jonathan Shop

## צעדים חשובים לפני הפעלה:

### 1️⃣ הגדרת Discord Application

1. **צור אפליקציה חדשה:**
   - היכנס ל: https://discord.com/developers/applications
   - לחץ "New Application"
   - תן שם לאפליקציה (למשל: "Ido Jonathan Shop")

2. **הגדר OAuth2:**
   - עבור ל-OAuth2 בתפריט הצד
   - **העתק את Client ID** ושמור אותו
   - **העתק את Client Secret** (לחץ "Reset Secret" אם צריך) ושמור אותו
   - ב-Redirects, הוסף: `http://localhost:3000/auth/callback`
   - שמור שינויים

3. **הגדר את הבוט:**
   - עבור ל-Bot בתפריט הצד
   - אפשר את ה-Intents הבאים:
     - ✅ **SERVER MEMBERS INTENT**
     - ✅ **PRESENCE INTENT**
     - ✅ **MESSAGE CONTENT INTENT** (אופציונלי)

4. **הזמן את הבוט לשרת:**
   - עבור ל-OAuth2 → URL Generator
   - בחר Scopes: `bot` + `applications.commands`
   - בחר Bot Permissions: `Administrator` (או לפחות: Manage Channels, Send Messages, View Channels, Manage Roles)
   - העתק את הקישור שנוצר והזמן את הבוט לשרת שלך

### 2️⃣ קבל מזהים מהשרת

1. **הפעל Developer Mode בדיסקורד:**
   - הגדרות → Advanced → Developer Mode (הפעל)

2. **העתק מזהים:**
   - **Guild ID**: לחץ ימין על השרת → Copy Server ID
   - **Category ID**: לחץ ימין על הקטגוריה לטיקטים → Copy Category ID

### 3️⃣ ערוך את קובץ .env

פתח את הקובץ `.env` והזן את הערכים שהעתקת:

```env
# Discord Bot Token
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Discord OAuth2 - הזן כאן!
DISCORD_CLIENT_ID=הדבק_כאן_את_ה_CLIENT_ID
DISCORD_CLIENT_SECRET=הדבק_כאן_את_ה_CLIENT_SECRET
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Discord Server - הזן כאן!
GUILD_ID=הדבק_כאן_את_מזהה_השרת

# Discord Role IDs (כבר מוגדרים - אל תשנה!)
ADMIN_ROLE_ID=1487800359341785213
BUYER_ROLE_ID=1487800359396180048
VIP_ROLE_ID=1487800359379537968

# Discord Category for Tickets (כבר מוגדר - אל תשנה!)
TICKET_CATEGORY_ID=1487800360465727646

# Server
PORT=3000
SESSION_SECRET=שנה_את_זה_למשהו_אקראי_וארוך_123456789
```

### 4️⃣ הפעל את השרת

```bash
npm start
```

אם הכל עובד, תראה:
```
✅ Discord Bot logged in as [שם הבוט]
🚀 Server running on http://localhost:3000
```

### 5️⃣ בדוק שהכל עובד

1. פתח דפדפן וגש ל: http://localhost:3000
2. לחץ "התחבר עם Discord"
3. אשר את ההרשאות
4. אם יש לך רול Admin, תראה כפתור "ניהול"
5. הוסף מוצר ראשון!

---

## ❓ בעיות נפוצות

### הבוט לא מתחבר
- ✅ בדוק שהטוקן נכון ב-.env
- ✅ ודא שהבוט מוזמן לשרת
- ✅ בדוק שהפעלת את ה-Intents

### לא מצליח להתחבר לאתר
- ✅ ודא ש-Client ID ו-Secret נכונים
- ✅ בדוק שה-Redirect URI תואם בדיוק (כולל http://)
- ✅ ודא שאתה חבר בשרת

### "אין לך הרשאות גישה"
- ✅ ודא שיש לך את הרול הנכון (Admin או Buyer)
- ✅ בדוק שמזהי הרולים נכונים ב-.env

### לא נפתח טיקט
- ✅ ודא שה-Category ID נכון
- ✅ בדוק שלבוט יש הרשאות ליצור ערוצים
- ✅ ודא שהקטגוריה קיימת בשרת

---

## 📝 רשימת בדיקה מהירה

- [ ] יצרתי Discord Application
- [ ] העתקתי Client ID ו-Client Secret
- [ ] הזמנתי את הבוט לשרת
- [ ] אפשרתי את ה-Intents הנדרשים
- [ ] העתקתי את Guild ID
- [ ] ערכתי את קובץ .env
- [ ] הרצתי `npm install`
- [ ] הרצתי `npm start`
- [ ] הבוט התחבר בהצלחה
- [ ] האתר עובד ב-localhost:3000

---

## 🎉 מוכן!

עכשיו אתה יכול:
- ✅ להתחבר לאתר
- ✅ להוסיף מוצרים (אם אתה Admin)
- ✅ לקנות מוצרים (אם יש לך רול Buyer)
- ✅ לקבל הנחות (אם יש לך רול VIP)

**קישור לשרת:** https://discord.gg/Sbg5qpRru8

---

**צריך עזרה?** פנה למנהלי השרת! 💬
