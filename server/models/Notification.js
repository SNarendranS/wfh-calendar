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
  relatedDate: { type: String },
  read: { type: Boolean, default: false },
  actionUrl: { type: String }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
