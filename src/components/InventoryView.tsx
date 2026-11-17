import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import {
  classifyExpiryStatus,
  formatShortDate,
  getDaysUntilExpiry,
  getLiveExpiryCountdown,
} from '../lib/dateUtils';
import { CATEGORIES, STORAGE_LOCATIONS, type FoodItem, type WasteLog } from '../types';

type InventoryTab = 'active' | 'expiring' | 'expired' | 'resolved';

interface InventoryViewProps {
  items: FoodItem[];
  wasteLogs: WasteLog[];
  loading: boolean;
  currencyCode: string;
  nowMs?: number;
  onAddItem: () => void;
  onEditItem: (item: FoodItem) => void;
  onConsumeItem: (item: FoodItem) => Promise<void>;
  onOpenWasteModal: (item: FoodItem) => void;
  onDeleteItem: (item: FoodItem) => Promise<void>;
  onPopulateSample: () => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  wasteLogs,
  loading,
  currencyCode,
  nowMs = Date.now(),
  onAddItem,
  onEditItem,
  onConsumeItem,
  onOpenWasteModal,
  onDeleteItem,
  onPopulateSample,
}) => {
  const [tab, setTab] = useState<InventoryTab>('active');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const metrics = useMemo(() => {
    const active = items.filter((i) => i.status === 'active');
    const expiringSoon = active.filter((i) => {
      const d = getDaysUntilExpiry(i.expiresAt);
      return d >= 0 && d <= 3;
    });
    const expired = active.filter((i) => getDaysUntilExpiry(i.expiresAt) < 0);
    const activeValue = active.reduce((sum, i) => sum + i.estimatedCost, 0);

    const consumedCount = wasteLogs.filter((l) => l.outcome === 'consumed').length;
    const totalLogs = wasteLogs.length;
    const rescueRate = totalLogs > 0 ? Math.round((consumedCount / totalLogs) * 100) : 100;

    return {
      activeCount: active.length,
      expiringSoonCount: expiringSoon.length,
      expiredCount: expired.length,
      activeValue,
      rescueRate,
      hasLogs: totalLogs > 0,
    };
  }, [items, wasteLogs]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (tab === 'active' && item.status !== 'active') return false;
        if (tab === 'expiring') {
          if (item.status !== 'active') return false;
          const d = getDaysUntilExpiry(item.expiresAt);
          if (d < 0 || d > 7) return false;
        }
        if (tab === 'expired') {
          if (item.status !== 'active') return false;
          if (getDaysUntilExpiry(item.expiresAt) >= 0) return false;
        }
        if (tab === 'resolved' && item.status === 'active') return false;

        if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
        if (locationFilter !== 'ALL' && item.storageLocation !== locationFilter) return false;
        if (q) {
          const hay = `${item.name} ${item.category} ${item.storageLocation} ${item.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [items, tab, search, categoryFilter, locationFilter]);

  const hasActiveFilters = search.trim() !== '' || categoryFilter !== 'ALL' || locationFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearch('');
    setCategoryFilter('ALL');
    setLocationFilter('ALL');
  };

  const handleExportCsv = () => {
    const header = [
      'Name',
      'Category',
      'Storage Location',
      'Quantity',
      'Unit',
      `Estimated Value (${currencyCode})`,
      'Purchased Date',
      'Expiration Date',
      'Status',
      'Alerts Sent',
    ];
    const rows = items.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.storageLocation,
      item.quantity,
      item.unit,
      item.estimatedCost.toFixed(2),
      item.purchasedAt,
      item.expiresAt,
      item.status,
      item.notifiedTiers.join('; '),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freshledger-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConsume = async (item: FoodItem) => {
    setBusyId(item.id);
    try {
      await onConsumeItem(item);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: FoodItem) => {
    setBusyId(item.id);
    try {
      await onDeleteItem(item);
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onPopulateSample();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-column flat summary strip separated by subtle hairlines */}
      <section
        aria-label="Inventory Summary"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Active Stock</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {metrics.activeCount}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {formatCurrency(metrics.activeValue, currencyCode)} value
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Expiring Within 3 Days</div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`font-mono tabular-nums text-2xl font-semibold ${
                metrics.expiringSoonCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {metrics.expiringSoonCount}
            </span>
            <span className="text-xs text-slate-500">Priority use</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Past Expiration</div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`font-mono tabular-nums text-2xl font-semibold ${
                metrics.expiredCount > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {metrics.expiredCount}
            </span>
            <span className="text-xs text-slate-500">Needs review</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Food Rescue Rate</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-emerald-700">
              {metrics.hasLogs ? `${metrics.rescueRate}%` : '—'}
            </span>
            <span className="text-xs text-slate-500">
              {metrics.hasLogs ? 'Consumed vs wasted' : 'No closed items yet'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Inventory Table Surface */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start overflow-x-auto max-w-full">
            {(
              [
                { id: 'active', label: 'All Active' },
                { id: 'expiring', label: 'Expiring ≤ 7d' },
                { id: 'expired', label: 'Expired' },
                { id: 'resolved', label: 'History' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search food items..."
                aria-label="Search food items"
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="p-0.5 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by storage location"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              <option value="ALL">All Locations</option>
              {STORAGE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="space-y-2 w-1/3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-24" />
                <div className="h-4 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
              Your food inventory is empty
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Add grocery or pantry items with expiration dates so FreshLedger can send automated pre-expiration alerts before food spoils.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onAddItem}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Item</span>
              </button>
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-500" />
                <span>{seeding ? 'Loading Sample...' : 'Load Sample Pantry (8 Items)'}</span>
              </button>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900 mb-1">No matching items</p>
            <p className="text-xs text-slate-500 mb-4">
              Adjust your search query, category, storage location, or status filter.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-5">Item &amp; Location</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Value</th>
                  <th className="py-2.5 px-4">Expiry Date</th>
                  <th className="py-2.5 px-4">Condition</th>
                  <th className="py-2.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredItems.map((item) => {
                  const daysLeft = getDaysUntilExpiry(item.expiresAt, new Date(nowMs));
                  const statusMeta = classifyExpiryStatus(daysLeft);
                  const liveCountdown = getLiveExpiryCountdown(item.expiresAt, nowMs);
                  const isBusy = busyId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.category}
                          <span aria-hidden="true"> · </span>
                          {item.storageLocation}
                          {item.notifiedTiers.length > 0 && item.status === 'active' && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono text-slate-600">
                                {item.notifiedTiers.length} alert{item.notifiedTiers.length > 1 ? 's' : ''} sent
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {formatCurrency(item.estimatedCost, currencyCode)}
                      </td>

                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        <div>{formatShortDate(item.expiresAt)}</div>
                        {item.status === 'active' && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              liveCountdown.isExpired
                                ? 'text-red-700'
                                : liveCountdown.isToday
                                  ? 'text-red-600 font-medium'
                                  : 'text-slate-500'
                            }`}
                          >
                            {liveCountdown.formatted}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'consumed' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Consumed</span>
                          </span>
                        ) : item.status === 'wasted' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Wasted</span>
                          </span>
                        ) : statusMeta.state === 'expired' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </span>
                        ) : statusMeta.state === 'urgent' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </span>
                        ) : statusMeta.state === 'warning' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.status === 'active' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleConsume(item)}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                Consume
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onOpenWasteModal(item)}
                                className="px-2.5 py-1 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                Log Waste
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onEditItem(item)}
                                aria-label={`Edit ${item.name}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(item)}
                            aria-label={`Delete ${item.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
