import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Wand2, Trash2, X, AlertTriangle } from 'lucide-react';
import { useCalendar } from '../../hooks/useCalendar.js';
import { useToast } from '../Layout/Toast.jsx';
import { getCalendarGrid, DAY_NAMES, toDateStr, TYPE_CONFIG, MONTH_NAMES_FULL, isWeekend } from '../../utils/dateHelpers.js';
import api from '../../utils/api.js';

const TYPES = ['WFH', 'LEAVE', 'HOLIDAY', 'OFFICE'];

function DayCell({ date, entry, company, onClick, today }) {
  if (!date) return <div className="aspect-square bg-slate-900/20 rounded-lg lg:h-20" />;
  const ds = toDateStr(date);
  const isToday = ds === today;
  const weekend = isWeekend(date);
  const holiday = company?.publicHolidays?.find(h => h.date === ds);
  const cfg = entry ? TYPE_CONFIG[entry.type] : null;

  return (
    <div onClick={() => onClick(date, entry)}
      className={`aspect-square lg:aspect-auto lg:h-20 rounded-lg lg:rounded-xl border cursor-pointer transition-all active:scale-95 lg:hover:scale-[1.02] relative overflow-hidden select-none
        ${isToday ? 'ring-2 ring-blue-500' : ''}
        ${weekend && !entry ? 'bg-slate-800/30 border-slate-700/30' : !entry ? 'bg-slate-800 border-slate-700' : `${cfg.bg} ${cfg.border}`}
      `}>
      <div className="p-1 lg:p-2 h-full flex flex-col">
        <span className={`text-[10px] lg:text-xs font-bold ${isToday ? 'text-blue-400' : weekend ? 'text-slate-600' : 'text-slate-300'}`}>
          {date.getDate()}
        </span>
        {entry && (
          <div className="flex-1 flex items-center justify-center lg:hidden mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
          </div>
        )}
        {entry && (
          <div className="hidden lg:block mt-1">
            <span className={`text-[10px] font-semibold ${cfg.text} block truncate`}>
              {entry.type}{entry.leaveType ? ` · ${entry.leaveType}` : ''}
            </span>
            {entry.note && <span className="text-[9px] text-slate-500 block truncate">{entry.note}</span>}
          </div>
        )}
        {holiday && !entry && (
          <div className="flex-1 flex items-end lg:hidden">
            <div className="w-full h-0.5 bg-violet-500/50 rounded" />
          </div>
        )}
        {holiday && !entry && (
          <div className="hidden lg:block mt-1">
            <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1 py-0.5 rounded truncate block">{holiday.name}</span>
          </div>
        )}
      </div>
      {isToday && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />}
    </div>
  );
}

