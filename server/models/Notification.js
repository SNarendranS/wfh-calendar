import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['INFO', 'WARNING', 'SUCCESS', 'REMINDER'],
    default: 'INFO'
  },
  category: {
    type: String,
    enum: ['system', 'follow_request', 'warning', 'reminder', 'schedule'],
    default: 'system'
  },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedDate: { type: String },
  read: { type: Boolean, default: false },
  actionUrl: { type: String },
  actionable: { type: Boolean, default: false },
  actionData: { type: Object }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, read: 1 });

export default mongoose.model('Notification', notificationSchema);