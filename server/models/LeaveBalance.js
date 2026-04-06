import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year:   { type: Number, required: true },
  balances: [{
    leaveKey:      { type: String, required: true },
    total:         { type: Number, default: 0 },  // yearly quota (0 if unlimited)
    used:          { type: Number, default: 0 },
    carried:       { type: Number, default: 0 },
    unlimited:     { type: Boolean, default: false },
    monthlyQuota:  { type: Number, default: 0 },
    weeklyQuota:   { type: Number, default: 0 },
  }]
}, { timestamps: true });

leaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
