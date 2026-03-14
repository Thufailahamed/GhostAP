"use client";

import { useState, useEffect, useRef } from "react";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  XCircle,
  Edit,
  DollarSign,
  TrendingUp,
  Bell,
  BarChart3,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/ui/currency-display";

interface Subscription {
  id: number;
  name: string;
  vendor_name: string | null;
  category: string;
  cost: number;
  billing_cycle: string;
  next_billing_date: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
}

interface Analytics {
  total_monthly_spend: number;
  annual_run_rate: number;
  active_count: number;
  total_count: number;
  upcoming_renewals: number;
  category_breakdown: { category: string; monthly_spend: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-terminal-green border-terminal-green",
  PAUSED: "text-terminal-amber border-terminal-amber",
  CANCELLED: "text-terminal-red border-terminal-red",
  TRIAL: "text-terminal-cyan border-terminal-cyan",
};

const CATEGORIES = [
  "Engineering",
  "Marketing",
  "Sales",
  "HR",
  "Operations",
  "Finance",
  "Design",
  "Legal",
  "General",
];

const CHART_COLORS = [
  "#00ff88",
  "#ff6b35",
  "#00d4ff",
  "#ff3366",
  "#ffaa00",
  "#aa66ff",
  "#66ffcc",
  "#ff66aa",
  "#88ff00",
];

export default function SubscriptionsPage() {
  const { settings } = useSettings();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const { showToast } = useToast();
  const chartRef = useRef<HTMLCanvasElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, analyticsRes] = await Promise.all([
        api.get("/subscriptions/"),
        api.get("/subscriptions/analytics"),
      ]);
      setSubs(subsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load subscriptions", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Draw category chart
  useEffect(() => {
    if (!analytics || !chartRef.current) return;
    const canvas = chartRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    const data = analytics.category_breakdown;
    if (data.length === 0) return;

    const maxSpend = Math.max(...data.map((d) => d.monthly_spend));
    const barHeight = Math.min(28, (h - 20) / data.length - 8);
    const labelWidth = 100;
    const valueWidth = 80;
    const chartWidth = w - labelWidth - valueWidth - 20;

    data.forEach((item, i) => {
      const y = 10 + i * (barHeight + 8);
      const barW =
        maxSpend > 0 ? (item.monthly_spend / maxSpend) * chartWidth : 0;

      // Label
      ctx.fillStyle = "rgba(0,255,136,0.6)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(
        item.category.toUpperCase(),
        labelWidth - 10,
        y + barHeight / 2 + 4,
      );

      // Bar
      const color = CHART_COLORS[i % CHART_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(labelWidth, y, barW, barHeight);

      // Value
      const symbol = settings?.base_currency === "EUR" ? "€" : settings?.base_currency === "GBP" ? "£" : "$";
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(
        `${symbol}${item.monthly_spend.toLocaleString()}`,
        labelWidth + barW + 8,
        y + barHeight / 2 + 4,
      );
    });
  }, [analytics]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/subscriptions/${id}`);
      showToast("Subscription deleted", "success");
      fetchData();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handlePause = async (id: number) => {
    try {
      await api.post(`/subscriptions/${id}/pause`);
      showToast("Status toggled", "success");
      fetchData();
    } catch {
      showToast("Failed to toggle pause", "error");
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/subscriptions/${id}/cancel`);
      showToast("Subscription cancelled", "success");
      fetchData();
    } catch {
      showToast("Failed to cancel", "error");
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-terminal-green font-mono font-bold uppercase tracking-widest animate-pulse flex items-center gap-3">
          <CreditCard size={24} className="animate-spin" />
          Loading Subscriptions...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono pb-12">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-green">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <CreditCard size={24} />
            Subscriptions
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Track & Optimize Recurring Vendor Costs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 border-2 border-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green hover:text-black transition-colors text-terminal-green"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingSub(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-terminal-green text-black px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green/80 transition-colors"
          >
            <Plus size={14} />
            Add Subscription
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <div className="border-2 border-terminal-green bg-black p-5">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
              <DollarSign size={12} /> Monthly Spend
            </div>
            <div className="text-terminal-green text-2xl font-black">
              {formatCurrency(analytics.total_monthly_spend)}
            </div>
          </div>
          <div className="border-2 border-terminal-green bg-black p-5">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
              <TrendingUp size={12} /> Annual Run Rate
            </div>
            <div className="text-terminal-green text-2xl font-black">
              {formatCurrency(analytics.annual_run_rate)}
            </div>
          </div>
          <div className="border-2 border-terminal-green bg-black p-5">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
              <CreditCard size={12} /> Active
            </div>
            <div className="text-terminal-green text-2xl font-black">
              {analytics.active_count}
              <span className="text-xs font-normal text-terminal-green/50 ml-1">
                / {analytics.total_count} total
              </span>
            </div>
          </div>
          <div className="border-2 border-terminal-amber bg-black p-5">
            <div className="text-terminal-amber/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
              <Bell size={12} /> Renewals (7d)
            </div>
            <div className="text-terminal-amber text-2xl font-black">
              {analytics.upcoming_renewals}
            </div>
          </div>
        </div>
      )}

      {/* Category Chart */}
      {analytics && analytics.category_breakdown.length > 0 && (
        <div className="border-2 border-terminal-green bg-black p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green mb-4 flex items-center gap-2">
            <BarChart3 size={16} /> Monthly Spend by Category
          </h2>
          <canvas
            ref={chartRef}
            className="w-full"
            style={{
              height: `${Math.max(120, analytics.category_breakdown.length * 36)}px`,
            }}
          />
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="border-2 border-terminal-green bg-black">
        <div className="border-b border-terminal-green/30 px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green">
            All Subscriptions ({subs.length})
          </h2>
        </div>
        {subs.length === 0 ? (
          <div className="text-center py-12 text-terminal-green/50 uppercase tracking-widest text-xs">
            No subscriptions found. Add your first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-terminal-green/20 text-terminal-green/60 uppercase">
                  <th className="text-left px-6 py-3">Name</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Cost</th>
                  <th className="text-left px-4 py-3">Cycle</th>
                  <th className="text-left px-4 py-3">Next Billing</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-green/10">
                {subs.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-terminal-green/5 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="font-bold text-terminal-green uppercase">
                        {sub.name}
                      </div>
                      {sub.vendor_name && (
                        <div className="text-terminal-green/40 text-[10px]">
                          via {sub.vendor_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-terminal-green/70 uppercase">
                      {sub.category}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-terminal-green">
                      {formatCurrency(sub.cost)}
                    </td>
                    <td className="px-4 py-3 text-terminal-green/70 uppercase text-[10px]">
                      {sub.billing_cycle}
                    </td>
                    <td className="px-4 py-3 text-terminal-green/70">
                      {sub.next_billing_date
                        ? new Date(sub.next_billing_date).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[sub.status] || "text-terminal-green border-terminal-green"}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingSub(sub);
                            setShowModal(true);
                          }}
                          className="p-1 hover:text-terminal-amber transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        {sub.status !== "CANCELLED" && (
                          <button
                            onClick={() => handlePause(sub.id)}
                            className="p-1 hover:text-terminal-amber transition-colors"
                            title={sub.status === "PAUSED" ? "Resume" : "Pause"}
                          >
                            {sub.status === "PAUSED" ? (
                              <Play size={14} />
                            ) : (
                              <Pause size={14} />
                            )}
                          </button>
                        )}
                        {sub.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancel(sub.id)}
                            className="p-1 hover:text-terminal-red transition-colors"
                            title="Cancel"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-1 hover:text-terminal-red transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <SubscriptionModal
          subscription={editingSub}
          onClose={() => {
            setShowModal(false);
            setEditingSub(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingSub(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// --- Modal Component ---
function SubscriptionModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEdit = !!subscription;
  const [form, setForm] = useState({
    name: subscription?.name || "",
    category: subscription?.category || "General",
    cost: subscription?.cost?.toString() || "",
    billing_cycle: subscription?.billing_cycle || "MONTHLY",
    next_billing_date: subscription?.next_billing_date || "",
    status: subscription?.status || "ACTIVE",
    notes: subscription?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        cost: parseFloat(form.cost),
      };
      if (isEdit) {
        await api.put(`/subscriptions/${subscription!.id}`, payload);
        showToast("Subscription updated", "success");
      } else {
        await api.post("/subscriptions/", payload);
        showToast("Subscription created", "success");
      }
      onSaved();
    } catch {
      showToast("Failed to save subscription", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 font-mono">
      <div className="border-2 border-terminal-green bg-black w-full max-w-lg">
        <div className="border-b border-terminal-green/30 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-terminal-green">
            {isEdit ? "Edit Subscription" : "Add Subscription"}
          </h3>
          <button
            onClick={onClose}
            className="text-terminal-green/50 hover:text-terminal-red transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Slack, AWS, Figma..."
              className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
                Billing Cycle
              </label>
              <select
                value={form.billing_cycle}
                onChange={(e) =>
                  setForm({ ...form, billing_cycle: e.target.value })
                }
                className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
                Cost *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
                className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
                Next Billing Date *
              </label>
              <input
                type="date"
                required={!isEdit}
                value={form.next_billing_date}
                onChange={(e) =>
                  setForm({ ...form, next_billing_date: e.target.value })
                }
                className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-terminal-green/60 uppercase tracking-widest block mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
              className="w-full bg-black border-2 border-terminal-green/30 text-terminal-green px-3 py-2 text-xs font-mono focus:border-terminal-green outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-terminal-green/30 px-4 py-2 text-xs uppercase tracking-widest font-bold text-terminal-green/50 hover:text-terminal-green hover:border-terminal-green transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-terminal-green text-black px-6 py-2 text-xs uppercase tracking-widest font-bold hover:bg-terminal-green/80 transition-colors"
            >
              {isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
