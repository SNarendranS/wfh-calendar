import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Wand2, Trash2, X, AlertTriangle, Info } from 'lucide-react';
import { useCalendar } from '../../hooks/useCalendar.js';
import { getCalendarGrid, DAY_NAMES, toDateStr, TYPE_CONFIG, MONTH_NAMES_FULL, isWeekend } from '../../utils/dateHelpers.js';
import api from '../../utils/api.js';

const TYPES = ['WFH', 'LEAVE', 'HOLIDAY', 'OFFICE'];

function DayCell({ date, entry, company, onClick, today }) {
  if (!date) return <div className="h-20 bg-slate-900/30 rounded-lg" />;
  const ds = toDateStr(date);
  const isToday = ds === today;
  const weekend = isWeekend(date);
  const holiday = company?.publicHolidays?.find(h => h.date === ds);
  const cfg = entry ? TYPE_CONFIG[entry.type] : null;

  return (
    <div onClick={() => onClick(date, entry)}
      className={`h-20 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] relative overflow-hidden
        ${isToday ? 'ring-2 ring-blue-500' : ''}
        ${weekend && !entry ? 'bg-slate-800/40 border-slate-700/40' : !entry ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : `${cfg.bg} border-${cfg.border.replace('border-','')}`}
        ${cfg ? cfg.border : ''}
      `}>
      <div className="p-2">
        <span className={`text-xs font-bold ${isToday ? 'text-blue-400' : weekend ? 'text-slate-500' : 'text-slate-300'}`}>
          {date.getDate()}
        </span>
        {holiday && !entry && (
          <div className="mt-1">
            <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1 py-0.5 rounded truncate block">{holiday.name}</span>
          </div>
        )}
        {entry && (
          <div className="mt-1">
            <span className={`text-[10px] font-semibold ${cfg.text} block truncate`}>
              {entry.type}{entry.leaveType ? ` · ${entry.leaveType}` : ''}
            </span>
            {entry.note && <span className="text-[9px] text-slate-500 block truncate">{entry.note}</span>}
          </div>
        )}
      </div>
      {isToday && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />}
    </div>
  );
}

function EntryModal({ date, entry, company, onClose, onSave, onDelete }) {
  const [type, setType] = useState(entry?.type || 'WFH');
  const [leaveType, setLeaveType] = useState(entry?.leaveType || '');
  const [note, setNote] = useState(entry?.note || '');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);

  const save = async () => {
    setLoading(true);
    try {
      const result = await onSave(toDateStr(date), type, leaveType || undefined, note || undefined);
      if (result?.warnings?.length) { setWarnings(result.warnings); return; }
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving');
    } finally { setLoading(false); }
  };

  const btnCls = (t) => `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${type===t ? `${TYPE_CONFIG[t].bg} ${TYPE_CONFIG[t].border} ${TYPE_CONFIG[t].text}` : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h3 className="text-white font-semibold">{format(date, 'EEEE, MMM d yyyy')}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{entry ? 'Edit entry' : 'Add entry'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-xs">{w.message}</p>
                </div>
              ))}
              <p className="text-amber-400/60 text-xs mt-2">Save anyway?</p>
            </div>
          )}
          <div>
            <label className="text-slate-400 text-xs mb-2 block">Day Type</label>
            <div className="flex flex-wrap gap-2">{TYPES.map(t => <button key={t} onClick={() => setType(t)} className={btnCls(t)}>{t}</button>)}</div>
          </div>
          {type === 'LEAVE' && (
            <div>
              <label className="text-slate-400 text-xs mb-2 block">Leave Type</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Select...</option>
                {company?.leaveTypes?.map(lt => <option key={lt.key} value={lt.key}>{lt.label}</option>)}
              </select>
            </div>
          )}
          {type === 'HOLIDAY' && (
            <div>
              <label className="text-slate-400 text-xs mb-2 block">Holiday Name</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Republic Day"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          )}
          <div>
            <label className="text-slate-400 text-xs mb-2 block">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          {entry && (
            <button onClick={() => { onDelete(toDateStr(date)); onClose(); }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">Cancel</button>
          <button onClick={save} disabled={loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition">
            {loading ? 'Saving...' : warnings.length ? 'Save Anyway' : 'Save'}
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
  const { entryMap, loading, addEntry, removeEntry, bulkSetWfh, getSuggestions } = useCalendar(year, month);

  useEffect(() => { api.get('/company').then(r => setCompany(r.data)).catch(() => {}); }, []);

  const grid = getCalendarGrid(year, month);

  const navigate = (dir) => {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const autoSuggest = async () => {
    setSuggesting(true);
    try {
      const dates = await getSuggestions();
      if (dates.length === 0) { alert('No WFH slots available (quota full or no working days left)'); return; }
      await bulkSetWfh(dates);
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
    finally { setSuggesting(false); }
  };

  const wfhCount = Object.values(entryMap).filter(e => e.type === 'WFH').length;
  const quota = company?.wfhPerMonth || 8;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"><ChevronLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-white">{MONTH_NAMES_FULL[month-1]} {year}</h1>
            <p className="text-slate-400 text-sm">{wfhCount}/{quota} WFH days used</p>
          </div>
          <button onClick={() => navigate(1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={autoSuggest} disabled={suggesting || wfhCount >= quota}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition">
            <Wand2 className="w-4 h-4" />{suggesting ? 'Suggesting...' : 'Auto-Fill WFH'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: v.color }} />{v.label}
          </div>
        ))}
      </div>

      {/* WFH progress bar */}
      <div className="mb-5 bg-slate-800 rounded-lg p-3 border border-slate-700">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>WFH Quota</span><span>{wfhCount}/{quota}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100,(wfhCount/quota)*100)}%` }} />
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) => (
              <DayCell key={i} date={date} entry={date ? entryMap[toDateStr(date)] : null}
                company={company} today={today}
                onClick={(d, e) => { setSelectedDate(d); setSelectedEntry(e || null); }} />
            ))}
          </div>
        </>
      )}

      {selectedDate && (
        <EntryModal date={selectedDate} entry={selectedEntry} company={company}
          onClose={() => { setSelectedDate(null); setSelectedEntry(null); }}
          onSave={addEntry} onDelete={removeEntry} />
      )}
    </div>
  );
}
