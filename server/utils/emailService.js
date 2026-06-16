import nodemailer from 'nodemailer';
console.log({
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS_EXISTS: !!process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
});
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'noreply@wfhcal.app';

export async function sendOtpEmail(email, otp, purpose = 'verification') {
  const subjects = {
    email_verification: 'Verify your email - WFH Calendar',
    password_reset: 'Reset your password - WFH Calendar',
    otp_login: 'Your login OTP - WFH Calendar',
  };

  const messages = {
    email_verification: `Your verification code is: <strong>${otp}</strong><br/>This code expires in 10 minutes.`,
    password_reset: `Your password reset code is: <strong>${otp}</strong><br/>This code expires in 10 minutes.`,
    otp_login: `Your login OTP is: <strong>${otp}</strong><br/>This code expires in 10 minutes.`,
  };

  const subject = subjects[purpose] || subjects.email_verification;
  const message = messages[purpose] || messages.email_verification;

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0f172a; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #2563eb; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <span style="color: white; font-size: 28px; font-weight: bold;">WFH</span>
            </div>
            <h1 style="color: #f1f5f9; font-size: 20px; margin: 0;">WFH Calendar</h1>
          </div>
          <div style="background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155;">
            <p style="color: #e2e8f0; font-size: 14px; margin: 0 0 16px 0;">${subject}</p>
            <div style="text-align: center; padding: 16px 0;">
              <div style="font-size: 36px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: monospace;">${otp}</div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
          <p style="color: #475569; font-size: 10px; text-align: center; margin-top: 16px;">&copy; 2026 WFH Calendar. All rights reserved.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

export async function sendPasswordResetLink(email, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: 'Reset your password - WFH Calendar',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0f172a; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #2563eb; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <span style="color: white; font-size: 28px; font-weight: bold;">WFH</span>
            </div>
            <h1 style="color: #f1f5f9; font-size: 20px; margin: 0;">WFH Calendar</h1>
          </div>
          <div style="background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155;">
            <p style="color: #e2e8f0; font-size: 14px; margin: 0 0 16px 0;">Click the button below to reset your password:</p>
            <div style="text-align: center; padding: 8px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-weight: bold; font-size: 14px;">Reset Password</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">Or copy this link into your browser:</p>
            <p style="color: #3b82f6; font-size: 11px; margin: 4px 0 0 0; word-break: break-all;">${resetUrl}</p>
            <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
          <p style="color: #475569; font-size: 10px; text-align: center; margin-top: 16px;">&copy; 2026 WFH Calendar. All rights reserved.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}