import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, RefreshCw, ChevronDown, ChevronUp, Infinity } from 'lucide-react';
import { useToast } from '../Layout/Toast.jsx';
import api from '../../utils/api.js';

const DAY_OPTIONS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
];

const PRESET_COLORS = ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316','#84cc16','#6b7280','#14b8a6'];

const DEFAULT_LEAVE_TYPES = [
  { key: 'PL',  label: 'Paid Leave',     yearlyQuota: 24, monthlyQuota: 0, weeklyQuota: 0, color: '#10b981', carryForward: true,  unlimited: false },
  { key: 'ML',  label: 'Medical Leave',  yearlyQuota: 6,  monthlyQuota: 0, weeklyQuota: 0, color: '#f59e0b', carryForward: false, unlimited: false },
  { key: 'EL',  label: 'Election Leave', yearlyQuota: 1,  monthlyQuota: 0, weeklyQuota: 0, color: '#8b5cf6', carryForward: false, unlimited: false },
  { key: 'UL',  label: 'Unpaid Leave',   yearlyQuota: 0,  monthlyQuota: 0, weeklyQuota: 0, color: '#6b7280', carryForward: false, unlimited: true  },
  { key: 'PAT', label: 'Paternity Leave',yearlyQuota: 5,  monthlyQuota: 0, weeklyQuota: 0, color: '#06b6d4', carryForward: false, unlimited: false },
];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-4 text-left">
        <span className="text-white font-semibold text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">{children}</div>}
    </div>
  );
}

