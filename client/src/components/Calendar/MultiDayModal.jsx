import { useState, useMemo } from 'react';
import { format, parseISO, eachDayOfInterval, isValid, addDays } from 'date-fns';
import {
  X, CalendarRange, Sun, Moon, Split, AlertTriangle,
  CheckCircle2, Trash2, ShieldAlert, Sparkles, Clock
} from 'lucide-react';
import { TYPE_CONFIG, toDateStr } from '../../utils/dateHelpers.js';

const ACTION_TYPES = ['WFH', 'LEAVE', 'REMOTE', 'OFFICE', 'CLEAR'];

export default function MultiDayModal({ company, initialDate, initialStartDate, initialEndDate, onClose, onSubmit, toast }) {
  const defaultStart = initialStartDate || (initialDate ? toDateStr(initialDate) : toDateStr(new Date()));
  const defaultEnd = initialEndDate || defaultStart;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [type, setType] = useState('LEAVE');
  const [leaveType, setLeaveType] = useState(company?.leaveTypes?.[0]?.key || 'PL');

  // Boundary session configurations
  // startSession: 'FULL' | 'SECOND_HALF' (Starts PM)
  const [startSession, setStartSession] = useState('FULL');
  // endSession: 'FULL' | 'FIRST_HALF' (Ends AM)
  const [endSession, setEndSession] = useState('FULL');

  // For single-day mode: 'FULL' | 'FIRST_HALF' | 'SECOND_HALF' | 'CUSTOM_SPLIT'
  const [singleDayMode, setSingleDayMode] = useState('FULL');
  const [secondHalfType, setSecondHalfType] = useState('OFFICE');
  const [secondHalfLeaveType, setSecondHalfLeaveType] = useState('');

  const [skipWeekends, setSkipWeekends] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);

  const isSingleDay = startDate === endDate;

  // Set of holiday dates
  const holidayDateSet = useMemo(() => {
    return new Set((company?.publicHolidays || []).map(h => h.date));
  }, [company]);

  // Selected leave configs
  const selectedLtConfig = useMemo(() => {
    return company?.leaveTypes?.find(l => l.key === leaveType);
  }, [company, leaveType]);

  const selectedSecondLtConfig = useMemo(() => {
    return company?.leaveTypes?.find(l => l.key === secondHalfLeaveType);
  }, [company, secondHalfLeaveType]);

  // Compute date breakdown
  const preview = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);

    if (!isValid(startObj) || !isValid(endObj) || startObj > endObj) {
      return { invalid: true, error: 'Start date must be before or equal to end date' };
    }

    const intervalDates = eachDayOfInterval({ start: startObj, end: endObj });
    if (intervalDates.length > 90) {
      return { invalid: true, error: 'Maximum range is 90 days' };
    }

    let activeDays = [];
    let skippedWeekends = 0;
    let skippedHolidays = 0;

    for (const dObj of intervalDates) {
      const ds = format(dObj, 'yyyy-MM-dd');
      const dayOfWeek = dObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidayDateSet.has(ds);

      if (skipWeekends && isWeekend) {
        skippedWeekends++;
        continue;
      }
      if (skipHolidays && isHoliday) {
        skippedHolidays++;
        continue;
      }

      let sessionLabel = 'Full Day (1.0)';
      let weight = 1.0;
      let isHalf = false;

      if (isSingleDay) {
        if (singleDayMode === 'FIRST_HALF') {
          sessionLabel = 'AM Half (0.5)';
          weight = 0.5;
          isHalf = true;
        } else if (singleDayMode === 'SECOND_HALF') {
          sessionLabel = 'PM Half (0.5)';
          weight = 0.5;
          isHalf = true;
        } else if (singleDayMode === 'CUSTOM_SPLIT') {
          sessionLabel = 'Split AM/PM (1.0)';
          weight = 1.0;
          isHalf = true;
        }
      } else {
        if (ds === startDate && startSession === 'SECOND_HALF') {
          sessionLabel = 'Starts PM (0.5)';
          weight = 0.5;
          isHalf = true;
        } else if (ds === endDate && endSession === 'FIRST_HALF') {
          sessionLabel = 'Ends AM (0.5)';
          weight = 0.5;
          isHalf = true;
        }
      }

      activeDays.push({
        dateStr: ds,
        dateObj: dObj,
        label: format(dObj, 'EEE, MMM d'),
        sessionLabel,
        weight,
        isHalf
      });
    }

    const totalCount = activeDays.reduce((sum, d) => sum + d.weight, 0);

    return {
      invalid: false,
      activeDays,
      totalCount,
      skippedWeekends,
      skippedHolidays,
      hasHalfDays: activeDays.some(d => d.isHalf)
    };
  }, [startDate, endDate, isSingleDay, startSession, endSession, singleDayMode, skipWeekends, skipHolidays, holidayDateSet]);

  // Validate if chosen leave allows half day
  const isInvalidLeaveHalfDay = useMemo(() => {
    if (type !== 'LEAVE' || !preview?.hasHalfDays || !selectedLtConfig) return false;
    return selectedLtConfig.allowHalfDay === false;
  }, [type, preview, selectedLtConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!preview || preview.invalid || preview.activeDays.length === 0) {
      toast.error('Invalid selection', preview?.error || 'No active dates to update');
      return;
    }

    if (isInvalidLeaveHalfDay) {
      toast.error('Invalid leave configuration', `${selectedLtConfig.label} does not permit half-day bookings.`);
      return;
    }

    setLoading(true);
    setWarnings([]);

    try {
      const payload = {
        startDate,
        endDate,
        type,
        leaveType: type === 'LEAVE' ? leaveType : undefined,
        startSession: isSingleDay ? undefined : startSession,
        endSession: isSingleDay ? undefined : endSession,
        singleDayMode: isSingleDay ? singleDayMode : undefined,
        secondHalfType: isSingleDay && singleDayMode === 'CUSTOM_SPLIT' ? secondHalfType : undefined,
        secondHalfLeaveType: isSingleDay && singleDayMode === 'CUSTOM_SPLIT' && secondHalfType === 'LEAVE' ? secondHalfLeaveType : undefined,
        skipWeekends,
        skipHolidays,
        note: note.trim() || undefined
      };

      const result = await onSubmit(payload);
      if (result?.warnings?.length) {
        setWarnings(result.warnings);
      }
      toast.success('Schedule updated!', `${result.count} day(s) marked as ${type}.`);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update schedule';
      toast.error('Scheduling error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-slate-800 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Multi-Day Schedule</h2>
              <p className="text-slate-400 text-xs mt-0.5">Mark a continuous date range with custom half-day boundaries</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 lg:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Date Range Selectors */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5 flex items-center gap-1.5">
                <span>From Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5 flex items-center gap-1.5">
                <span>To Date</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Boundary Half-Day Customization */}
          {!isSingleDay ? (
            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Boundary Sessions (Half-Day Customization)
                </span>
                <span className="text-[11px] text-slate-400">Intermediate days: Full Day</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Start Day Boundary */}
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/70">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1.5 truncate">
                    Start ({startDate})
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setStartSession('FULL')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold transition ${
                        startSession === 'FULL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}>
                      Full Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartSession('SECOND_HALF')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        startSession === 'SECOND_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}>
                      <Moon className="w-3 h-3" /> Starts PM
                    </button>
                  </div>
                  {startSession === 'SECOND_HALF' && (
                    <p className="text-[10px] text-amber-300/80 mt-1">Morning defaults to Office</p>
                  )}
                </div>

                {/* End Day Boundary */}
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/70">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1.5 truncate">
                    End ({endDate})
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setEndSession('FULL')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold transition ${
                        endSession === 'FULL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}>
                      Full Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSession('FIRST_HALF')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        endSession === 'FIRST_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}>
                      <Sun className="w-3 h-3" /> Ends AM
                    </button>
                  </div>
                  {endSession === 'FIRST_HALF' && (
                    <p className="text-[10px] text-amber-300/80 mt-1">Afternoon defaults to Office</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Single Day Mode */
            <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Single Day Duration ({startDate})
              </label>
              <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSingleDayMode('FULL')}
                  className={`py-1.5 px-1 text-[11px] font-semibold rounded transition ${
                    singleDayMode === 'FULL' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}>
                  Full Day
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('FIRST_HALF')}
                  className={`py-1.5 px-1 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'FIRST_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400'
                  }`}>
                  <Sun className="w-3 h-3" /> AM (0.5)
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('SECOND_HALF')}
                  className={`py-1.5 px-1 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'SECOND_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400'
                  }`}>
                  <Moon className="w-3 h-3" /> PM (0.5)
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('CUSTOM_SPLIT')}
                  className={`py-1.5 px-1 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'CUSTOM_SPLIT' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}>
                  <Split className="w-3 h-3" /> Split
                </button>
              </div>
            </div>
          )}

          {/* Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Mark As
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {ACTION_TYPES.map(t => {
                const isClear = t === 'CLEAR';
                const active = type === t;
                const cfg = TYPE_CONFIG[t] || { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' };

                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition text-center ${
                      active
                        ? isClear
                          ? 'bg-red-500/20 border-red-500 text-red-400 ring-1 ring-red-500'
                          : `${cfg.bg} ${cfg.border} ${cfg.text} ring-1 ring-blue-500`
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}>
                    {isClear ? (
                      <span className="flex items-center justify-center gap-1">
                        <Trash2 className="w-3 h-3" /> Clear
                      </span>
                    ) : (
                      t
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leave Type Sub-selection */}
          {type === 'LEAVE' && (
            <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-800/40 space-y-2">
              <label className="text-xs font-semibold text-emerald-300 block">
                Leave Type Category
              </label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500">
                {company?.leaveTypes?.map(lt => {
                  const allowsHalf = lt.allowHalfDay !== false;
                  return (
                    <option key={lt.key} value={lt.key}>
                      {lt.label} ({lt.key}) {allowsHalf ? '— ½ day allowed' : '— Full day only'}
                    </option>
                  );
                })}
              </select>

              {isInvalidLeaveHalfDay && (
                <div className="flex items-center gap-1.5 text-amber-400 text-xs pt-1">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Warning: <strong>{selectedLtConfig?.label}</strong> cannot be taken as a half-day leave.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Filter Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-700/60">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={e => setSkipWeekends(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>Skip Weekends (Sat & Sun)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={skipHolidays}
                onChange={e => setSkipHolidays(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>Skip Public Holidays</span>
            </label>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Note / Purpose (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Annual Vacation, Family visit, Road trip"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Live Breakdown Preview */}
          {preview && !preview.invalid && (
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Schedule Summary
                </span>
                <span className="text-xs font-extrabold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                  {preview.totalCount} Day(s) Total
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <p>
                  Applying <strong className="text-white">{type}</strong> to{' '}
                  <span className="text-blue-300 font-semibold">{preview.activeDays.length} working date(s)</span>.
                </p>
                {(preview.skippedWeekends > 0 || preview.skippedHolidays > 0) && (
                  <p className="text-slate-500 text-[10px]">
                    Skipped: {preview.skippedWeekends > 0 ? `${preview.skippedWeekends} weekend day(s)` : ''}
                    {preview.skippedWeekends > 0 && preview.skippedHolidays > 0 ? ', ' : ''}
                    {preview.skippedHolidays > 0 ? `${preview.skippedHolidays} public holiday(s)` : ''}.
                  </p>
                )}
              </div>

              {/* Day Pills Preview */}
              <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                {preview.activeDays.map(d => (
                  <span
                    key={d.dateStr}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-700">
                    <span>{d.label}:</span>
                    <span className={d.isHalf ? 'text-amber-400 font-semibold' : 'text-blue-400'}>
                      {d.sessionLabel}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {preview?.invalid && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{preview.error}</span>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-700/80 bg-slate-900/50 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || preview?.invalid || preview?.activeDays?.length === 0 || isInvalidLeaveHalfDay}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-1.5">
            {loading ? (
              <span>Applying...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply to {preview?.totalCount || 0} Day(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
