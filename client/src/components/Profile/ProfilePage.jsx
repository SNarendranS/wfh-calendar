import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Settings, ArrowLeft, CalendarDays, UserPlus, UserCheck, UserX, Users, Clock, Globe, Lock, Eye, EyeOff, Save, RefreshCw, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../Layout/Toast.jsx';
import api from '../../utils/api.js';

const VISIBILITY_OPTIONS = [
  { value: 'public', icon: Globe, label: 'Public', desc: 'Anyone can see your calendar' },
  { value: 'followers', icon: Users, label: 'Followers', desc: 'Only followers can see your calendar' },
  { value: 'private', icon: Lock, label: 'Private', desc: 'Only you can see your calendar' },
];

function FollowButton({ userId, initialStatus, onUpdate }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (status === 'accepted' || status === 'pending') {
        await api.delete(`/follow/${userId}`);
        setStatus(null);
        onUpdate?.('unfollowed');
      } else {
        const res = await api.post(`/follow/${userId}`);
        setStatus(res.data.follow.status);
        onUpdate?.(res.data.follow.status);
      }
    } catch (err) {
      // ignore
    } finally { setLoading(false); }
  };

  if (status === 'accepted') {
    return (
      <button onClick={handleFollow} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-red-500/20 hover:text-red-400 transition active:scale-95">
        <UserCheck className="w-4 h-4" /> Following
      </button>
    );
  }

  if (status === 'pending') {
    return (
      <button onClick={handleFollow} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-red-500/20 hover:text-red-400 transition active:scale-95">
        <Clock className="w-4 h-4" /> Requested
      </button>
    );
  }

  return (
    <button onClick={handleFollow} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition active:scale-95">
      <UserPlus className="w-4 h-4" /> Follow
    </button>
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isOwn = !id || id === currentUser?.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '', bio: '', phone: '', visibility: 'followers'
  });
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (isOwn) {
      api.get('/users/profile').then(res => {
        setProfile(res.data);
        setEditForm({
          displayName: res.data.displayName || '',
          bio: res.data.bio || '',
          phone: res.data.phone || '',
          visibility: res.data.visibility || 'followers'
        });
      }).catch(() => navigate('/login'))
        .finally(() => setLoading(false));
    } else {
      api.get(`/users/${id}/profile`).then(res => {
        setProfile(res.data);
        setFollowerCount(res.data.followerCount || 0);
        setFollowingCount(res.data.followingCount || 0);
      }).catch(() => toast.error('Error', 'Could not load profile'))
        .finally(() => setLoading(false));
    }
  }, [id, isOwn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/users/profile', editForm);
      setProfile(res.data);
      toast.success('Saved!', 'Profile updated successfully');
    } catch (err) {
      toast.error('Error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleFollowUpdate = (action) => {
    if (action === 'unfollowed') {
      setFollowerCount(prev => Math.max(0, prev - 1));
    } else if (action === 'accepted') {
      setFollowerCount(prev => prev + 1);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">User not found</p>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto lg:mx-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!isOwn && (
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 active:bg-slate-700">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl lg:text-2xl font-bold text-white">
            {isOwn ? 'My Profile' : 'Profile'}
          </h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-4">
        {/* Avatar Section */}
        <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 px-6 py-8 flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-bold text-slate-400 border-2 border-slate-600 overflow-hidden">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile.displayName || profile.username)?.[0]?.toUpperCase() || '?'
              )}
            </div>
            {isOwn && (
              <label className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-500 transition border-2 border-slate-800">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      const res = await api.put('/users/profile', { avatar: reader.result });
                      setProfile(res.data);
                      toast.success('Avatar updated!', '');
                    } catch (err) {
                      toast.error('Failed', 'Could not upload avatar');
                    }
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">
              {profile.displayName || profile.username}
            </h2>
            <p className="text-slate-400 text-sm">@{profile.username}</p>
            {!isOwn && (
              <p className="text-slate-500 text-xs mt-1 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> {followerCount} followers · {followingCount} following
              </p>
            )}
          </div>
          {!isOwn && (
            <FollowButton
              userId={profile._id}
              initialStatus={profile.followStatus}
              onUpdate={handleFollowUpdate}
            />
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="px-6 py-3 border-b border-slate-700/50">
            <p className="text-slate-300 text-sm">{profile.bio}</p>
          </div>
        )}

        {/* Visibility Badge */}
        <div className="px-6 py-3 border-b border-slate-700/50 flex items-center gap-2">
          {profile.visibility === 'public' ? <Globe className="w-3.5 h-3.5 text-blue-400" /> :
           profile.visibility === 'followers' ? <Users className="w-3.5 h-3.5 text-emerald-400" /> :
           <Lock className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-slate-500 text-xs capitalize">
            {profile.visibility} calendar
          </span>
        </div>

        {/* Quick actions */}
        <div className="px-6 py-3 flex gap-2">
          {!isOwn && (profile.followStatus === 'accepted' || profile.visibility === 'public') && (
            <Link to={`/calendar/${profile._id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition">
              <CalendarDays className="w-4 h-4" /> View Calendar
            </Link>
          )}
          {!isOwn && profile.followStatus === 'pending' && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 text-slate-500 text-sm font-medium cursor-not-allowed">
              <CalendarDays className="w-4 h-4" /> Awaiting approval
            </span>
          )}
        </div>
      </div>

      {/* Edit Profile (own only) */}
      {isOwn && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" /> Edit Profile
          </h3>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Display Name</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))}
              placeholder="Your display name" />
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Bio</label>
            <textarea className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows={3} value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
              placeholder="Tell people about yourself" maxLength={500} />
            <p className="text-slate-600 text-[10px] mt-1 text-right">{editForm.bio.length}/500</p>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Phone (optional)</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+1 555-0000" />
          </div>

          {/* Calendar Visibility */}
          <div>
            <label className="text-slate-400 text-xs mb-2 block">Calendar Visibility</label>
            <div className="grid grid-cols-1 gap-2">
              {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
                <button key={value} onClick={() => setEditForm(p => ({ ...p, visibility: value }))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
                    editForm.visibility === value
                      ? 'bg-blue-600/20 border-blue-500/50'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                  }`}>
                  <Icon className={`w-5 h-5 ${editForm.visibility === value ? 'text-blue-400' : 'text-slate-500'}`} />
                  <div>
                    <p className={`text-sm font-medium ${editForm.visibility === value ? 'text-white' : 'text-slate-300'}`}>{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 mt-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}
    </div>
  );
}