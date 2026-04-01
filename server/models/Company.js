import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  yearlyQuota: { type: Number, required: true },
  color: { type: String, default: '#6366f1' },
  carryForward: { type: Boolean, default: false }
});

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  wfhPerMonth: { type: Number, default: 8 },
  preferredWfhDays: {
    type: [Number],
    default: [4, 5], // 4=Thu, 5=Fri (1=Mon...7=Sun)
    validate: v => v.length >= 1 && v.length <= 3
  },
  leaveTypes: { type: [leaveTypeSchema], default: [
    { key: 'PL', label: 'Paid Leave', yearlyQuota: 24, color: '#10b981', carryForward: true },
    { key: 'ML', label: 'Medical Leave', yearlyQuota: 6, color: '#f59e0b', carryForward: false },
    { key: 'EL', label: 'Election Leave', yearlyQuota: 1, color: '#8b5cf6', carryForward: false }
  ]},
  publicHolidays: [{
    date: { type: String, required: true }, // ISO date string
    name: { type: String, required: true }
  }],
  workingDays: { type: [Number], default: [1,2,3,4,5] }, // Mon-Fri
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Company', companySchema);
