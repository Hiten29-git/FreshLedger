import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { addDaysToToday, getLocalDateString } from '../lib/dateUtils';
import {
  CATEGORIES,
  FIELD_LIMITS,
  STORAGE_LOCATIONS,
  UNITS,
  type FoodCategory,
  type FoodItem,
  type FoodUnit,
  type StorageLocation,
} from '../types';
import type { FoodItemInput } from '../lib/pantryActions';

interface ItemModalProps {
  isOpen: boolean;
  editingItem: FoodItem | null;
  currencyCode: string;
  onClose: () => void;
  onSave: (input: FoodItemInput, editingItem: FoodItem | null) => Promise<void>;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  editingItem,
  currencyCode,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>('Refrigerator');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<FoodUnit>('pcs');
  const [estimatedCost, setEstimatedCost] = useState('5.00');
  const [purchasedAt, setPurchasedAt] = useState(getLocalDateString());
  const [expiresAt, setExpiresAt] = useState(addDaysToToday(7));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setStorageLocation(editingItem.storageLocation);
      setQuantity(String(editingItem.quantity));
      setUnit(editingItem.unit);
      setEstimatedCost(editingItem.estimatedCost.toFixed(2));
      setPurchasedAt(editingItem.purchasedAt);
      setExpiresAt(editingItem.expiresAt);
      setNotes(editingItem.notes);
    } else {
      setName('');
      setCategory('Produce');
      setStorageLocation('Refrigerator');
      setQuantity('1');
      setUnit('pcs');
      setEstimatedCost('5.00');
      setPurchasedAt(getLocalDateString());
      setExpiresAt(addDaysToToday(5));
      setNotes('');
    }
  }, [isOpen, editingItem]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Item name is required.');
      return;
    }
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0 || parsedQty > FIELD_LIMITS.QUANTITY_MAX) {
      setFormError(`Quantity must be between 0.01 and ${FIELD_LIMITS.QUANTITY_MAX}.`);
      return;
    }
    const parsedCost = Number(estimatedCost);
    if (!Number.isFinite(parsedCost) || parsedCost < 0 || parsedCost > FIELD_LIMITS.COST_MAX) {
      setFormError(
        `Estimated value must be between ${formatCurrency(0, currencyCode)} and ${formatCurrency(FIELD_LIMITS.COST_MAX, currencyCode)}.`
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
      setFormError('Please select valid purchase and expiration dates.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onSave(
        {
          name: trimmedName,
          category,
          storageLocation,
          quantity: parsedQty,
          unit,
          estimatedCost: parsedCost,
          purchasedAt,
          expiresAt,
          notes,
        },
        editingItem
      );
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save food item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="item-modal-title" className="font-display text-base font-semibold text-slate-900">
            {editingItem ? 'Edit Food Item' : 'Add Food Item'}
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
          {formError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="item-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Item Name
            </label>
            <input
              id="item-name"
              type="text"
              required
              maxLength={FIELD_LIMITS.NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Organic Baby Spinach"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-category" className="block text-xs font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="item-location" className="block text-xs font-medium text-slate-700 mb-1.5">
                Storage Location
              </label>
              <select
                id="item-location"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value as StorageLocation)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                {STORAGE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="item-qty" className="block text-xs font-medium text-slate-700 mb-1.5">
                Quantity
              </label>
              <input
                id="item-qty"
                type="number"
                step="any"
                min="0.01"
                max={FIELD_LIMITS.QUANTITY_MAX}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="item-unit" className="block text-xs font-medium text-slate-700 mb-1.5">
                Unit
              </label>
              <select
                id="item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as FoodUnit)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="item-cost" className="block text-xs font-medium text-slate-700 mb-1.5">
                Value ({currencyCode} {getCurrencySymbol(currencyCode)})
              </label>
              <input
                id="item-cost"
                type="number"
                step="0.01"
                min="0"
                max={FIELD_LIMITS.COST_MAX}
                required
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-purchased" className="block text-xs font-medium text-slate-700 mb-1.5">
                Purchase Date
              </label>
              <input
                id="item-purchased"
                type="date"
                required
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="item-expires" className="block text-xs font-medium text-slate-700 mb-1.5">
                Expiration Date
              </label>
              <input
                id="item-expires"
                type="date"
                required
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Quick set expiry:</span>
            {[1, 3, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setExpiresAt(addDaysToToday(days))}
                className="px-2.5 py-1 text-xs font-mono tabular-nums text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                +{days}d
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="item-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
              Storage or Usage Notes
            </label>
            <textarea
              id="item-notes"
              rows={2}
              maxLength={FIELD_LIMITS.NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional prep ideas, opened date, or shelf notes"
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
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
