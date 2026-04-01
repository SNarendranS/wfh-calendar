import cron from 'node-cron';
import { format, addDays, parseISO } from 'date-fns';
import CalendarEntry from '../models/CalendarEntry.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import webpush from 'web-push';

export function startScheduler() {
  // Every day at 8 AM — remind about tomorrow's WFH/Leave
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const entries = await CalendarEntry.find({ date: tomorrow, type: { $in: ['WFH', 'LEAVE'] } });

      for (const entry of entries) {
        const user = await User.findById(entry.userId);
        if (!user) continue;

        const label = entry.type === 'WFH' ? 'Work From Home' : `Leave (${entry.leaveType || ''})`;
        const notif = await Notification.create({
          userId: user._id,
          title: `Tomorrow: ${label}`,
          message: `Reminder — you have ${label} scheduled for tomorrow (${tomorrow})`,
          type: 'REMINDER',
          relatedDate: tomorrow
        });

        // Push notification
        if (user.notificationPrefs?.push && user.pushSubscriptions?.length) {
          for (const sub of user.pushSubscriptions) {
            try {
              await webpush.sendNotification(sub, JSON.stringify({
                title: notif.title,
                body: notif.message,
                url: '/'
              }));
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  });

  // Every Monday 9 AM — warn about months with incomplete WFH quota
  cron.schedule('0 9 * * 1', async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const users = await User.find({});
      for (const user of users) {
        const count = await CalendarEntry.countDocuments({ userId: user._id, year, month, type: 'WFH' });
        if (count < 4) {
          await Notification.create({
            userId: user._id,
            title: 'WFH Days Reminder',
            message: `You have only ${count} WFH days planned this month. Consider adding more!`,
            type: 'INFO'
          });
        }
      }
    } catch (err) { console.error('Weekly reminder error:', err.message); }
  });

  console.log('✅ Scheduler started');
}
