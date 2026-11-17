import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getGroupedCurrencyOptions } from '../lib/currency';
import {
  CATEGORIES,
  FIELD_LIMITS,
  UNITS,
  type FoodCategory,
  type FoodUnit,
  type NotificationRule,
  type NotificationSeverity,
} from '../types';
import type { RuleInput } from '../lib/pantryActions';

interface RulesViewProps {
  rules: NotificationRule[];
  browserPushEnabled: boolean;
  dailyCheckHour: number;
  currencyCode: string;
  onUpdatePrefs: (prefs: { browserPushEnabled: boolean; dailyCheckHour: number }) => Promise<void>;
  onUpdateCurrency: (currencyCode: string) => Promise<void>;
  onEnableBrowserPush: () => Promise<void>;
  onUpdateRule: (ruleId: string, input: RuleInput) => Promise<void>;
  onCreateRule: (input: RuleInput) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  browserPushEnabled,
  dailyCheckHour,
  currencyCode,
  onUpdatePrefs,
  onUpdateCurrency,
  onEnableBrowserPush,
  onUpdateRule,
  onCreateRule,
  onDeleteRule,
}) => {
  const currencyOptions = useMemo(() => getGroupedCurrencyOptions(), []);

  // Expiry rule form state
  const [label, setLabel] = useState('');
  const [daysBefore, setDaysBefore] = useState('5');
  const [severity, setSeverity] = useState<NotificationSeverity>('warning');
  const [channelBrowser, setChannelBrowser] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [creating, setCreating] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Stock-level rule form state
  const [stockLabel, setStockLabel] = useState('');
  const [minQuantity, setMinQuantity] = useState('2');
  const [targetUnit, setTargetUnit] = useState<FoodUnit | 'ANY'>('pcs');
  const [targetCategory, setTargetCategory] = useState<FoodCategory | 'ALL'>('ALL');
  const [stockSeverity, setStockSeverity] = useState<NotificationSeverity>('warning');
  const [stockChannelBrowser, setStockChannelBrowser] = useState(true);
  const [stockChannelInApp, setStockChannelInApp] = useState(true);
  const [creatingStock, setCreatingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const expiryRules = useMemo(() => {
    return rules
      .filter((r) => (r.ruleType ?? 'expiry') === 'expiry')
      .sort((a, b) => b.daysBefore - a.daysBefore);
  }, [rules]);

  const stockRules = useMemo(() => {
    return rules
      .filter((r) => r.ruleType === 'stock')
      .sort((a, b) => (a.minQuantity ?? 0) - (b.minQuantity ?? 0));
  }, [rules]);

  const handleCreateExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setRuleError('Rule label is required.');
      return;
    }
    const parsedDays = Number(daysBefore);
    if (!Number.isInteger(parsedDays) || parsedDays < -7 || parsedDays > 90) {
      setRuleError('Lead time must be an integer between -7 and 90 days.');
      return;
    }

    setCreating(true);
    setRuleError(null);
    try {
      await onCreateRule({
        label: trimmed,
        daysBefore: parsedDays,
        ruleType: 'expiry',
        enabled: true,
        channelBrowser,
        channelInApp,
        severity,
      });
      setLabel('');
      setDaysBefore('5');
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : 'Failed to create rule.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = stockLabel.trim();
    if (!trimmed) {
      setStockError('Stock rule name is required.');
      return;
    }
    const parsedMin = Number(minQuantity);
    if (!Number.isFinite(parsedMin) || parsedMin <= 0 || parsedMin > FIELD_LIMITS.QUANTITY_MAX) {
      setStockError(`Minimum threshold must be between 0.01 and ${FIELD_LIMITS.QUANTITY_MAX}.`);
      return;
    }

    setCreatingStock(true);
    setStockError(null);
    try {
      await onCreateRule({
        label: trimmed,
        daysBefore: 0,
        ruleType: 'stock',
        minQuantity: parsedMin,
        targetUnit,
        targetCategory,
        enabled: true,
        channelBrowser: stockChannelBrowser,
        channelInApp: stockChannelInApp,
        severity: stockSeverity,
      });
      setStockLabel('');
      setMinQuantity('2');
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Failed to create stock rule.');
    } finally {
      setCreatingStock(false);
    }
  };

  const handleUpdateRuleField = async (
    rule: NotificationRule,
    patch: Partial<RuleInput>
  ) => {
    await onUpdateRule(rule.id, {
      label: patch.label ?? rule.label,
      daysBefore: patch.daysBefore ?? rule.daysBefore,
      ruleType: patch.ruleType ?? rule.ruleType ?? 'expiry',
      minQuantity: patch.minQuantity ?? rule.minQuantity,
      targetUnit: patch.targetUnit ?? rule.targetUnit,
      targetCategory: patch.targetCategory ?? rule.targetCategory,
      enabled: patch.enabled ?? rule.enabled,
      channelBrowser: patch.channelBrowser ?? rule.channelBrowser,
      channelInApp: patch.channelInApp ?? rule.channelInApp,
      severity: patch.severity ?? rule.severity,
    });
  };

  return (
    <div className="space-y-6">
      {/* Global Delivery Settings */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Notification Delivery Schedule
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            FreshLedger automatically scans active inventory on startup, after any item update, and every 60 seconds while open.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Browser Desktop Alerts</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Trigger native OS notifications when an item reaches an expiry or low-stock threshold.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!browserPushEnabled) {
                  onEnableBrowserPush();
                } else {
                  onUpdatePrefs({ browserPushEnabled: false, dailyCheckHour });
                }
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                browserPushEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {browserPushEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="daily-check-hour" className="text-sm font-medium text-slate-900 block">
                Preferred Daily Digest Hour
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Target hour for daily pantry expiration summary checks.
              </p>
            </div>
            <select
              id="daily-check-hour"
              value={dailyCheckHour}
              onChange={(e) =>
                onUpdatePrefs({
                  browserPushEnabled,
                  dailyCheckHour: Number(e.target.value),
                })
              }
              className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              {Array.from({ length: 24 }, (_, hour) => {
                const labelHour =
                  hour === 0
                    ? '12:00 AM'
                    : hour < 12
                      ? `${hour}:00 AM`
                      : hour === 12
                        ? '12:00 PM'
                        : `${hour - 12}:00 PM`;
                return (
                  <option key={hour} value={hour}>
                    {labelHour}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="rules-currency-select" className="text-sm font-medium text-slate-900 block">
                Display Currency
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Format inventory values, alerts, and waste analytics in your currency.
              </p>
            </div>
            <select
              id="rules-currency-select"
              value={currencyCode}
              onChange={(e) => void onUpdateCurrency(e.target.value)}
              className="max-w-[160px] px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              <optgroup label="Popular Currencies">
                {currencyOptions.popular.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All World Currencies">
                {currencyOptions.others.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </section>

      {/* Minimum Stock-Level Alerts Section */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Minimum Stock-Level Alert Rules
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Automatically trigger notifications when an active item’s quantity drops strictly below a minimum threshold.
          </p>
        </div>

        {stockRules.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500 border-b border-slate-200">
            No stock-level rules configured yet. Add a minimum quantity rule below to monitor low pantry stock.
          </div>
        ) : (
          <div className="overflow-x-auto border-b border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Rule Label</th>
                  <th className="py-2.5 px-4">Min Threshold</th>
                  <th className="py-2.5 px-4">Unit</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Channels</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-6 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {stockRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900">{rule.label}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">&lt;</span>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          max={FIELD_LIMITS.QUANTITY_MAX}
                          aria-label={`Minimum threshold for ${rule.label}`}
                          value={rule.minQuantity ?? 1}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val > 0 && val <= FIELD_LIMITS.QUANTITY_MAX) {
                              void handleUpdateRuleField(rule, { minQuantity: val });
                            }
                          }}
                          className="w-20 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Target unit for ${rule.label}`}
                        value={rule.targetUnit ?? 'ANY'}
                        onChange={(e) =>
                          void handleUpdateRuleField(rule, {
                            targetUnit: e.target.value as FoodUnit | 'ANY',
                          })
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                      >
                        <option value="ANY">Any Unit</option>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Target category for ${rule.label}`}
                        value={rule.targetCategory ?? 'ALL'}
                        onChange={(e) =>
                          void handleUpdateRuleField(rule, {
                            targetCategory: e.target.value as FoodCategory | 'ALL',
                          })
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                      >
                        <option value="ALL">All Categories</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Severity for ${rule.label}`}
                        value={rule.severity}
                        onChange={(e) =>
                          void handleUpdateRuleField(rule, {
                            severity: e.target.value as NotificationSeverity,
                          })
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                      >
                        <option value="info">Early Notice</option>
                        <option value="warning">Priority</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3 text-xs text-slate-700">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.channelInApp}
                            onChange={(e) =>
                              void handleUpdateRuleField(rule, { channelInApp: e.target.checked })
                            }
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>In-App</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.channelBrowser}
                            onChange={(e) =>
                              void handleUpdateRuleField(rule, { channelBrowser: e.target.checked })
                            }
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>Desktop</span>
                        </label>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateRuleField(rule, { enabled: !rule.enabled })
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          rule.enabled
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {rule.enabled ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => void onDeleteRule(rule.id)}
                        aria-label={`Delete stock rule ${rule.label}`}
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
        )}

        <div className="p-6 bg-slate-50/50">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            Add Stock-Level Alert Rule
          </h3>

          {stockError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
              {stockError}
            </div>
          )}

          <form onSubmit={handleCreateStock} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label htmlFor="stock-rule-label" className="block text-xs font-medium text-slate-700 mb-1.5">
                Rule Name
              </label>
              <input
                id="stock-rule-label"
                type="text"
                required
                maxLength={FIELD_LIMITS.RULE_LABEL_MAX}
                value={stockLabel}
                onChange={(e) => setStockLabel(e.target.value)}
                placeholder="e.g., Low Dairy Alert"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="stock-rule-min" className="block text-xs font-medium text-slate-700 mb-1.5">
                Below Qty
              </label>
              <input
                id="stock-rule-min"
                type="number"
                step="any"
                min="0.01"
                max={FIELD_LIMITS.QUANTITY_MAX}
                required
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="stock-rule-unit" className="block text-xs font-medium text-slate-700 mb-1.5">
                Unit Scope
              </label>
              <select
                id="stock-rule-unit"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value as FoodUnit | 'ANY')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                <option value="ANY">Any Unit</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="stock-rule-category" className="block text-xs font-medium text-slate-700 mb-1.5">
                Category Scope
              </label>
              <select
                id="stock-rule-category"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value as FoodCategory | 'ALL')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <select
                  aria-label="Stock alert severity"
                  value={stockSeverity}
                  onChange={(e) => setStockSeverity(e.target.value as NotificationSeverity)}
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md block mb-1"
                >
                  <option value="info">Early Notice</option>
                  <option value="warning">Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stockChannelInApp}
                      onChange={(e) => setStockChannelInApp(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span>In-App</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stockChannelBrowser}
                      onChange={(e) => setStockChannelBrowser(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span>Desktop</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingStock}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creatingStock ? 'Adding...' : 'Add Rule'}</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Pre-Expiration Lead-Time Trigger Rules Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Automated Pre-Expiration Rules
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Each rule triggers once per item when days remaining drops to or below the configured lead time.
          </p>
        </div>

        <div className="overflow-x-auto border-b border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-6">Rule Label</th>
                <th className="py-2.5 px-4 text-right">Lead Time</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Channels</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-6 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {expiryRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-900">{rule.label}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                    {rule.daysBefore > 0
                      ? `${rule.daysBefore}d before`
                      : rule.daysBefore === 0
                        ? 'On expiry day'
                        : `${Math.abs(rule.daysBefore)}d overdue`}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Severity for ${rule.label}`}
                      value={rule.severity}
                      onChange={(e) =>
                        void handleUpdateRuleField(rule, {
                          severity: e.target.value as NotificationSeverity,
                        })
                      }
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      <option value="info">Early Notice</option>
                      <option value="warning">Priority</option>
                      <option value="urgent">Urgent</option>
                      <option value="expired">Expired</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 text-xs text-slate-700">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.channelInApp}
                          onChange={(e) =>
                            void handleUpdateRuleField(rule, { channelInApp: e.target.checked })
                          }
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span>In-App</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.channelBrowser}
                          onChange={(e) =>
                            void handleUpdateRuleField(rule, { channelBrowser: e.target.checked })
                          }
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span>Desktop</span>
                      </label>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        void handleUpdateRuleField(rule, { enabled: !rule.enabled })
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="py-3 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => void onDeleteRule(rule.id)}
                      aria-label={`Delete rule ${rule.label}`}
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

        <div className="p-6 bg-slate-50/50">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            Add Custom Lead-Time Rule
          </h3>

          {ruleError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
              {ruleError}
            </div>
          )}

          <form onSubmit={handleCreateExpiry} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label htmlFor="new-rule-label" className="block text-xs font-medium text-slate-700 mb-1.5">
                Rule Name
              </label>
              <input
                id="new-rule-label"
                type="text"
                required
                maxLength={FIELD_LIMITS.RULE_LABEL_MAX}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Bulk Freezer Check (14 days)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="new-rule-days" className="block text-xs font-medium text-slate-700 mb-1.5">
                Days Before
              </label>
              <input
                id="new-rule-days"
                type="number"
                min={-7}
                max={90}
                required
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="new-rule-severity" className="block text-xs font-medium text-slate-700 mb-1.5">
                Severity
              </label>
              <select
                id="new-rule-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                <option value="info">Early Notice</option>
                <option value="warning">Priority</option>
                <option value="urgent">Urgent</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="md:col-span-3 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelInApp}
                    onChange={(e) => setChannelInApp(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900"
                  />
                  <span>In-App</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelBrowser}
                    onChange={(e) => setChannelBrowser(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900"
                  />
                  <span>Desktop</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creating ? 'Adding...' : 'Add Rule'}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
