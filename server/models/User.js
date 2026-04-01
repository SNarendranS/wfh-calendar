import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  pushSubscriptions: [{ type: Object }],
  notificationPrefs: {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    reminderDaysBefore: { type: Number, default: 1 }
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
