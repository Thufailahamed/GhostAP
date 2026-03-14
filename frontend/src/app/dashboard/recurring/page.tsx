"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import {
  Repeat,
  Plus,
  Pause,
  Play,
  Trash2,
  Zap,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface RecurringItem {
  id: number;
  customer_name: string;
  customer_id: number;
  description: string;
  amount: number;
  frequency: string;
  next_run_date: string | null;
  last_run_date: string | null;
  end_date: string | null;
  is_active: boolean;
  times_generated: number;
  created_at: string | null;
}

export default function RecurringPage() {
  const { settings } = useSettings();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { showToast, showConfirm } = useToast();

  // Form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFrequency, setFormFrequency] = useState("MONTHLY");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  const fetchData = async () => {
    try {
      const [recRes, custRes] = await Promise.all([
        api.get("/recurring/"),
        api.get("/receivables/customers"),
      ]);
      setItems(recRes.data);
      setCustomers(custRes.data);
      if (custRes.data.length > 0 && !formCustomerId) {
        setFormCustomerId(custRes.data[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch recurring data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId || !formAmount || !formStartDate) {
      showToast("Please fill all required fields.", "error");
      return;
    }
    try {
      await api.post("/recurring/", {
        customer_id: parseInt(formCustomerId),
        description: formDescription,
        amount: parseFloat(formAmount),
        frequency: formFrequency,
        start_date: formStartDate,
        end_date: formEndDate || null,
      });
      showToast("Recurring schedule created!", "success");
      setShowModal(false);
      setFormDescription("");
      setFormAmount("");
      setFormStartDate("");
      setFormEndDate("");
      fetchData();
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to create schedule",
        "error",
      );
    }
  };

  const handleToggle = async (id: number, currentlyActive: boolean) => {
    try {
      await api.patch(`/recurring/${id}`, { is_active: !currentlyActive });
      showToast(
        `Schedule ${currentlyActive ? "paused" : "resumed"}.`,
        "success",
      );
      fetchData();
    } catch {
      showToast("Failed to update", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm(
      "DELETE this recurring schedule? This cannot be undone.",
    );
    if (!ok) return;
    try {
      await api.delete(`/recurring/${id}`);
      showToast("Schedule deleted.", "success");
      fetchData();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await api.post("/recurring/trigger");
      showToast(res.data.message, "success");
      fetchData();
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to trigger schedules",
        "error",
      );
    } finally {
      setTriggering(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
    }).format(val);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const frequencyColors: Record<string, string> = {
    WEEKLY: "text-terminal-cyan border-terminal-cyan",
    MONTHLY: "text-terminal-green border-terminal-green",
    QUARTERLY: "text-terminal-amber border-terminal-amber",
    YEARLY: "text-white border-white",
  };

  return (
    <div className="space-y-6 font-mono pb-12">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-green">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <Repeat size={24} />
            Recurring Invoices
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Automate invoice generation on a schedule.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-2 border-2 border-terminal-amber text-terminal-amber px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-amber hover:text-black transition-colors"
          >
            <Zap
              size={14}
              className={triggering ? "animate-spin" : "animate-pulse"}
            />
            {triggering ? "Running..." : "Run Due Now"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-terminal-green text-black border-2 border-terminal-green px-6 py-2 uppercase tracking-widest text-xs font-bold hover:bg-green-400 transition-colors"
          >
            <Plus size={16} />
            New Schedule
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border-2 border-terminal-green bg-black">
        {loading ? (
          <div className="text-center p-12 text-terminal-green/60 font-bold uppercase tracking-widest animate-pulse">
            Loading Recurring Schedules...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center p-12 text-terminal-green/60 font-bold uppercase tracking-widest">
            [ No Recurring Schedules Found ]
          </div>
        ) : (
          <table className="w-full text-sm text-left font-mono">
            <thead className="bg-terminal-green text-black uppercase tracking-widest text-xs sticky top-0">
              <tr>
                <th className="p-4 font-bold">Customer</th>
                <th className="p-4 font-bold">Description</th>
                <th className="p-4 font-bold text-right">Amount</th>
                <th className="p-4 font-bold text-center">Frequency</th>
                <th className="p-4 font-bold text-center">Next Run</th>
                <th className="p-4 font-bold text-center">Generated</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-terminal-green/20 text-terminal-green">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-terminal-green/10 transition-colors ${!item.is_active ? "opacity-50" : ""}`}
                >
                  <td className="p-4 font-bold uppercase">
                    {item.customer_name}
                  </td>
                  <td className="p-4">{item.description}</td>
                  <td className="p-4 text-right font-bold">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 border ${frequencyColors[item.frequency] || "text-terminal-green border-terminal-green"}`}
                    >
                      {item.frequency}
                    </span>
                  </td>
                  <td className="p-4 text-center text-xs font-mono text-terminal-green/70">
                    {formatDate(item.next_run_date)}
                  </td>
                  <td className="p-4 text-center font-bold text-terminal-cyan">
                    {item.times_generated}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 border ${item.is_active ? "text-terminal-green border-terminal-green" : "text-terminal-red border-terminal-red"}`}
                    >
                      [{item.is_active ? "ACTIVE" : "PAUSED"}]
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggle(item.id, item.is_active)}
                        className={`p-1.5 transition-colors ${item.is_active ? "text-terminal-amber/60 hover:text-terminal-amber" : "text-terminal-green/60 hover:text-terminal-green"}`}
                        title={item.is_active ? "Pause" : "Resume"}
                      >
                        {item.is_active ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-terminal-red/50 hover:text-terminal-red p-1.5 transition-colors"
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
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-terminal-bg border-4 border-terminal-green p-8 w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,255,136,0.1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
                <Calendar size={20} /> New Recurring Schedule
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-terminal-green hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                  >
                    <option value="" disabled>
                      Select Customer
                    </option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Amount *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                  Description *
                </label>
                <input
                  required
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                  placeholder="e.g. Monthly Server Hosting"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Frequency *
                  </label>
                  <select
                    required
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Start Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green/70 font-bold text-sm outline-none focus:border-white transition-colors"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green/10 uppercase font-bold tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-terminal-green text-black border-2 border-terminal-green hover:bg-green-400 uppercase font-bold tracking-widest text-xs"
                >
                  Create Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
