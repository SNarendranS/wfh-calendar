import mongoose from 'mongoose';
import crypto from 'crypto';

const verificationTokenSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  otp: { type: String, required: true },
  type: {
    type: String,
    enum: ['email_verification', 'password_reset', 'otp_login'],
    required: true
  },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
}, { timestamps: true });

verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
verificationTokenSchema.index({ email: 1, type: 1 });

verificationTokenSchema.statics.generateOtp = function () {
  return crypto.randomInt(100000, 999999).toString();
};

verificationTokenSchema.statics.generateResetToken = function () {
  return crypto.randomBytes(32).toString('hex');
};

export default mongoose.model('VerificationToken', verificationTokenSchema);