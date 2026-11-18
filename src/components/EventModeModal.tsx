import React, { useState, useEffect } from 'react';
import { DayEventInfo } from '../types';
import { cloudDb, formatDisplayDate } from '../db/cloudDatabase';
import { Ticket, MapPin, Banknote, X, CheckCircle2, Trash2 } from 'lucide-react';

interface EventModeModalProps {
  isOpen: boolean;
  dateKey: string;
  currentEvent: DayEventInfo | null;
  onClose: () => void;
}

export const EventModeModal: React.FC<EventModeModalProps> = ({
  isOpen,
  dateKey,
  currentEvent,
  onClose,
}) => {
  const [eventName, setEventName] = useState('');
  const [location, setLocation] = useState('');
  const [tableCost, setTableCost] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEventName(currentEvent?.eventName || '');
      setLocation(currentEvent?.location || '');
      setTableCost(currentEvent?.tableCost ? currentEvent.tableCost.toFixed(2) : '');
      setNotes(currentEvent?.notes || '');
      setError('');
    }
  }, [isOpen, currentEvent, dateKey]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      setError('Enter the Card Show or Event name (e.g. Cardiff Card Show).');
      return;
    }

    const parsedCost = tableCost.trim() ? parseFloat(tableCost) : undefined;
    if (tableCost.trim() && (isNaN(parsedCost!) || parsedCost! < 0)) {
      setError('Enter a valid table cost (£0 or more).');
      return;
    }

    setIsSaving(true);
    try {
      await cloudDb.saveDayEvent({
        dateKey,
        isEvent: true,
        eventName: eventName.trim(),
        location: location.trim() || undefined,
        tableCost: parsedCost,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await cloudDb.clearDayEvent(dateKey);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
        <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black truncate">Card Show / Event Mode</h3>
              <p className="text-[11px] text-zinc-400 truncate">{formatDisplayDate(dateKey)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
            aria-label="Close Event Mode dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="input-event-name" className="block text-xs font-bold text-zinc-800">
              Event / Card Show Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-event-name"
              type="text"
              autoFocus
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. London Card Show, Collectormania, Pop-Up..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-zinc-900 focus:outline-hidden text-zinc-950 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="input-event-location" className="block text-xs font-bold text-zinc-800">
                Venue / City (Optional)
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="input-event-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. NEC Birmingham"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-zinc-900 focus:outline-hidden text-zinc-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-event-table-cost" className="block text-xs font-bold text-zinc-800">
                Table / Stall Cost (£)
              </label>
              <div className="relative">
                <Banknote className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="input-event-table-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tableCost}
                  onChange={(e) => setTableCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-zinc-900 focus:outline-hidden text-zinc-900 font-bold tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="input-event-notes" className="block text-xs font-bold text-zinc-800">
              Notes (Optional)
            </label>
            <input
              id="input-event-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Booth #14, weekend show day 1"
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:border-zinc-900 focus:outline-hidden text-zinc-900"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100">
            {currentEvent ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleClear}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Event Tag</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-500">Tracked in Leaderboard comparisons</span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{currentEvent ? 'Update Event' : 'Tag as Event'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
