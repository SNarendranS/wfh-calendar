import cron from 'node-cron';
import { format, addDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import CalendarEntry from '../models/CalendarEntry.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import LeaveBalance from '../models/LeaveBalance.js';
import webpush from 'web-push';

export function startScheduler() {
  // Every day at 8 AM — remind about tomorrow's WFH/Leave
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const entries = await CalendarEntry.find({ date: tomorrow, type: { $in: ['WFH', 'LEAVE', 'REMOTE'] } });

      for (const entry of entries) {
        const user = await User.findById(entry.userId);
        if (!user) continue;

        const label = entry.type === 'WFH' ? 'Work From Home' : entry.type === 'REMOTE' ? 'Remote Work' : `Leave (${entry.leaveType || ''})`;
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

  // Every day at 2 AM — credit leaves according to accrual rules
  cron.schedule('0 2 * * *', async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      const companies = await Company.find({});
      for (const company of companies) {
        for (const lt of company.leaveTypes || []) {
          if (lt.unlimited) continue;
          const rule = lt.accrualRule || { frequency: 'yearly', creditDay: 1 };

          // Check if today is a credit day for this frequency
          let shouldCredit = false;
          if (rule.frequency === 'monthly' && day === rule.creditDay) {
            shouldCredit = true;
          } else if (rule.frequency === 'quarterly' && day === rule.creditDay && [1, 4, 7, 10].includes(month)) {
            shouldCredit = true;
          } else if (rule.frequency === 'halfYearly' && day === rule.creditDay && [1, 7].includes(month)) {
            shouldCredit = true;
          } else if (rule.frequency === 'yearly' && month === 1 && day === rule.creditDay) {
            shouldCredit = true;
          }

          if (shouldCredit) {
            // Find all users in this company and update their leave balances
            const users = await User.find({ companyId: company._id });
            const totalCredits = (() => {
              if (rule.frequency === 'monthly') return 12;
              if (rule.frequency === 'quarterly') return 4;
              if (rule.frequency === 'halfYearly') return 2;
              return 1;
            })();
            const perPeriodCredit = lt.yearlyQuota / totalCredits;

            for (const user of users) {
              // Create notification about credited leave
              await Notification.create({
                userId: user._id,
                title: `${lt.label} Credited`,
                message: `${perPeriodCredit} ${lt.label} ${perPeriodCredit > 1 ? 'leaves have' : 'leave has'} been credited (${rule.frequency}).`,
                type: 'INFO'
              });
            }
            console.log(`[Scheduler] Credited ${lt.label} for ${company.name} (${rule.frequency})`);
          }
        }
      }
    } catch (err) {
      console.error('Leave crediting scheduler error:', err.message);
    }
  });

  console.log('✅ Scheduler started');
}