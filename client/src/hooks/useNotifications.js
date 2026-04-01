import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=30');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetch]);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id) => {
    await api.delete(`/notifications/${id}`);
    const notif = notifications.find(n => n._id === id);
    if (notif && !notif.read) setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  return { notifications, unreadCount, loading, markRead, markAllRead, deleteNotif, refetch: fetch };
}
