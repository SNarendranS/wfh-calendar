import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  // Profile fields
  bookmarkedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Profile fields
  displayName: { type: String, trim: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 500 },
  phone: { type: String, default: '' },
  isEmailVerified: { type: Boolean, default: false },
  // Calendar visibility: 'public' = anyone can see, 'followers' = only followers, 'private' = only me
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'followers'
  },
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
