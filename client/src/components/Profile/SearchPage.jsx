import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, X, UserPlus, UserCheck, Clock, ArrowRight } from 'lucide-react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function FollowButton({ userId, initialStatus, onUpdate }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (status === 'accepted' || status === 'pending') {
        await api.delete(`/follow/${userId}`);
        setStatus(null);
        onUpdate?.(userId, null);
      } else {
        const res = await api.post(`/follow/${userId}`);
        setStatus(res.data.follow.status);
        onUpdate?.(userId, res.data.follow.status);
      }
    } catch (err) {
      // ignore
    } finally { setLoading(false); }
  };

  if (status === 'accepted') {
    return (
      <button onClick={handleFollow} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 text-xs font-medium hover:bg-red-500/20 hover:text-red-400 transition active:scale-95">
        <UserCheck className="w-3 h-3" /> Following
      </button>
    );
  }

  if (status === 'pending') {
    return (
      <button onClick={handleFollow} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-red-500/20 hover:text-red-400 transition active:scale-95">
        <Clock className="w-3 h-3" /> Requested
      </button>
    );
  }

  return (
    <button onClick={handleFollow} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition active:scale-95">
      <UserPlus className="w-3 h-3" /> Follow
    </button>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const handleSearch = useCallback((value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/search/${encodeURIComponent(value.trim())}`);
        setResults(res.data);
        setSearched(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  }, []);

  const handleFollowUpdate = (userId, newStatus) => {
    setResults(prev => prev.map(u =>
      u._id === userId ? { ...u, followStatus: newStatus } : u
    ));
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base';

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto lg:mx-0">
      <h1 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <Search className="w-5 h-5 text-blue-400" /> Find People
      </h1>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input className={`${inp} pl-11`} placeholder="Search by name, username, or email..."
          value={query} onChange={e => handleSearch(e.target.value)} autoFocus autoCapitalize="none" autoCorrect="off" />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No users found</p>
          <p className="text-slate-600 text-xs mt-1">Try a different search term</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map(u => (
            <div key={u._id}
              className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-3 hover:border-slate-600 transition cursor-pointer"
              onClick={() => navigate(`/profile/${u._id}`)}>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                {(u.displayName || u.username)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium truncate">
                  {u.displayName || u.username}
                </p>
                <p className="text-slate-500 text-xs truncate">@{u.username}</p>
                {u.bio && <p className="text-slate-500 text-xs truncate mt-0.5">{u.bio}</p>}
              </div>
              <div onClick={e => e.stopPropagation()}>
                <FollowButton
                  userId={u._id}
                  initialStatus={u.followStatus}
                  onUpdate={handleFollowUpdate}
                />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Search for people</p>
          <p className="text-slate-600 text-xs mt-1">Find colleagues and friends</p>
        </div>
      )}
    </div>
  );
}