function DayToggle({ days, field, onChange, color = 'blue' }) {
  const cls = { blue: 'bg-blue-600 border-blue-500', green: 'bg-emerald-600 border-emerald-500' };
  return (
    <div className="flex gap-2">
      {DAY_OPTIONS.map(d => (
        <button key={d.value} onClick={() => onChange(d.value, field)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
            days.includes(d.value) ? `${cls[color]} text-white` : 'bg-slate-700 border-slate-600 text-slate-400'
          }`}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

function QuotaInput({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="text-slate-500 text-[10px] block mb-1">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
        disabled={disabled}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed" />
    </div>
  );
}

function LeaveTypeCard({ lt, i, onUpdate, onRemove }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Color bar top */}
      <div className="h-1 w-full" style={{ backgroundColor: lt.color }} />
      <div className="p-3 space-y-3">
        {/* Key + Label */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-500 text-[10px] block mb-1">Key (short code)</label>
            <input value={lt.key} maxLength={6}
              onChange={e => onUpdate(i, 'key', e.target.value.toUpperCase())}
              placeholder="e.g. PL"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-slate-500 text-[10px] block mb-1">Label</label>
            <input value={lt.label} onChange={e => onUpdate(i, 'label', e.target.value)}
              placeholder="e.g. Paid Leave"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Unlimited toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div onClick={() => onUpdate(i, 'unlimited', !lt.unlimited)}
            className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${lt.unlimited ? 'bg-blue-600' : 'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${lt.unlimited ? 'left-5' : 'left-0.5'}`} />
          </div>
          <div className="flex items-center gap-1.5">
            <Infinity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 text-xs font-medium">Unlimited (no quota)</span>
          </div>
        </label>

        {/* Quota fields — disabled when unlimited */}
        <div className="grid grid-cols-3 gap-2">
          <QuotaInput label="Per Year" value={lt.yearlyQuota}  disabled={lt.unlimited} onChange={v => onUpdate(i, 'yearlyQuota',  v)} />
          <QuotaInput label="Per Month (cap)" value={lt.monthlyQuota} disabled={lt.unlimited} onChange={v => onUpdate(i, 'monthlyQuota', v)} />
          <QuotaInput label="Per Week (cap)"  value={lt.weeklyQuota}  disabled={lt.unlimited} onChange={v => onUpdate(i, 'weeklyQuota',  v)} />
        </div>
        <p className="text-slate-600 text-[10px] -mt-1">Set month/week to 0 for no cap on that period.</p>

        {/* Color + options row */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <label className="text-slate-500 text-[10px] block mb-1.5">Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => onUpdate(i, 'color', c)}
                  className={`w-5 h-5 rounded-full border-2 transition active:scale-90 ${lt.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={lt.carryForward} onChange={e => onUpdate(i, 'carryForward', e.target.checked)} className="rounded w-4 h-4" />
              Carry fwd
            </label>
            <button onClick={() => onRemove(i)} className="text-red-400 p-1.5 rounded-lg bg-red-500/10 active:bg-red-500/20">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [company, setCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', wfhPerMonth: 8, preferredWfhDays: [4,5],
    leaveTypes: DEFAULT_LEAVE_TYPES, publicHolidays: [], workingDays: [1,2,3,4,5]
  });

  useEffect(() => {
    api.get('/company').then(r => {
      setCompany(r.data);
      setForm({
        name: r.data.name || '',
        wfhPerMonth: r.data.wfhPerMonth || 8,
        preferredWfhDays: r.data.preferredWfhDays || [4,5],
        leaveTypes: r.data.leaveTypes?.length ? r.data.leaveTypes : DEFAULT_LEAVE_TYPES,
        publicHolidays: r.data.publicHolidays || [],
        workingDays: r.data.workingDays || [1,2,3,4,5],
      });
    }).catch(() => toast.error('Failed to load', 'Could not load company settings'));
  }, []);

  const save = async () => {
    const emptyKey = form.leaveTypes.find(lt => !lt.key.trim());
    if (emptyKey) { toast.warning('Missing key', 'Every leave type needs a short key code.'); return; }
    setSaving(true);
    try {
      await api.put('/company', form);
      toast.success('Settings saved!', 'Your company settings have been updated.');
    } catch (err) {
      toast.error('Save failed', err.response?.data?.message || 'Something went wrong');
    } finally { setSaving(false); }
  };

  const toggleDay = (day, field) => setForm(p => {
    const arr = p[field];
    return { ...p, [field]: arr.includes(day) ? arr.filter(d => d !== day) : [...arr, day].sort() };
  });

  const addLeaveType = () => setForm(p => ({
    ...p, leaveTypes: [...p.leaveTypes, { key: '', label: '', yearlyQuota: 0, monthlyQuota: 0, weeklyQuota: 0, color: '#6366f1', carryForward: false, unlimited: false }]
  }));

  const updateLeaveType = (i, field, val) => setForm(p => {
    const lt = [...p.leaveTypes]; lt[i] = { ...lt[i], [field]: val };
    // Reset quotas when switching to unlimited
    if (field === 'unlimited' && val) lt[i] = { ...lt[i], yearlyQuota: 0, monthlyQuota: 0, weeklyQuota: 0 };
    return { ...p, leaveTypes: lt };
  });

  const removeLeaveType = (i) => setForm(p => ({ ...p, leaveTypes: p.leaveTypes.filter((_, idx) => idx !== i) }));
  const addHoliday    = () => setForm(p => ({ ...p, publicHolidays: [...p.publicHolidays, { date: '', name: '' }] }));
  const updateHoliday = (i, f, v) => setForm(p => { const h = [...p.publicHolidays]; h[i] = { ...h[i], [f]: v }; return { ...p, publicHolidays: h }; });
  const removeHoliday = (i) => setForm(p => ({ ...p, publicHolidays: p.publicHolidays.filter((_, idx) => idx !== i) }));

  const inp = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500';

  if (!company) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto lg:mx-0">
          <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" /> Settings
          </h1>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50 transition">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-4 space-y-3 max-w-2xl mx-auto lg:mx-0">
        <Section title="Company">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Company Name</label>
            <input className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">WFH Days Per Month</label>
            <input type="number" min="0" max="23" className={`${inp} w-28`} value={form.wfhPerMonth}
              onChange={e => setForm(p => ({ ...p, wfhPerMonth: parseInt(e.target.value) || 0 }))} />
          </div>
        </Section>

        <Section title="Preferred WFH Days">
          <p className="text-slate-500 text-xs -mt-1">Warnings appear when you pick outside these days.</p>
          <DayToggle days={form.preferredWfhDays} field="preferredWfhDays" onChange={toggleDay} color="blue" />
        </Section>

        <Section title="Working Days" defaultOpen={false}>
          <DayToggle days={form.workingDays} field="workingDays" onChange={toggleDay} color="green" />
        </Section>

        <Section title={`Leave Types (${form.leaveTypes.length})`}>
          <div className="space-y-3">
            {form.leaveTypes.map((lt, i) => (
              <LeaveTypeCard key={i} lt={lt} i={i} onUpdate={updateLeaveType} onRemove={removeLeaveType} />
            ))}
            <button onClick={addLeaveType}
              className="w-full py-3 border border-dashed border-slate-700 rounded-xl text-slate-400 text-sm flex items-center justify-center gap-2 active:bg-slate-800">
              <Plus className="w-4 h-4" /> Add Leave Type
            </button>
          </div>
        </Section>

        <Section title={`Public Holidays (${form.publicHolidays.length})`} defaultOpen={false}>
          <div className="space-y-2">
            {form.publicHolidays.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="date" className={`${inp} flex-1`} value={h.date} onChange={e => updateHoliday(i, 'date', e.target.value)} />
                <input className={`${inp} flex-1`} placeholder="Holiday name" value={h.name} onChange={e => updateHoliday(i, 'name', e.target.value)} />
                <button onClick={() => removeHoliday(i)} className="text-red-400 p-2 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addHoliday}
              className="w-full py-3 border border-dashed border-slate-700 rounded-xl text-slate-400 text-sm flex items-center justify-center gap-2 active:bg-slate-800">
              <Plus className="w-4 h-4" /> Add Holiday
            </button>
          </div>
        </Section>

        <div className="h-2" />
      </div>
    </div>
  );
}
