import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { FIELD_LIMITS, WASTE_REASONS, type FoodItem, type WasteReason } from '../types';

interface WasteOutcomeModalProps {
  item: FoodItem | null;
  currencyCode: string;
  onClose: () => void;
  onConfirmWaste: (item: FoodItem, reason: WasteReason, notes: string) => Promise<void>;
}

export const WasteOutcomeModal: React.FC<WasteOutcomeModalProps> = ({
  item,
  currencyCode,
  onClose,
  onConfirmWaste,
}) => {
  const [reason, setReason] = useState<WasteReason>('Expired');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setReason('Expired');
      setNotes('');
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirmWaste(item, reason, notes);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waste-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="waste-modal-title" className="font-display text-base font-semibold text-slate-900">
            Log Food Waste
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            <div className="font-medium text-slate-900">{item.name}</div>
            <div className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
              {item.quantity} {item.unit} · {formatCurrency(item.estimatedCost, currencyCode)} value · {item.category}
            </div>
          </div>

          <div>
            <label htmlFor="waste-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
              Primary Waste Reason
            </label>
            <select
              id="waste-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as WasteReason)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="waste-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              id="waste-notes"
              rows={2}
              maxLength={FIELD_LIMITS.LOG_NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Buy smaller pack next grocery run"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Logging...' : 'Confirm Waste Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
