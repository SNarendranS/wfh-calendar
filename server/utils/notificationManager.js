import Notification from '../models/Notification.js';

// SSE clients map: userId -> Set<response>
const sseClients = new Map();

export function addSseClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  res.on('close', () => {
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(userId);
    }
  });
}

export async function notifyUser(userId, data) {
  // Create in DB
  const notification = await Notification.create({
    userId,
    title: data.title,
    message: data.message,
    type: data.type || 'INFO',
    category: data.category || 'system',
    fromUser: data.fromUser,
    relatedDate: data.relatedDate,
    actionable: data.actionable || false,
    actionData: data.actionData,
    actionUrl: data.actionUrl
  });

  // Populate the fromUser for SSE push
  const populated = await Notification.findById(notification._id)
    .populate('fromUser', 'username displayName avatar');

  // Push to SSE clients
  const clients = sseClients.get(userId.toString());
  if (clients) {
    const payload = JSON.stringify({ type: 'new_notification', notification: populated });
    for (const res of clients) {
      try {
        res.write(`data: ${payload}\n\n`);
      } catch {
        clients.delete(res);
      }
    }
  }

  return notification;
}