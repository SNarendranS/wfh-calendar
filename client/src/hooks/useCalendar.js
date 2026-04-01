import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';

export function useCalendar(year, month) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (!year || !month) return;
    setLoading(true);
    try {
      const { data } = await api.get('/calendar', { params: { year, month } });
      setEntries(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addEntry = async (date, type, leaveType, note) => {
    const { data } = await api.post('/calendar', { date, type, leaveType, note });
    await fetchEntries();
    return data; // includes warnings
  };

  const removeEntry = async (date) => {
    await api.delete(`/calendar/${date}`);
    await fetchEntries();
  };

  const bulkSetWfh = async (dates) => {
    await api.post('/calendar/bulk-wfh', { year, month, dates });
    await fetchEntries();
  };

  const getSuggestions = async () => {
    const { data } = await api.get('/calendar/suggest-wfh', { params: { year, month } });
    return data.suggestions;
  };

  const entryMap = entries.reduce((acc, e) => { acc[e.date] = e; return acc; }, {});

  return { entries, entryMap, loading, error, addEntry, removeEntry, bulkSetWfh, getSuggestions, refetch: fetchEntries };
}
