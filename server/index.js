import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import webpush from 'web-push';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import calendarRoutes from './routes/calendar.js';
import notificationRoutes from './routes/notifications.js';
import leaveBalanceRoutes from './routes/leaveBalance.js';
import { startScheduler } from './utils/scheduler.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// VAPID setup for web push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@wfhcal.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leave-balance', leaveBalanceRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wfh_calendar')
  .then(() => {
    console.log('✅ MongoDB connected');
    startScheduler();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB error:', err));
