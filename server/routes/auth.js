import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Company from '../models/Company.js';
import LeaveBalance from '../models/LeaveBalance.js';
import VerificationToken from '../models/VerificationToken.js';
import { sendOtpEmail, sendPasswordResetLink } from '../utils/emailService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

// ─── OTP: Send verification OTP to email ───
router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    // For email verification during registration, check email not taken
    if (purpose === 'email_verification') {
      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(400).json({ message: 'Email already registered' });
    }

    // For password reset, check email exists
    if (purpose === 'password_reset') {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) return res.status(404).json({ message: 'No account found with this email' });
    }

    // Generate OTP
    const otp = VerificationToken.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this email+purpose
    await VerificationToken.updateMany(
      { email: normalizedEmail, type: purpose || 'email_verification', used: false },
      { $set: { used: true } }
    );

    await VerificationToken.create({
      email: normalizedEmail,
      otp,
      type: purpose || 'email_verification',
      expiresAt
    });

    const sent = await sendOtpEmail(normalizedEmail, otp, purpose || 'email_verification');
    if (!sent) return res.status(500).json({ message: 'Failed to send email. Check server email settings.' });

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── OTP: Verify OTP ───
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const token = await VerificationToken.findOne({
      email: normalizedEmail,
      otp,
      type: purpose || 'email_verification',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!token) return res.status(400).json({ message: 'Invalid or expired OTP' });

    token.used = true;
    await token.save();

    res.json({ message: 'OTP verified successfully', verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── OTP Login: Send OTP ───
router.post('/send-login-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    const otp = VerificationToken.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationToken.updateMany(
      { email: normalizedEmail, type: 'otp_login', used: false },
      { $set: { used: true } }
    );

    await VerificationToken.create({
      email: normalizedEmail,
      otp,
      type: 'otp_login',
      expiresAt
    });

    const sent = await sendOtpEmail(normalizedEmail, otp, 'otp_login');
    if (!sent) return res.status(500).json({ message: 'Failed to send email. Check server email settings.' });

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── OTP Login: Verify OTP & Login ───
router.post('/login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const token = await VerificationToken.findOne({
      email: normalizedEmail,
      otp,
      type: 'otp_login',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!token) return res.status(400).json({ message: 'Invalid or expired OTP' });

    token.used = true;
    await token.save();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      token: signToken(user._id),
      user: { id: user._id, username: user.username, email: user.email, companyId: user.companyId }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Register ───
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, companyName, otp } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (!otp) return res.status(400).json({ message: 'Email verification OTP is required. Please verify your email first.' });

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP - must be unused and not expired
    const vToken = await VerificationToken.findOne({
      email: normalizedEmail,
      otp,
      type: 'email_verification',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!vToken) return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new verification code.' });

    // Mark OTP as used
    vToken.used = true;
    await vToken.save();

    const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      username,
      email: normalizedEmail,
      password,
      isEmailVerified: true // Email was verified via OTP flow
    });

    // Create default company
    const company = await Company.create({ name: companyName || `${username}'s Company`, createdBy: user._id });
    user.companyId = company._id;
    await user.save();

    // Init leave balances for current year
    const year = new Date().getFullYear();
    await LeaveBalance.create({
      userId: user._id,
      year,
      balances: company.leaveTypes.map(lt => ({
        leaveKey: lt.key,
        total: lt.yearlyQuota,
        used: 0,
        carried: 0
      }))
    });

    res.status(201).json({
      token: signToken(user._id),
      user: { id: user._id, username, email: normalizedEmail, companyId: company._id }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Login ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({
      token: signToken(user._id),
      user: { id: user._id, username: user.username, email: user.email, companyId: user.companyId }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Forgot Password: Send reset link ───
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    // Send OTP for password reset
    const otp = VerificationToken.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationToken.updateMany(
      { email: normalizedEmail, type: 'password_reset', used: false },
      { $set: { used: true } }
    );

    await VerificationToken.create({
      email: normalizedEmail,
      otp,
      type: 'password_reset',
      expiresAt
    });

    const sent = await sendOtpEmail(normalizedEmail, otp, 'password_reset');
    if (!sent) return res.status(500).json({ message: 'Failed to send email. Check server email settings.' });

    res.json({ message: 'Password reset code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Reset Password ───
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP, and new password are required' });

    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const token = await VerificationToken.findOne({
      email: normalizedEmail,
      otp,
      type: 'password_reset',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!token) return res.status(400).json({ message: 'Invalid or expired OTP' });

    token.used = true;
    await token.save();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;