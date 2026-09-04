import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Wand2, Trash2, X, AlertTriangle, Monitor, ArrowLeft, Lock, User, Clock, Sun, Moon, Split, CalendarRange } from 'lucide-react';
import { useCalendar } from '../../hooks/useCalendar.js';
import { useToast } from '../Layout/Toast.jsx';
import { getCalendarGrid, DAY_NAMES, toDateStr, TYPE_CONFIG, MONTH_NAMES_FULL, isWeekend, formatDayCount, getEntryDisplayInfo } from '../../utils/dateHelpers.js';
import api from '../../utils/api.js';
import MultiDayModal from './MultiDayModal.jsx';

const TYPES = ['WFH', 'LEAVE', 'HOLIDAY', 'REMOTE', 'OFFICE'];

function DayCell({
  date,
  entry,
  company,
  onClick,
  today,
  isInRange,
  isRangeStart,
  isRangeEnd,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  onTouchStart
}) {
  if (!date) return <div className="aspect-square bg-slate-900/20 rounded-lg lg:h-20" />;
  const ds = toDateStr(date);
  const isToday = ds === today;
  const weekend = isWeekend(date);
  const holiday = company?.publicHolidays?.find(h => h.date === ds);
  const isWorkingDay = company?.workingDays?.includes(date.getDay() === 0 ? 7 : date.getDay());
  const defaultOffice = !entry && !weekend && !holiday && isWorkingDay;

  const displayInfo = getEntryDisplayInfo(entry, company);
  const cfg = entry ? TYPE_CONFIG[entry.type] : null;

  return (
    <div
      data-date={ds}
      onMouseDown={(e) => onMouseDown?.(date, e)}
      onMouseEnter={() => onMouseEnter?.(date)}
      onMouseUp={(e) => onMouseUp?.(date, e)}
      onTouchStart={(e) => onTouchStart?.(date, e)}
      onClick={(e) => onClick?.(date, entry, e)}
      className={`aspect-square lg:aspect-auto lg:h-20 rounded-lg lg:rounded-xl border cursor-pointer transition-all active:scale-95 lg:hover:scale-[1.02] relative overflow-hidden select-none
        ${isInRange
          ? 'bg-blue-600/35 border-blue-400 ring-2 ring-blue-500/80 shadow-lg z-20 scale-[1.02]'
          : isToday
            ? 'ring-2 ring-blue-500'
            : ''
        }
        ${!isInRange && weekend && !entry ? 'bg-slate-800/30 border-slate-700/30' : 
          !isInRange && defaultOffice ? 'bg-slate-800/60 border-slate-700/30' :
          !isInRange && !entry ? 'bg-slate-800 border-slate-700' :
          !isInRange && entry?.isHalfDay ? 'bg-slate-800/90 border-slate-600/60' :
          !isInRange && entry ? `${cfg.bg} ${cfg.border}` : ''}
      `}>
      {/* Visual indicator bar for cells in selected drag range */}
      {isInRange && (
        <div className="absolute top-0 inset-x-0 h-1 bg-blue-400 pointer-events-none z-20" />
      )}
      {/* Background split gradient for half-day */}
      {entry && entry.isHalfDay && (
        <div className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            background: entry.halfDaySession === 'SECOND_HALF'
              ? `linear-gradient(to right, #64748b 50%, ${displayInfo.secondHalf.cfg.color} 50%)`
              : `linear-gradient(to right, ${displayInfo.firstHalf.cfg.color} 50%, ${displayInfo.secondHalf.cfg.color} 50%)`
          }}
        />
      )}

      <div className="p-1 lg:p-2 h-full flex flex-col relative z-10">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] lg:text-xs font-bold ${
            isInRange ? 'text-white' : isToday ? 'text-blue-400' : weekend ? 'text-slate-600' : 'text-slate-300'
          }`}>
            {date.getDate()}
          </span>
          {isRangeStart && (
            <span className="text-[7px] font-extrabold px-1 rounded bg-blue-500 text-white uppercase hidden lg:inline-block">
              Start
            </span>
          )}
          {isRangeEnd && !isRangeStart && (
            <span className="text-[7px] font-extrabold px-1 rounded bg-blue-500 text-white uppercase hidden lg:inline-block">
              End
            </span>
          )}
          {entry?.isHalfDay && !isInRange && (
            <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-slate-700/80 text-amber-300 hidden lg:inline-block">
              ½ DAY
            </span>
          )}
        </div>

        {/* Mobile Dot Indicators */}
        {entry && !entry.isHalfDay && (
          <div className="flex-1 flex items-center justify-center lg:hidden mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
          </div>
        )}
        {entry && entry.isHalfDay && (
          <div className="flex-1 flex items-center justify-center gap-0.5 lg:hidden mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: displayInfo.firstHalf.cfg.color }} />
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: displayInfo.secondHalf.cfg.color }} />
          </div>
        )}

        {/* Desktop Detailed Labels */}
        {entry && !entry.isHalfDay && (
          <div className="hidden lg:block mt-1">
            <span className={`text-[10px] font-semibold ${cfg.text} block truncate`}>
              {entry.type}{entry.leaveType ? ` · ${entry.leaveType}` : ''}
            </span>
            {entry.note && <span className="text-[9px] text-slate-500 block truncate">{entry.note}</span>}
          </div>
        )}

        {entry && entry.isHalfDay && (
          <div className="hidden lg:block mt-0.5 space-y-0.5">
            <div className="flex items-center gap-1 text-[9px] font-semibold">
              <span className="text-slate-400">AM:</span>
              <span className="truncate" style={{ color: displayInfo.firstHalf.cfg.color }}>
                {displayInfo.firstHalf.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-semibold">
              <span className="text-slate-400">PM:</span>
              <span className="truncate" style={{ color: displayInfo.secondHalf.cfg.color }}>
                {displayInfo.secondHalf.label}
              </span>
            </div>
          </div>
        )}

        {defaultOffice && (
          <div className="hidden lg:block mt-1">
            <span className="text-[10px] text-slate-500/70 block truncate">In Office</span>
          </div>
        )}
        {defaultOffice && (
          <div className="flex-1 flex items-end justify-center lg:hidden">
            <div className="w-1 h-1 rounded-full bg-slate-600/50" />
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
      {isToday && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full z-10" />}
    </div>
  );
}

function EntryModal({ date, entry, company, onClose, onSave, onDelete, onOpenMultiDay, toast }) {
  // Mode: 'FULL' | 'FIRST_HALF' | 'SECOND_HALF' | 'CUSTOM_SPLIT'
  const initialMode = !entry?.isHalfDay
    ? 'FULL'
    : (entry.halfDaySession || 'FIRST_HALF');

  const [mode, setMode] = useState(initialMode);
  const [type, setType] = useState(entry?.type || 'WFH');
  const [leaveType, setLeaveType] = useState(entry?.leaveType || '');
  const [secondHalfType, setSecondHalfType] = useState(entry?.secondHalfType || 'OFFICE');
  const [secondHalfLeaveType, setSecondHalfLeaveType] = useState(entry?.secondHalfLeaveType || '');
  const [note, setNote] = useState(entry?.note || '');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [pendingSave, setPendingSave] = useState(false);

  const isHalfDayMode = mode !== 'FULL';

  // Find if selected leave types permit half day
  const selectedLtConfig = company?.leaveTypes?.find(l => l.key === leaveType);
  const selectedSecondLtConfig = company?.leaveTypes?.find(l => l.key === secondHalfLeaveType);

  const isInvalidFirstLeave = isHalfDayMode && type === 'LEAVE' && selectedLtConfig && selectedLtConfig.allowHalfDay === false;
  const isInvalidSecondLeave = mode === 'CUSTOM_SPLIT' && secondHalfType === 'LEAVE' && selectedSecondLtConfig && selectedSecondLtConfig.allowHalfDay === false;
  const hasLeaveValidationError = isInvalidFirstLeave || isInvalidSecondLeave;

  const doSave = async (force = false) => {
    if (warnings.length > 0 && !force) {
      return;
    }
    if (hasLeaveValidationError) {
      toast.error('Invalid leave type', 'The selected leave type cannot be taken as a half day.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        date: toDateStr(date),
        type,
        leaveType: type === 'LEAVE' ? leaveType : undefined,
        note: note || undefined,
        isHalfDay: isHalfDayMode,
        halfDaySession: isHalfDayMode ? mode : null,
        secondHalfType: mode === 'CUSTOM_SPLIT' ? secondHalfType : (mode === 'FIRST_HALF' ? 'OFFICE' : null),
        secondHalfLeaveType: mode === 'CUSTOM_SPLIT' && secondHalfType === 'LEAVE' ? secondHalfLeaveType : undefined,
      };

      const result = await onSave(payload);
      if (result?.warnings?.length && !pendingSave) {
        setWarnings(result.warnings);
        setPendingSave(true);
        setLoading(false);
        return;
      }
      toast.success('Saved', `${isHalfDayMode ? 'Half-Day ' : ''}${type} set for ${format(date, 'MMM d')}`);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving';
      toast.error('Could not save', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (pendingSave) {
      toast.warning('Saved with warnings', `${type} saved despite preference mismatch`);
      onClose();
    } else {
      doSave();
    }
  };

  const typeBtn = (t, currentType, setTypeFn) => {
    const cfg = TYPE_CONFIG[t];
    const active = currentType === t;
    return (
      <button key={t} onClick={() => { setTypeFn(t); setWarnings([]); setPendingSave(false); }}
        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 ${
          active ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
        {t}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full lg:max-w-md bg-slate-800 rounded-t-3xl lg:rounded-2xl border border-slate-700 shadow-2xl max-h-[90dvh] lg:max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 lg:hidden flex-shrink-0 cursor-grab">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 lg:py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h3 className="text-white font-semibold">{format(date, 'EEE, MMM d yyyy')}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{entry ? 'Edit entry' : 'Add entry'}</p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenMultiDay && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMultiDay(date);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Multi-day</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-700 text-slate-400 active:bg-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
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

          {/* Duration / Session Selector */}
          <div>
            <label className="text-slate-400 text-xs mb-2 block font-medium flex items-center justify-between">
              <span>Duration</span>
              <span className="text-[10px] text-blue-400 font-normal">
                {mode === 'FULL' ? '1.0 Day' : '0.5 Day (Half)'}
              </span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => { setMode('FULL'); setWarnings([]); setPendingSave(false); }}
                className={`py-2 px-1 text-[11px] font-semibold rounded-lg transition ${
                  mode === 'FULL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                Full Day
              </button>
              <button
                type="button"
                onClick={() => { setMode('FIRST_HALF'); setWarnings([]); setPendingSave(false); }}
                className={`py-2 px-1 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                  mode === 'FIRST_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Sun className="w-3 h-3" /> AM Half
              </button>
              <button
                type="button"
                onClick={() => { setMode('SECOND_HALF'); setWarnings([]); setPendingSave(false); }}
                className={`py-2 px-1 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                  mode === 'SECOND_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Moon className="w-3 h-3" /> PM Half
              </button>
              <button
                type="button"
                onClick={() => { setMode('CUSTOM_SPLIT'); setWarnings([]); setPendingSave(false); }}
                className={`py-2 px-1 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                  mode === 'CUSTOM_SPLIT' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Split className="w-3 h-3" /> Split
              </button>
            </div>
          </div>

          {/* First / Primary Half Selection */}
          <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-semibold">
                {mode === 'FULL' ? 'Day Type' : mode === 'SECOND_HALF' ? 'Afternoon (PM) Type' : 'Morning (AM) Type'}
              </label>
              {isHalfDayMode && (
                <span className="text-[10px] text-slate-400">
                  {mode === 'SECOND_HALF' ? 'Morning defaults to Office' : mode === 'FIRST_HALF' ? 'Afternoon defaults to Office' : ''}
                </span>
              )}
            </div>

            <div className="flex gap-1.5">{TYPES.map(t => typeBtn(t, type, setType))}</div>

            {type === 'LEAVE' && (
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block font-medium">Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500">
                  <option value="">Select leave type...</option>
                  {company?.leaveTypes?.map(lt => {
                    const allowsHalf = lt.allowHalfDay !== false;
                    return (
                      <option key={lt.key} value={lt.key}>
                        {lt.label} {isHalfDayMode ? (allowsHalf ? '(½ allowed)' : '(Full day only)') : ''}
                      </option>
                    );
                  })}
                </select>

                {isInvalidFirstLeave && (
                  <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{selectedLtConfig?.label} can only be taken as a full-day leave.</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Secondary Half Selection for Split Day */}
          {mode === 'CUSTOM_SPLIT' && (
            <div className="bg-purple-950/20 p-3 rounded-2xl border border-purple-800/40 space-y-3">
              <label className="text-purple-300 text-xs font-semibold block">
                Afternoon (PM) Type
              </label>
              <div className="flex gap-1.5">{TYPES.map(t => typeBtn(t, secondHalfType, setSecondHalfType))}</div>

              {secondHalfType === 'LEAVE' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block font-medium">PM Leave Type</label>
                  <select value={secondHalfLeaveType} onChange={e => setSecondHalfLeaveType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500">
                    <option value="">Select PM leave type...</option>
                    {company?.leaveTypes?.map(lt => {
                      const allowsHalf = lt.allowHalfDay !== false;
                      return (
                        <option key={lt.key} value={lt.key}>
                          {lt.label} {allowsHalf ? '(½ allowed)' : '(Full day only)'}
                        </option>
                      );
                    })}
                  </select>

                  {isInvalidSecondLeave && (
                    <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{selectedSecondLtConfig?.label} can only be taken as a full-day leave.</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block font-medium">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div 
          className="flex gap-2 px-5 py-3 border-t border-slate-700/80 bg-slate-800 flex-shrink-0 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.4)]" 
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {entry && (
            <button onClick={() => { onDelete(toDateStr(date)); toast.info('Removed', `Entry cleared for ${format(date, 'MMM d')}`); onClose(); }}
              className="w-12 h-11 flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex-shrink-0 active:bg-red-500/20">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-xs font-medium active:bg-slate-600">
            Cancel
          </button>
          <button onClick={handleSaveClick} disabled={loading || hasLeaveValidationError}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50
              ${pendingSave ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'}`}>
            {loading ? 'Saving...' : pendingSave ? 'Save Anyway' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { userId } = useParams();
  const reactNavigate = useNavigate();
  const now = new Date();
  const isReadOnly = !!userId;

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [company, setCompany] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [viewEntries, setViewEntries] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState(null);
  const today = toDateStr(now);
  const toast = useToast();
  const [showMultiDayModal, setShowMultiDayModal] = useState(false);
  const [multiDayRange, setMultiDayRange] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const [lastSelectedDate, setLastSelectedDate] = useState(null);
  const ignoreClickRef = useRef(false);

  const { entryMap, loading, addEntry, removeEntry, bulkSetWfh, getSuggestions, batchMarkDays } = useCalendar(year, month);

  const activeRange = useMemo(() => {
    if (!isDragging || !dragStart || !dragCurrent) return null;
    const start = dragStart < dragCurrent ? dragStart : dragCurrent;
    const end = dragStart < dragCurrent ? dragCurrent : dragStart;
    return { start, end };
  }, [isDragging, dragStart, dragCurrent]);

  const handleCellMouseDown = (date, e) => {
    if (isReadOnly || !date) return;
    if (e.button !== 0) return;
    const ds = toDateStr(date);
    setIsDragging(true);
    setDragMoved(false);
    setDragStart(ds);
    setDragCurrent(ds);
  };

  const handleCellMouseEnter = (date) => {
    if (!isDragging || isReadOnly || !date) return;
    const ds = toDateStr(date);
    if (ds !== dragCurrent) {
      setDragCurrent(ds);
      setDragMoved(true);
    }
  };

  const handleCellMouseUp = (date) => {
    if (!isDragging || isReadOnly) return;
    if (dragMoved && dragStart && dragCurrent && dragStart !== dragCurrent) {
      const start = dragStart < dragCurrent ? dragStart : dragCurrent;
      const end = dragStart < dragCurrent ? dragCurrent : dragStart;
      ignoreClickRef.current = true;
      setTimeout(() => { ignoreClickRef.current = false; }, 200);
      setMultiDayRange({ start, end });
      setShowMultiDayModal(true);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleTouchStart = (date) => {
    if (isReadOnly || !date) return;
    const ds = toDateStr(date);
    setIsDragging(true);
    setDragMoved(false);
    setDragStart(ds);
    setDragCurrent(ds);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el?.closest('[data-date]');
    if (cell && cell.dataset.date && cell.dataset.date !== dragCurrent) {
      setDragCurrent(cell.dataset.date);
      setDragMoved(true);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    if (dragMoved && dragStart && dragCurrent && dragStart !== dragCurrent) {
      const start = dragStart < dragCurrent ? dragStart : dragCurrent;
      const end = dragStart < dragCurrent ? dragCurrent : dragStart;
      ignoreClickRef.current = true;
      setTimeout(() => { ignoreClickRef.current = false; }, 200);
      setMultiDayRange({ start, end });
      setShowMultiDayModal(true);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  useEffect(() => {
    const onGlobalMouseUp = () => {
      if (isDragging) {
        if (dragMoved && dragStart && dragCurrent && dragStart !== dragCurrent) {
          const start = dragStart < dragCurrent ? dragStart : dragCurrent;
          const end = dragStart < dragCurrent ? dragCurrent : dragStart;
          ignoreClickRef.current = true;
          setTimeout(() => { ignoreClickRef.current = false; }, 200);
          setMultiDayRange({ start, end });
          setShowMultiDayModal(true);
        }
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
      }
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [isDragging, dragMoved, dragStart, dragCurrent]);

  const handleCellClick = (date, entry, e) => {
    if (isReadOnly || !date) return;
    if (ignoreClickRef.current) return;

    const ds = toDateStr(date);

    if (e?.shiftKey && lastSelectedDate && lastSelectedDate !== ds) {
      const start = lastSelectedDate < ds ? lastSelectedDate : ds;
      const end = lastSelectedDate < ds ? ds : lastSelectedDate;
      setMultiDayRange({ start, end });
      setShowMultiDayModal(true);
      setLastSelectedDate(ds);
      return;
    }

    setLastSelectedDate(ds);
    setSelectedDate(date);
    setSelectedEntry(entry || null);
  };

  useEffect(() => { api.get('/company').then(r => setCompany(r.data)).catch(() => {}); }, []);

  // Load other user's calendar
  useEffect(() => {
    if (!userId) {
      setViewUser(null);
      setViewEntries(null);
      setViewError(null);
      return;
    }
    setViewLoading(true);
    setViewError(null);
    Promise.all([
      api.get(`/users/${userId}/profile`),
      api.get(`/calendar/user/${userId}`, { params: { year, month } })
    ]).then(([profileRes, calRes]) => {
      if (!calRes.data.visible) {
        setViewError('This calendar is not visible to you.');
        setViewUser(null);
        setViewEntries({});
      } else {
        setViewUser(profileRes.data);
        const map = {};
        (calRes.data.entries || []).forEach(e => { map[e.date] = e; });
        setViewEntries(map);
      }
    }).catch(err => {
      if (err.response?.status === 403) {
        setViewError(err.response.data.message || 'This calendar is private.');
      } else {
        setViewError('Could not load this calendar.');
      }
    }).finally(() => setViewLoading(false));
  }, [userId, year, month]);

  const grid = getCalendarGrid(year, month);
  const currentEntryMap = isReadOnly ? (viewEntries || {}) : entryMap;

  // Accurately compute WFH count with 0.5 weights
  const wfhCount = Object.values(currentEntryMap).reduce((sum, e) => {
    if (!e.isHalfDay) return sum + (e.type === 'WFH' ? 1 : 0);
    let count = 0;
    if (e.type === 'WFH') count += 0.5;
    if (e.secondHalfType === 'WFH') count += 0.5;
    return sum + count;
  }, 0);

  const remoteCount = Object.values(currentEntryMap).reduce((sum, e) => {
    if (!e.isHalfDay) return sum + (e.type === 'REMOTE' ? 1 : 0);
    let count = 0;
    if (e.type === 'REMOTE') count += 0.5;
    if (e.secondHalfType === 'REMOTE') count += 0.5;
    return sum + count;
  }, 0);

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
          {isReadOnly && (
            <button onClick={() => reactNavigate(-1)} className="p-2 bg-slate-800 rounded-xl text-slate-400 active:bg-slate-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 rounded-xl text-slate-400 active:bg-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center lg:text-left">
            {viewUser && (
              <p className="text-xs text-blue-400 font-medium mb-0.5">
                <User className="w-3 h-3 inline mr-1" />{viewUser.displayName || viewUser.username}'s Calendar
              </p>
            )}
            <h1 className="text-base lg:text-xl font-bold text-white leading-tight">
              {MONTH_NAMES_FULL[month-1]} {year}
            </h1>
            {!isReadOnly && (
              <div className="flex items-center justify-center lg:justify-start gap-3 text-xs text-slate-500">
                <span>{formatDayCount(wfhCount)}/{quota} WFH</span>
                {remoteCount > 0 && <span>· {formatDayCount(remoteCount)} Remote</span>}
              </div>
            )}
          </div>
          <button onClick={() => navigate(1)} className="p-2 bg-slate-800 rounded-xl text-slate-400 active:bg-slate-700">
            <ChevronRight className="w-5 h-5" />
          </button>
          {!isReadOnly && (
            <button onClick={autoSuggest} disabled={suggesting || wfhCount >= quota}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold active:bg-blue-700 flex-shrink-0">
              <Wand2 className="w-3.5 h-3.5" />
              <span>{suggesting ? 'Filling...' : 'Auto-fill'}</span>
            </button>
          )}
        </div>
        {!isReadOnly && (
          <div className="max-w-2xl lg:max-w-5xl mx-auto lg:mx-0 mt-2">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100,(wfhCount/quota)*100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Calendar body */}
      <div className="flex-1 px-3 lg:px-6 pt-3 pb-4 max-w-2xl lg:max-w-5xl mx-auto lg:mx-0 w-full">
        {viewError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium text-sm">Calendar not available</p>
              <p className="text-amber-400/70 text-xs mt-0.5">{viewError}</p>
            </div>
          </div>
        )}

        {isReadOnly && viewLoading && (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-2" /> Loading...
          </div>
        )}

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

        {(loading || viewLoading) && !viewError ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-2" /> Loading...
          </div>
        ) : (
          <div
            className="grid grid-cols-7 gap-1 select-none"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}>
            {grid.map((date, i) => {
              if (!date) return <DayCell key={i} date={null} />;
              const ds = toDateStr(date);
              const isInRange = !!(activeRange && ds >= activeRange.start && ds <= activeRange.end);
              const isRangeStart = !!(activeRange && ds === activeRange.start);
              const isRangeEnd = !!(activeRange && ds === activeRange.end);

              return (
                <DayCell
                  key={i}
                  date={date}
                  entry={currentEntryMap[ds]}
                  company={company}
                  today={today}
                  isInRange={isInRange}
                  isRangeStart={isRangeStart}
                  isRangeEnd={isRangeEnd}
                  onMouseDown={handleCellMouseDown}
                  onMouseEnter={handleCellMouseEnter}
                  onMouseUp={handleCellMouseUp}
                  onTouchStart={handleTouchStart}
                  onClick={handleCellClick}
                />
              );
            })}
          </div>
        )}
      </div>

      {!isReadOnly && selectedDate && (
        <EntryModal
          date={selectedDate}
          entry={selectedEntry}
          company={company}
          toast={toast}
          onClose={() => { setSelectedDate(null); setSelectedEntry(null); }}
          onSave={addEntry}
          onDelete={removeEntry}
          onOpenMultiDay={(d) => {
            const startStr = toDateStr(d);
            setMultiDayRange({ start: startStr, end: toDateStr(addDays(d, 2)) });
            setShowMultiDayModal(true);
          }}
        />
      )}

      {!isReadOnly && showMultiDayModal && (
        <MultiDayModal
          company={company}
          initialStartDate={multiDayRange?.start}
          initialEndDate={multiDayRange?.end}
          toast={toast}
          onClose={() => {
            setShowMultiDayModal(false);
            setMultiDayRange(null);
          }}
          onSubmit={batchMarkDays}
        />
      )}

      {/* Floating Drag Indicator */}
      {isDragging && activeRange && activeRange.start !== activeRange.end && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/95 backdrop-blur-md border border-blue-500/60 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-pulse pointer-events-none whitespace-nowrap">
          <CalendarRange className="w-4 h-4 text-blue-400" />
          <span>
            Selecting {format(parseISO(activeRange.start), 'MMM d')} – {format(parseISO(activeRange.end), 'MMM d')} (Release to set)
          </span>
        </div>
      )}
    </div>
  );
}
