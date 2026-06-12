import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  color: { type: String, default: '#6366f1' },
  carryForward: { type: Boolean, default: false },
  unlimited: { type: Boolean, default: false },
  yearlyQuota:  { type: Number, default: 0 },
  monthlyQuota: { type: Number, default: 0 }, // 0 = no cap
  weeklyQuota:  { type: Number, default: 0 }, // 0 = no cap
  accrualRule: {
    frequency: { type: String, enum: ['monthly', 'quarterly', 'halfYearly', 'yearly'], default: 'yearly' },
    creditDay: { type: Number, default: 1, min: 1, max: 31 },
  },
});

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  wfhPerMonth: { type: Number, default: 8 },
  preferredWfhDays: { type: [Number], default: [4, 5] },
  leaveTypes: {
    type: [leaveTypeSchema],
    default: [
      { key: 'PL',  label: 'Paid Leave',       yearlyQuota: 24, monthlyQuota: 0, weeklyQuota: 0, color: '#10b981', carryForward: true,  unlimited: false, accrualRule: { frequency: 'monthly', creditDay: 30 } },
      { key: 'ML',  label: 'Medical Leave',     yearlyQuota: 6,  monthlyQuota: 0, weeklyQuota: 0, color: '#f59e0b', carryForward: false, unlimited: false, accrualRule: { frequency: 'halfYearly', creditDay: 1 } },
      { key: 'EL',  label: 'Election Leave',    yearlyQuota: 1,  monthlyQuota: 0, weeklyQuota: 0, color: '#8b5cf6', carryForward: false, unlimited: false, accrualRule: { frequency: 'yearly', creditDay: 1 } },
      { key: 'UL',  label: 'Unpaid Leave',      yearlyQuota: 0,  monthlyQuota: 0, weeklyQuota: 0, color: '#6b7280', carryForward: false, unlimited: true,  accrualRule: { frequency: 'yearly', creditDay: 1 } },
      { key: 'PAT', label: 'Paternity Leave',   yearlyQuota: 5,  monthlyQuota: 0, weeklyQuota: 0, color: '#06b6d4', carryForward: false, unlimited: false, accrualRule: { frequency: 'yearly', creditDay: 1 } },
    ]
  },
  publicHolidays: [{
    date: { type: String, required: true },
    name: { type: String, required: true }
  }],
  workingDays: { type: [Number], default: [1,2,3,4,5] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Company', companySchema);