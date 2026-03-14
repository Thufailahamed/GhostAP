"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingDown,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";

interface AgingItem {
  id: number;
  invoice_number: string;
  customer: string;
  total_amount: number;
  balance_due: number;
  days_outstanding: number;
  status: string;
  due_date: string | null;
}

interface Bucket {
  label: string;
  items: AgingItem[];
  total: number;
}

interface AgingData {
  buckets: {
    current: Bucket;
    aging_30: Bucket;
    aging_60: Bucket;
    aging_90: Bucket;
  };
  total_ar: number;
}

const BUCKET_CONFIG = [
  {
    key: "current",
    icon: <CheckCircle size={18} />,
    color: "text-terminal-green",
    border: "border-terminal-green",
    bg: "bg-terminal-green/5",
    label: "0–30 Days",
    badge: "bg-terminal-green text-black",
  },
  {
    key: "aging_30",
    icon: <Clock size={18} />,
    color: "text-terminal-amber",
    border: "border-terminal-amber",
    bg: "bg-terminal-amber/5",
    label: "31–60 Days",
    badge: "bg-terminal-amber text-black",
  },
  {
    key: "aging_60",
    icon: <AlertCircle size={18} />,
    color: "text-orange-400",
    border: "border-orange-400",
    bg: "bg-orange-400/5",
    label: "61–90 Days",
    badge: "bg-orange-400 text-black",
  },
  {
    key: "aging_90",
    icon: <AlertTriangle size={18} />,
    color: "text-terminal-red",
    border: "border-terminal-red",
    bg: "bg-terminal-red/5",
    label: "90+ Days",
    badge: "bg-terminal-red text-white",
  },
];

export default function AgingReportPage() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const { showToast } = useToast();

  const fetchAging = async () => {
    try {
      const res = await api.get("/receivables/aging");
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch aging report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAging();
  }, []);

  const handleAutoMark = async () => {
    setMarking(true);
    try {
      const res = await api.post("/receivables/auto-mark-overdue");
      showToast(res.data.message, res.data.updated > 0 ? "info" : "success");
      fetchAging();
    } catch (err) {
      showToast("Failed to run auto-mark sweep", "error");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-3">
            <TrendingDown size={24} /> AR_AGING_REPORT
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // Accounts Receivable Aging Analysis
          </p>
        </div>
        <button
          onClick={handleAutoMark}
          disabled={marking}
          className="px-5 py-2.5 border-2 border-terminal-amber text-terminal-amber hover:bg-terminal-amber hover:text-black font-bold uppercase text-xs tracking-widest transition-colors disabled:opacity-50"
        >
          {marking ? "Running..." : "⚡ Run Auto-Mark Overdue"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 font-mono text-terminal-cyan/60 uppercase tracking-widest animate-pulse">
          Fetching Aging Data...
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-terminal-red font-mono uppercase">
          Failed to load aging report
        </div>
      ) : (
        <>
          {/* Total AR Banner */}
          <div className="flex items-center justify-between px-6 py-4 border-2 border-terminal-cyan bg-terminal-panel font-mono">
            <span className="text-terminal-cyan/60 text-sm font-bold uppercase tracking-widest">
              Total Outstanding AR
            </span>
            <span className="text-2xl font-bold text-terminal-cyan">
              <CurrencyDisplay amount={data.total_ar} />
            </span>
          </div>

          {/* Summary Cards Row */}
          <div className="grid grid-cols-4 gap-4">
            {BUCKET_CONFIG.map((cfg) => {
              const bucket = data.buckets[cfg.key as keyof typeof data.buckets];
              return (
                <div
                  key={cfg.key}
                  className={`border-2 ${cfg.border} ${cfg.bg} p-4 font-mono`}
                >
                  <div
                    className={`flex items-center gap-2 mb-2 ${cfg.color} font-bold uppercase text-xs tracking-widest`}
                  >
                    {cfg.icon} {cfg.label}
                  </div>
                  <div className={`text-xl font-bold ${cfg.color}`}>
                    <CurrencyDisplay amount={bucket.total} />
                  </div>
                  <div className="text-[11px] text-terminal-green/40 mt-1 uppercase">
                    {bucket.items.length} invoice
                    {bucket.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Buckets */}
          {BUCKET_CONFIG.map((cfg) => {
            const bucket = data.buckets[cfg.key as keyof typeof data.buckets];
            if (bucket.items.length === 0) return null;
            return (
              <div
                key={cfg.key}
                className={`border-2 ${cfg.border} bg-terminal-panel`}
              >
                <div
                  className={`flex items-center justify-between px-6 py-3 border-b ${cfg.border} ${cfg.bg}`}
                >
                  <div
                    className={`flex items-center gap-2 font-bold uppercase tracking-widest text-sm ${cfg.color}`}
                  >
                    {cfg.icon} {cfg.label} ({bucket.items.length} items)
                  </div>
                  <span className={`text-sm font-bold font-mono ${cfg.color}`}>
                    Total: $
                    {bucket.total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <table className="w-full text-sm font-mono">
                  <thead className="text-[10px] uppercase text-terminal-green/40 border-b border-[#333]">
                    <tr>
                      <th className="px-6 py-3 text-left">Invoice #</th>
                      <th className="px-6 py-3 text-left">Customer</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Balance Due</th>
                      <th className="px-6 py-3 text-center">Days Out</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#333] hover:bg-terminal-green/5 transition-colors"
                      >
                        <td className="px-6 py-3 font-bold text-terminal-green">
                          {item.invoice_number}
                        </td>
                        <td className="px-6 py-3 uppercase text-terminal-green/80">
                          {item.customer}
                        </td>
                        <td className="px-6 py-3 text-right text-terminal-green/60">
                          <CurrencyDisplay amount={item.total_amount} />
                        </td>
                        <td
                          className={`px-6 py-3 text-right font-bold ${cfg.color}`}
                        >
                          <CurrencyDisplay amount={item.balance_due} />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 ${cfg.badge}`}
                          >
                            {item.days_outstanding}d
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}
                          >
                            [{item.status}]
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {data.total_ar === 0 && (
            <div className="text-center py-16 text-terminal-green/40 font-mono uppercase tracking-widest">
              ✅ All Receivables are Settled — No Outstanding AR
            </div>
          )}
        </>
      )}
    </div>
  );
}
