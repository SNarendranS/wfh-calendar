import { useState, useMemo } from 'react';
import { format, parseISO, eachDayOfInterval, isValid, addDays } from 'date-fns';
import { X, Sun, Moon, Split, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { TYPE_CONFIG, toDateStr } from '../../utils/dateHelpers.js';

const ACTION_TYPES = ['WFH', 'LEAVE', 'REMOTE', 'OFFICE', 'CLEAR'];

export default function MultiDayModal({
  company,
  initialDate,
  initialStartDate,
  initialEndDate,
  onClose,
  onSubmit,
  toast
}) {
  const defaultStart = initialStartDate || (initialDate ? toDateStr(initialDate) : toDateStr(new Date()));
  const defaultEnd = initialEndDate || defaultStart;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [type, setType] = useState('WFH');
  const [leaveType, setLeaveType] = useState(company?.leaveTypes?.[0]?.key || 'PL');

  // Boundary sessions
  const [startSession, setStartSession] = useState('FULL'); // 'FULL' | 'SECOND_HALF'
  const [endSession, setEndSession] = useState('FULL');     // 'FULL' | 'FIRST_HALF'
  const [singleDayMode, setSingleDayMode] = useState('FULL'); // 'FULL' | 'FIRST_HALF' | 'SECOND_HALF' | 'CUSTOM_SPLIT'
  const [secondHalfType, setSecondHalfType] = useState('OFFICE');
  const [secondHalfLeaveType, setSecondHalfLeaveType] = useState('');

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const isSingleDay = startDate === endDate;

  // Use global company defaults for weekend/holiday skips
  const skipWeekends = company?.skipWeekendsOnMultiDay !== undefined ? company.skipWeekendsOnMultiDay : true;
  const skipHolidays = company?.skipHolidaysOnMultiDay !== undefined ? company.skipHolidaysOnMultiDay : true;

  const holidayDateSet = useMemo(() => {
    return new Set((company?.publicHolidays || []).map(h => h.date));
  }, [company]);

  const selectedLtConfig = useMemo(() => {
    return company?.leaveTypes?.find(l => l.key === leaveType);
  }, [company, leaveType]);

  // Compute accurate active days
  const preview = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);

    if (!isValid(startObj) || !isValid(endObj) || startObj > endObj) {
      return { invalid: true, error: 'Start date must be on or before end date' };
    }

    const intervalDates = eachDayOfInterval({ start: startObj, end: endObj });
    if (intervalDates.length > 90) {
      return { invalid: true, error: 'Maximum selection is 90 days' };
    }

    const activeDays = [];
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

      let label = 'Full (1.0)';
      let weight = 1.0;
      let isHalf = false;

      if (isSingleDay) {
        if (singleDayMode === 'FIRST_HALF') {
          label = 'AM (0.5)';
          weight = 0.5;
          isHalf = true;
        } else if (singleDayMode === 'SECOND_HALF') {
          label = 'PM (0.5)';
          weight = 0.5;
          isHalf = true;
        } else if (singleDayMode === 'CUSTOM_SPLIT') {
          label = 'Split (1.0)';
          weight = 1.0;
          isHalf = true;
        }
      } else {
        if (ds === startDate) {
          if (startSession === 'FIRST_HALF') {
            label = 'AM (0.5)';
            weight = 0.5;
            isHalf = true;
          } else if (startSession === 'SECOND_HALF') {
            label = 'PM (0.5)';
            weight = 0.5;
            isHalf = true;
          }
        } else if (ds === endDate) {
          if (endSession === 'FIRST_HALF') {
            label = 'AM (0.5)';
            weight = 0.5;
            isHalf = true;
          } else if (endSession === 'SECOND_HALF') {
            label = 'PM (0.5)';
            weight = 0.5;
            isHalf = true;
          }
        }
      }

      activeDays.push({
        dateStr: ds,
        label: format(dObj, 'MMM d'),
        sessionLabel: label,
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

  const isInvalidLeaveHalfDay = useMemo(() => {
    if (type !== 'LEAVE' || !preview?.hasHalfDays || !selectedLtConfig) return false;
    return selectedLtConfig.allowHalfDay === false;
  }, [type, preview, selectedLtConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!preview || preview.invalid || preview.activeDays.length === 0) {
      toast.error('Invalid selection', preview?.error || 'No active working days selected');
      return;
    }

    if (isInvalidLeaveHalfDay) {
      toast.error('Invalid leave configuration', `${selectedLtConfig.label} cannot be taken as half-day.`);
      return;
    }

    setLoading(true);
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
      toast.success('Schedule saved!', `${result.count} day(s) marked as ${type}`);
      onClose();
    } catch (err) {
      toast.error('Error saving', err.response?.data?.message || 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const activeColor = TYPE_CONFIG[type]?.color || '#3b82f6';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full sm:max-w-md bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Mobile Pull Bar */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold text-sm">
              {isSingleDay ? 'Set Single Day' : 'Mark Date Range'}
            </h2>
            {preview && !preview.invalid && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {preview.totalCount} {preview.totalCount === 1 ? 'day' : 'days'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {/* Compact Inline Date Pickers */}
          <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Boundary Half-Day Toggle */}
          {!isSingleDay ? (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300 block">
                Half-Day Boundaries
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Start day */}
                <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1 truncate">
                    Start ({format(parseISO(startDate), 'MMM d')})
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setStartSession('FULL')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded transition ${
                        startSession === 'FULL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      Full (1.0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartSession('FIRST_HALF')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded flex items-center justify-center gap-0.5 transition ${
                        startSession === 'FIRST_HALF' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      <Sun className="w-2.5 h-2.5" /> AM (½)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartSession('SECOND_HALF')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded flex items-center justify-center gap-0.5 transition ${
                        startSession === 'SECOND_HALF' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      <Moon className="w-2.5 h-2.5" /> PM (½)
                    </button>
                  </div>
                </div>

                {/* End day */}
                <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1 truncate">
                    End ({format(parseISO(endDate), 'MMM d')})
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEndSession('FULL')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded transition ${
                        endSession === 'FULL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      Full (1.0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSession('FIRST_HALF')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded flex items-center justify-center gap-0.5 transition ${
                        endSession === 'FIRST_HALF' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      <Sun className="w-2.5 h-2.5" /> AM (½)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSession('SECOND_HALF')}
                      className={`py-1 text-[10px] sm:text-[11px] font-medium rounded flex items-center justify-center gap-0.5 transition ${
                        endSession === 'SECOND_HALF' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400'
                      }`}>
                      <Moon className="w-2.5 h-2.5" /> PM (½)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300 block">
                Session ({format(parseISO(startDate), 'MMM d')})
              </label>
              <div className="grid grid-cols-4 gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setSingleDayMode('FULL')}
                  className={`py-1.5 text-[11px] font-semibold rounded-lg transition ${
                    singleDayMode === 'FULL' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}>
                  Full (1.0)
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('FIRST_HALF')}
                  className={`py-1.5 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'FIRST_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400'
                  }`}>
                  <Sun className="w-3 h-3" /> AM
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('SECOND_HALF')}
                  className={`py-1.5 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'SECOND_HALF' ? 'bg-amber-600 text-white' : 'text-slate-400'
                  }`}>
                  <Moon className="w-3 h-3" /> PM
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDayMode('CUSTOM_SPLIT')}
                  className={`py-1.5 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition ${
                    singleDayMode === 'CUSTOM_SPLIT' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}>
                  <Split className="w-3 h-3" /> Split
                </button>
              </div>
            </div>
          )}

          {/* Activity Type Segmented Control */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300 block">Activity</label>
            <div className="grid grid-cols-5 gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
              {ACTION_TYPES.map(t => {
                const active = type === t;
                const isClear = t === 'CLEAR';

                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-1.5 text-[11px] font-semibold rounded-lg transition text-center ${
                      active
                        ? isClear
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}>
                    {isClear ? (
                      <span className="flex items-center justify-center gap-0.5">
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
            <div className="space-y-1 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-800/40">
              <label className="text-[10px] font-semibold text-emerald-300 block">Leave Type</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500">
                {company?.leaveTypes?.map(lt => {
                  const allowsHalf = lt.allowHalfDay !== false;
                  return (
                    <option key={lt.key} value={lt.key}>
                      {lt.label} ({lt.key}) {allowsHalf ? '· ½ allowed' : '· Full day only'}
                    </option>
                  );
                })}
              </select>

              {isInvalidLeaveHalfDay && (
                <p className="text-[10px] text-amber-400 flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{selectedLtConfig?.label} cannot be taken as half-day.</span>
                </p>
              )}
            </div>
          )}

          {/* Note Input */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Travel, Personal, Appointments"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Concise Info Summary */}
          {preview && !preview.invalid && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span>Summary</span>
                <span className="text-white font-bold">{preview.totalCount} day(s) marked as {type}</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {preview.activeDays.map(d => `${d.label} (${d.sessionLabel})`).join(', ')}
              </p>
              {(preview.skippedWeekends > 0 || preview.skippedHolidays > 0) && (
                <p className="text-[10px] text-slate-500">
                  Settings applied: {preview.skippedWeekends > 0 ? `${preview.skippedWeekends} weekend(s)` : ''}
                  {preview.skippedWeekends > 0 && preview.skippedHolidays > 0 ? ', ' : ''}
                  {preview.skippedHolidays > 0 ? `${preview.skippedHolidays} holiday(s)` : ''} skipped.
                </p>
              )}
            </div>
          )}

          {preview?.invalid && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{preview.error}</span>
            </p>
          )}
        </form>

        {/* Minimal Footer */}
        <div
          className="px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2.5 flex-shrink-0 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none sm:px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition text-center active:scale-[0.98]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || preview?.invalid || preview?.activeDays?.length === 0 || isInvalidLeaveHalfDay}
            className="flex-[2] sm:flex-none sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 active:scale-[0.98]">
            {loading ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Apply {preview?.totalCount || 0} Day(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
