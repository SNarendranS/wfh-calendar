import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api.js';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({ all: 0 });
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const sseRef = useRef(null);
  const tokenRef = useRef(localStorage.getItem('token'));

  const fetch = useCallback(async (category = activeCategory) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (category && category !== 'all') params.set('category', category);
      const { data } = await api.get(`/notifications?${params}`);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setCategoryCounts(data.categoryCounts || { all: data.unreadCount });
    } catch {} finally { setLoading(false); }
  }, [activeCategory]);

  // Connect to SSE for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    tokenRef.current = token;

    const connectSse = () => {
      if (sseRef.current) sseRef.current.close();

      const eventSource = new EventSource(
        `${api.defaults.baseURL || 'http://localhost:5000/api'}/notifications/stream?token=${token}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_notification') {
            // Add new notification to top
            setNotifications(prev => [data.notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setCategoryCounts(prev => ({
              ...prev,
              all: (prev.all || 0) + 1,
              [data.notification.category]: ((prev[data.notification.category] || 0) + 1)
            }));
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Fallback: poll every 15s
        if (!sseRef.current) return;
      };

      sseRef.current = eventSource;
    };

    connectSse();

    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetch('all');
  }, []);

  const fetchByCategory = useCallback(async (category) => {
    setActiveCategory(category);
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (category && category !== 'all') params.set('category', category);
      const { data } = await api.get(`/notifications?${params}`);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setCategoryCounts(data.categoryCounts || { all: data.unreadCount });
    } catch {} finally { setLoading(false); }
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => {
      const updated = prev.map(n => n._id === id ? { ...n, read: true } : n);
      const wasUnread = prev.find(n => n._id === id && !n.read);
      if (wasUnread) {
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
        setCategoryCounts(prevCounts => ({
          ...prevCounts,
          all: Math.max(0, (prevCounts.all || 0) - 1),
          [wasUnread.category]: Math.max(0, (prevCounts[wasUnread.category] || 0) - 1)
        }));
      }
      return updated;
    });
  };

  const markAllRead = async (category) => {
    await api.patch('/notifications/read-all', { category: category || 'all' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setCategoryCounts({ all: 0 });
  };

  const deleteNotif = async (id) => {
    await api.delete(`/notifications/${id}`);
    const notif = notifications.find(n => n._id === id);
    setNotifications(prev => prev.filter(n => n._id !== id));
    if (notif && !notif.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      setCategoryCounts(prev => ({
        ...prev,
        all: Math.max(0, (prev.all || 0) - 1),
        [notif.category]: Math.max(0, (prev[notif.category] || 0) - 1)
      }));
    }
  };

  return {
    notifications, unreadCount, categoryCounts, loading,
    activeCategory, fetchByCategory,
    markRead, markAllRead, deleteNotif, refetch: fetch
  };
}