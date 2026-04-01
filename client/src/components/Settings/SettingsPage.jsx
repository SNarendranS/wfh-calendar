import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import api from '../../utils/api.js';

const DAY_OPTIONS = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
];

const PRESET_COLORS = ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316','#84cc16'];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition ${value === c ? 'border-white scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [company, setCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '', wfhPerMonth: 8, preferredWfhDays: [4, 5], leaveTypes: [], publicHolidays: [], workingDays: [1,2,3,4,5]
  });

  useEffect(() => {
    api.get('/company').then(r => {
      setCompany(r.data);
      setForm({
        name: r.data.name || '',
        wfhPerMonth: r.data.wfhPerMonth || 8,
        preferredWfhDays: r.data.preferredWfhDays || [4, 5],
        leaveTypes: r.data.leaveTypes || [],
        publicHolidays: r.data.publicHolidays || [],
        workingDays: r.data.workingDays || [1,2,3,4,5],
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/company', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(err.response?.data?.message || 'Error saving'); }
    finally { setSaving(false); }
  };

  const toggleDay = (day, field) => {
    setForm(p => {
      const arr = p[field];
      return { ...p, [field]: arr.includes(day) ? arr.filter(d => d !== day) : [...arr, day].sort() };
    });
  };

  const addLeaveType = () => {
    setForm(p => ({ ...p, leaveTypes: [...p.leaveTypes, { key: '', label: '', yearlyQuota: 0, color: '#10b981', carryForward: false }] }));
  };

  const updateLeaveType = (i, field, val) => {
    setForm(p => { const lt = [...p.leaveTypes]; lt[i] = { ...lt[i], [field]: val }; return { ...p, leaveTypes: lt }; });
  };

  const removeLeaveType = (i) => {
    setForm(p => ({ ...p, leaveTypes: p.leaveTypes.filter((_, idx) => idx !== i) }));
  };

  const addHoliday = () => {
    setForm(p => ({ ...p, publicHolidays: [...p.publicHolidays, { date: '', name: '' }] }));
  };

  const updateHoliday = (i, field, val) => {
    setForm(p => { const h = [...p.publicHolidays]; h[i] = { ...h[i], [field]: val }; return { ...p, publicHolidays: h }; });
  };

  const removeHoliday = (i) => setForm(p => ({ ...p, publicHolidays: p.publicHolidays.filter((_, idx) => idx !== i) }));

  const inp = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500';
  const section = 'bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4';

  if (!company) return <div className="p-6 text-slate-400">Loading settings...</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-blue-400" /> Settings</h1>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Company basics */}
      <div className={section}>
        <h2 className="text-white font-semibold">Company</h2>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Company Name</label>
          <input className={`${inp} w-full`} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">WFH Days Per Month</label>
          <input type="number" min="0" max="23" className={`${inp} w-32`} value={form.wfhPerMonth}
            onChange={e => setForm(p => ({ ...p, wfhPerMonth: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>

      {/* Preferred WFH days */}
      <div className={section}>
        <h2 className="text-white font-semibold">Preferred WFH Days</h2>
        <p className="text-slate-500 text-xs">Select 1–3 days you prefer for WFH. Warnings will appear when you pick outside these.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map(d => (
            <button key={d.value} onClick={() => toggleDay(d.value, 'preferredWfhDays')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                form.preferredWfhDays.includes(d.value) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Working days */}
      <div className={section}>
        <h2 className="text-white font-semibold">Working Days</h2>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map(d => (
            <button key={d.value} onClick={() => toggleDay(d.value, 'workingDays')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                form.workingDays.includes(d.value) ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leave Types */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">Leave Types</h2>
          <button onClick={addLeaveType} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="space-y-3">
          {form.leaveTypes.map((lt, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1">Key</label>
                  <input className={`${inp} w-full`} placeholder="PL" value={lt.key} onChange={e => updateLeaveType(i, 'key', e.target.value.toUpperCase())} maxLength={5} />
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1">Label</label>
                  <input className={`${inp} w-full`} placeholder="Paid Leave" value={lt.label} onChange={e => updateLeaveType(i, 'label', e.target.value)} />
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1">Days/Year</label>
                  <input type="number" min="0" className={`${inp} w-full`} value={lt.yearlyQuota} onChange={e => updateLeaveType(i, 'yearlyQuota', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1">Color</label>
                  <ColorPicker value={lt.color} onChange={v => updateLeaveType(i, 'color', v)} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={lt.carryForward} onChange={e => updateLeaveType(i, 'carryForward', e.target.checked)} className="rounded" />
                    Carry Forward
                  </label>
                  <button onClick={() => removeLeaveType(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Public Holidays */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">Public Holidays</h2>
          <button onClick={addHoliday} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {form.publicHolidays.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" className={`${inp} flex-1`} value={h.date} onChange={e => updateHoliday(i, 'date', e.target.value)} />
              <input className={`${inp} flex-1`} placeholder="Holiday name" value={h.name} onChange={e => updateHoliday(i, 'name', e.target.value)} />
              <button onClick={() => removeHoliday(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {form.publicHolidays.length === 0 && <p className="text-slate-600 text-xs">No public holidays added yet.</p>}
        </div>
      </div>
    </div>
  );
}