function EntryModal({ date, entry, company, onClose, onSave, onDelete, toast }) {
  const [type, setType] = useState(entry?.type || 'WFH');
  const [leaveType, setLeaveType] = useState(entry?.leaveType || '');
  const [note, setNote] = useState(entry?.note || '');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [pendingSave, setPendingSave] = useState(false); // true = warnings shown, next click force-saves

  const doSave = async (force = false) => {
    // If warnings already shown and user clicks "Save Anyway" — proceed and close
    if (warnings.length > 0 && !force) {
      // Show them again if they somehow re-click Save before choosing
      return;
    }
    setLoading(true);
    try {
      const result = await onSave(toDateStr(date), type, leaveType || undefined, note || undefined);
      if (result?.warnings?.length && !pendingSave) {
        // First time — show warnings, don't close yet
        setWarnings(result.warnings);
        setPendingSave(true);
        setLoading(false);
        return;
      }
      // Either no warnings or user already saw them — close
      toast.success('Saved', `${type} set for ${format(date, 'MMM d')}`);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving';
      toast.error('Could not save', msg);
      // Do NOT close — let user fix or cancel
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (pendingSave) {
      // User clicked "Save Anyway" after warnings — force save (warnings already exist on DB side, just close)
      toast.warning('Saved with warnings', `${type} saved despite preference mismatch`);
      onClose();
    } else {
      doSave();
    }
  };

  const typeBtn = (t) => {
    const cfg = TYPE_CONFIG[t];
    const active = type === t;
    return (
      <button key={t} onClick={() => { setType(t); setWarnings([]); setPendingSave(false); }}
        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
          active ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
        {t}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full lg:max-w-md bg-slate-800 rounded-t-3xl lg:rounded-2xl border border-slate-700 shadow-2xl mb-16 lg:mb-0">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-white font-semibold">{format(date, 'EEE, MMM d yyyy')}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{entry ? 'Edit entry' : 'Add entry'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-700 text-slate-400 active:bg-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-xs leading-relaxed">{w.message}</p>
                </div>
              ))}
              <p className="text-amber-500/70 text-xs mt-1">Tap "Save Anyway" to proceed.</p>
            </div>
          )}

          <div>
            <label className="text-slate-400 text-xs mb-2 block font-medium">Day Type</label>
            <div className="flex gap-1.5">{TYPES.map(typeBtn)}</div>
          </div>

          {type === 'LEAVE' && (
            <div>
              <label className="text-slate-400 text-xs mb-2 block font-medium">Leave Type</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Select leave type...</option>
                {company?.leaveTypes?.map(lt => <option key={lt.key} value={lt.key}>{lt.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-slate-400 text-xs mb-2 block font-medium">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-6 lg:pb-5 pt-0" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {entry && (
            <button onClick={() => { onDelete(toDateStr(date)); toast.info('Removed', `Entry cleared for ${format(date, 'MMM d')}`); onClose(); }}
              className="w-12 h-12 flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex-shrink-0 active:bg-red-500/20">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl text-sm font-medium active:bg-slate-600">
            Cancel
          </button>
          <button onClick={handleSaveClick} disabled={loading}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50
              ${pendingSave ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'}`}>
            {loading ? 'Saving...' : pendingSave ? 'Save Anyway' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [company, setCompany] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const today = toDateStr(now);
  const toast = useToast();
  const { entryMap, loading, addEntry, removeEntry, bulkSetWfh, getSuggestions } = useCalendar(year, month);

  useEffect(() => { api.get('/company').then(r => setCompany(r.data)).catch(() => {}); }, []);

  const grid = getCalendarGrid(year, month);
  const wfhCount = Object.values(entryMap).filter(e => e.type === 'WFH').length;
  const quota = company?.wfhPerMonth || 8;

  const navigate = (dir) => {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const autoSuggest = async () => {
    setSuggesting(true);
    try {
      const dates = await getSuggestions();
      if (!dates.length) {
        toast.info('Nothing to fill', 'Quota already met or no working days left.');
        return;
      }
      await bulkSetWfh(dates);
      toast.success('WFH days filled!', `${dates.length} days added for ${MONTH_NAMES_FULL[month-1]}`);
    } catch (err) {
      toast.error('Auto-fill failed', err.response?.data?.message || 'Something went wrong');
    } finally { setSuggesting(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3 max-w-2xl lg:max-w-5xl mx-auto lg:mx-0">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 rounded-xl text-slate-400 active:bg-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-base lg:text-xl font-bold text-white leading-tight">
              {MONTH_NAMES_FULL[month-1]} {year}
            </h1>
            <p className="text-slate-500 text-xs">{wfhCount}/{quota} WFH days</p>
          </div>
          <button onClick={() => navigate(1)} className="p-2 bg-slate-800 rounded-xl text-slate-400 active:bg-slate-700">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={autoSuggest} disabled={suggesting || wfhCount >= quota}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold active:bg-blue-700 flex-shrink-0">
            <Wand2 className="w-3.5 h-3.5" />
            <span>{suggesting ? 'Filling...' : 'Auto-fill'}</span>
          </button>
        </div>
        <div className="max-w-2xl lg:max-w-5xl mx-auto lg:mx-0 mt-2">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100,(wfhCount/quota)*100)}%` }} />
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 px-3 lg:px-6 pt-3 pb-4 max-w-2xl lg:max-w-5xl mx-auto lg:mx-0 w-full">
        <div className="flex gap-3 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: v.color }} />{v.label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] lg:text-xs font-semibold text-slate-600 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) => (
              <DayCell key={i} date={date}
                entry={date ? entryMap[toDateStr(date)] : null}
                company={company} today={today}
                onClick={(d, e) => { setSelectedDate(d); setSelectedEntry(e || null); }} />
            ))}
          </div>
        )}
      </div>

      {selectedDate && (
        <EntryModal
          date={selectedDate}
          entry={selectedEntry}
          company={company}
          toast={toast}
          onClose={() => { setSelectedDate(null); setSelectedEntry(null); }}
          onSave={addEntry}
          onDelete={removeEntry}
        />
      )}
    </div>
  );
}
