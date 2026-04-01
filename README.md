# 🏠 WFH Calendar

Smart Work-From-Home scheduler with leave management, long-weekend optimization, and notifications.

---

## Stack
- **Frontend:** Vite + React + Tailwind CSS
- **Backend:** Express.js (Node)
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (bcrypt)
- **Push Notifications:** Web Push (VAPID)

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI

### 2. Server setup
```bash
cd server
cp .env.example .env
# Edit .env — set MONGO_URI and JWT_SECRET at minimum

npm install
npm run dev        # starts on :5000
```

### 3. Client setup
```bash
cd client
npm install
npm run dev        # starts on :5173
```

### 4. Open http://localhost:5173 → Register → You're in!

### 5. Seed your 2026 WFH plan (optional)
After registering, grab your userId from the browser (DevTools → Application → LocalStorage → `user.id`), then:
```bash
cd server
node seed2026.js <your-userId>
```

---

## Generating VAPID keys (for browser push notifications)
```bash
cd server
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k);"
# Paste VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY into .env
```

---

## Features

| Feature | Details |
|---|---|
| 📅 Calendar | Month view, click any day to add WFH/Leave/Holiday |
| ⚡ Auto-Fill WFH | Suggests best Thu/Fri (or your preferred days) to hit monthly quota |
| ⚠️ Smart Warnings | Alerts when WFH swap breaks long-weekend pattern |
| 📊 Leave Balance | Running balance tracker per leave type |
| 🔔 In-app Alerts | Notification log with unread badge |
| 📲 Push Notifications | Day-before reminders via browser push |
| ⚙️ Company Settings | Fully dynamic: leave types, WFH quota, preferred days, holidays |
| 🔐 Auth | JWT login/register |

---

## Your 2026 WFH Summary

| Month | WFH Days | Notes |
|-------|----------|-------|
| April | 8 | + holidays: May 1, May 28 area |
| May | 8 | Holidays: May 1, May 28 |
| June | 8 | — |
| **July** | **8** | Removed Jul 2&3, kept 9,10,16,17,23,24,30,31 (all Thu/Fri) |
| August | 8 | — |
| September | 8 | Holiday: Sep 14 |
| October | 8 | Holidays: Oct 2, Oct 19 |
| November | 8 | — |
| December | 8 | Holiday: Dec 25 |

---

## Project Structure
```
wfh-calendar/
├── server/
│   ├── models/          # User, Company, CalendarEntry, Notification, LeaveBalance
│   ├── routes/          # auth, company, calendar, notifications, leaveBalance
│   ├── middleware/       # JWT protect
│   ├── utils/           # wfhLogic (warnings + suggestions), scheduler (cron)
│   ├── seed2026.js      # One-time seed for your 2026 plan
│   └── index.js
└── client/
    └── src/
        ├── components/  # Auth, Calendar, Dashboard, Notifications, Settings, Layout
        ├── context/     # AuthContext
        ├── hooks/       # useCalendar, useNotifications
        └── utils/       # api (axios), dateHelpers
```
