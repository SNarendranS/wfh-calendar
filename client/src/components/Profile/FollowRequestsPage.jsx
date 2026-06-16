import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, X, Clock, Check, AlertTriangle } from 'lucide-react';
import api from '../../utils/api.js';

export default function FollowRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const res = await api.get('/follow/requests');
      setRequests(res.data);
    } catch (err) {
      // ignore
    } finally { setLoading(false); }
  };

  const handleAccept = async (userId) => {
    try {
      await api.post(`/follow/accept/${userId}`);
      setRequests(prev => prev.filter(r => r.user._id !== userId));
    } catch (err) {
      // ignore
    }
  };

  const handleReject = async (userId) => {
    try {
      await api.delete(`/follow/${userId}`);
      setRequests(prev => prev.filter(r => r.user._id !== userId));
    } catch (err) {
      // ignore
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto lg:mx-0">
      <h1 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-blue-400" /> Follow Requests
      </h1>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No pending requests</p>
          <p className="text-slate-600 text-xs mt-1">When someone requests to follow you, it'll appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r._id}
              className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0 cursor-pointer"
                onClick={() => navigate(`/profile/${r.user._id}`)}>
                {(r.user.displayName || r.user.username)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/profile/${r.user._id}`)}>
                <p className="text-slate-200 text-sm font-medium truncate">
                  {r.user.displayName || r.user.username}
                </p>
                <p className="text-slate-500 text-xs truncate">@{r.user.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleAccept(r.user._id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition active:scale-95">
                  <Check className="w-3.5 h-3.5" /> Accept
                </button>
                <button onClick={() => handleReject(r.user._id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 text-slate-400 text-xs font-medium hover:bg-red-500/20 hover:text-red-400 transition active:scale-95">
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}