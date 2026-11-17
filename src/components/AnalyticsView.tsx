import React, { useMemo } from 'react';
import { CheckCircle2, Download, Trash2, XCircle } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { formatShortDate } from '../lib/dateUtils';
import type { WasteLog } from '../types';

interface AnalyticsViewProps {
  logs: WasteLog[];
  currencyCode: string;
  onDeleteLog: (logId: string) => Promise<void>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  logs,
  currencyCode,
  onDeleteLog,
}) => {
  const stats = useMemo(() => {
    let rescuedValue = 0;
    let wastedValue = 0;
    let rescuedCount = 0;
    let wastedCount = 0;

    const categoryMap = new Map<string, { rescued: number; wasted: number }>();
    const reasonMap = new Map<string, { count: number; value: number }>();

    for (const log of logs) {
      const catEntry = categoryMap.get(log.category) || { rescued: 0, wasted: 0 };
      if (log.outcome === 'consumed') {
        rescuedValue += log.estimatedValue;
        rescuedCount += 1;
        catEntry.rescued += log.estimatedValue;
      } else {
        wastedValue += log.estimatedValue;
        wastedCount += 1;
        catEntry.wasted += log.estimatedValue;

        const rEntry = reasonMap.get(log.reason) || { count: 0, value: 0 };
        rEntry.count += 1;
        rEntry.value += log.estimatedValue;
        reasonMap.set(log.reason, rEntry);
      }
      categoryMap.set(log.category, catEntry);
    }

    const totalCount = rescuedCount + wastedCount;
    const rescueRate = totalCount > 0 ? Math.round((rescuedCount / totalCount) * 100) : 0;

    const categories = Array.from(categoryMap.entries())
      .map(([category, vals]) => ({
        category,
        ...vals,
        total: vals.rescued + vals.wasted,
      }))
      .sort((a, b) => b.total - a.total);

    const maxCategoryTotal = Math.max(1, ...categories.map((c) => c.total));

    const reasons = Array.from(reasonMap.entries())
      .map(([reason, vals]) => ({ reason, ...vals }))
      .sort((a, b) => b.value - a.value);

    const maxReasonValue = Math.max(1, ...reasons.map((r) => r.value));

    return {
      rescuedValue,
      wastedValue,
      rescuedCount,
      wastedCount,
      totalCount,
      rescueRate,
      categories,
      maxCategoryTotal,
      reasons,
      maxReasonValue,
    };
  }, [logs]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
  }, [logs]);

  const handleExportLogsCsv = () => {
    const header = [
      'Date',
      'Item',
      'Category',
      'Outcome',
      'Quantity',
      'Unit',
      `Estimated Value (${currencyCode})`,
      'Reason',
      'Notes',
    ];
    const rows = sortedLogs.map((l) => [
      l.loggedDate,
      `"${l.itemName.replace(/"/g, '""')}"`,
      l.category,
      l.outcome,
      l.quantity,
      l.unit,
      l.estimatedValue.toFixed(2),
      l.reason,
      `"${l.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freshledger-waste-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 4-column flat summary strip */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Value Consumed in Time</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-700">
            {formatCurrency(stats.rescuedValue, currencyCode)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Value Wasted</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-red-700">
            {formatCurrency(stats.wastedValue, currencyCode)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Overall Rescue Rate</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {stats.totalCount > 0 ? `${stats.rescueRate}%` : '—'}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-1">Outcomes Logged</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {stats.rescuedCount} <span className="text-xs font-normal text-slate-500">saved</span> /{' '}
            {stats.wastedCount} <span className="text-xs font-normal text-slate-500">wasted</span>
          </div>
        </div>
      </section>

      {logs.length === 0 ? (
        <section className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center">
          <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
            No consumption or waste outcomes logged yet
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Mark items as Consumed or Log Waste from your Inventory or Notifications inbox to track savings, waste drivers, and category trends.
          </p>
        </section>
      ) : (
        <>
          {/* Two-column Analytics Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Rescued vs. Wasted Value by Category
                </h2>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs inline-block" />
                    Rescued
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-red-600 rounded-xs inline-block" />
                    Wasted
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {stats.categories.map((cat) => {
                  const rescuedPct = (cat.rescued / stats.maxCategoryTotal) * 100;
                  const wastedPct = (cat.wasted / stats.maxCategoryTotal) * 100;
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{cat.category}</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {formatCurrency(cat.rescued, currencyCode)} saved · {formatCurrency(cat.wasted, currencyCode)} lost
                        </span>
                      </div>
                      <svg
                        className="w-full h-3 block rounded-xs overflow-hidden bg-slate-100"
                        role="img"
                        aria-label={`${cat.category}: ${formatCurrency(cat.rescued, currencyCode)} saved, ${formatCurrency(cat.wasted, currencyCode)} lost`}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={`${rescuedPct}%`}
                          height="12"
                          fill="#059669"
                        />
                        <rect
                          x={`${rescuedPct}%`}
                          y="0"
                          width={`${wastedPct}%`}
                          height="12"
                          fill="#dc2626"
                        />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-sm font-semibold text-slate-900 mb-5">
                Primary Waste Drivers
              </h2>

              {stats.reasons.length === 0 ? (
                <p className="text-xs text-slate-500 py-6">
                  Zero wasted items recorded so far.
                </p>
              ) : (
                <div className="space-y-4">
                  {stats.reasons.map((item) => {
                    const widthPct = (item.value / stats.maxReasonValue) * 100;
                    return (
                      <div key={item.reason} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            {item.reason} ({item.count})
                          </span>
                          <span className="font-mono tabular-nums text-red-700">
                            {formatCurrency(item.value, currencyCode)}
                          </span>
                        </div>
                        <svg
                          className="w-full h-3 block rounded-xs overflow-hidden bg-slate-100"
                          role="img"
                          aria-label={`${item.reason}: ${formatCurrency(item.value, currencyCode)}`}
                        >
                          <rect
                            x="0"
                            y="0"
                            width={`${widthPct}%`}
                            height="12"
                            fill="#dc2626"
                          />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Outcome Ledger Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Consumption &amp; Waste Ledger
              </h2>
              <button
                type="button"
                onClick={handleExportLogsCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-5">Date</th>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4">Outcome</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {sortedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatShortDate(log.loggedDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.itemName}</div>
                        <div className="text-xs text-slate-500">
                          {log.category} · {log.quantity} {log.unit}
                          {log.notes ? ` · ${log.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.outcome === 'consumed' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Consumed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Wasted</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {log.reason}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 whitespace-nowrap">
                        {formatCurrency(log.estimatedValue, currencyCode)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteLog(log.id)}
                          aria-label={`Delete log for ${log.itemName}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
