"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import {
  Users,
  Plus,
  Trash2,
  X,
  DollarSign,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

interface CustomerDetail {
  id: number;
  name: string;
  payment_terms: string;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  invoice_count: number;
  overdue_count: number;
  last_invoice_date: string | null;
}

export default function CustomersPage() {
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<CustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTerms, setNewTerms] = useState("Net 30");
  const { showToast, showConfirm } = useToast();

  const fetchCustomers = async () => {
    try {
      const res = await api.get("/receivables/customers/details");
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post("/receivables/customers", {
        name: newName.trim(),
        payment_terms: newTerms,
      });
      showToast(`Customer "${newName}" created!`, "success");
      setNewName("");
      setNewTerms("Net 30");
      setShowAddModal(false);
      fetchCustomers();
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to create customer",
        "error",
      );
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await showConfirm(
      `Delete customer "${name}"? This will not delete their invoices.`,
    );
    if (!ok) return;
    try {
      await api.delete(`/receivables/customers/${id}`);
      showToast(`Customer "${name}" deleted.`, "success");
      fetchCustomers();
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to delete customer",
        "error",
      );
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Aggregate KPI
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstanding, 0);
  const totalBilled = customers.reduce((sum, c) => sum + c.total_billed, 0);
  const totalPaid = customers.reduce((sum, c) => sum + c.total_paid, 0);
  const overdueClients = customers.filter((c) => c.overdue_count > 0).length;

  return (
    <div className="space-y-6 font-mono pb-12">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-cyan">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-3">
            <Users size={24} />
            Customers
          </h1>
          <p className="text-terminal-cyan/60 uppercase tracking-widest text-xs mt-2">
            Client Directory & Financial Overview
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-terminal-cyan text-black border-2 border-terminal-cyan px-6 py-2 uppercase tracking-widest text-xs font-bold hover:bg-cyan-300 transition-colors"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border-2 border-terminal-cyan bg-black p-5">
          <div className="text-terminal-cyan/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
            <Users size={12} /> Total Clients
          </div>
          <div className="text-terminal-cyan text-2xl font-black">
            {customers.length}
          </div>
        </div>
        <div className="border-2 border-terminal-green/50 bg-black p-5">
          <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
            <DollarSign size={12} /> Total Billed
          </div>
          <div className="text-terminal-green text-2xl font-black">
            {formatCurrency(totalBilled)}
          </div>
        </div>
        <div className="border-2 border-terminal-amber/50 bg-black p-5">
          <div className="text-terminal-amber/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
            <DollarSign size={12} /> Outstanding
          </div>
          <div className="text-terminal-amber text-2xl font-black">
            {formatCurrency(totalOutstanding)}
          </div>
        </div>
        <div className="border-2 border-terminal-red/50 bg-black p-5">
          <div className="text-terminal-red/60 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-1">
            <AlertCircle size={12} /> Overdue Clients
          </div>
          <div className="text-terminal-red text-2xl font-black">
            {overdueClients}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center border-2 border-terminal-cyan bg-terminal-panel px-4">
        <Search size={20} className="text-terminal-cyan/50" />
        <input
          type="text"
          placeholder="SEARCH CUSTOMERS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm text-terminal-cyan placeholder:text-terminal-cyan/50"
        />
      </div>

      {/* Table */}
      <div className="border-2 border-terminal-cyan bg-black">
        {loading ? (
          <div className="text-center p-12 text-terminal-cyan/60 font-bold uppercase tracking-widest animate-pulse">
            Loading Customer Data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-12 text-terminal-cyan/60 font-bold uppercase tracking-widest">
            {searchQuery
              ? "No customers match your search"
              : "No customers found — add one above"}
          </div>
        ) : (
          <table className="w-full text-sm text-left font-mono">
            <thead className="bg-terminal-cyan text-black uppercase tracking-widest text-xs sticky top-0">
              <tr>
                <th className="p-4 font-bold">Customer</th>
                <th className="p-4 font-bold">Payment Terms</th>
                <th className="p-4 font-bold text-right">Total Billed</th>
                <th className="p-4 font-bold text-right">Total Paid</th>
                <th className="p-4 font-bold text-right">Outstanding</th>
                <th className="p-4 font-bold text-center">Invoices</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-terminal-cyan/20 text-terminal-cyan">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-terminal-cyan/10 transition-colors group"
                >
                  <td className="p-4 font-bold uppercase">{c.name}</td>
                  <td className="p-4 text-terminal-cyan/70 text-xs uppercase">
                    {c.payment_terms || "Net 30"}
                  </td>
                  <td className="p-4 text-right font-bold">
                    {formatCurrency(c.total_billed)}
                  </td>
                  <td className="p-4 text-right font-bold text-terminal-green">
                    {formatCurrency(c.total_paid)}
                  </td>
                  <td
                    className={`p-4 text-right font-bold ${c.outstanding > 0 ? "text-terminal-amber" : "text-terminal-green"}`}
                  >
                    {formatCurrency(c.outstanding)}
                  </td>
                  <td className="p-4 text-center">
                    <Link
                      href={`/dashboard/receivables?search=${encodeURIComponent(c.name)}`}
                      className="hover:text-white transition-colors"
                    >
                      <span className="flex items-center justify-center gap-1">
                        <FileText size={12} /> {c.invoice_count}
                      </span>
                    </Link>
                  </td>
                  <td className="p-4 text-center">
                    {c.overdue_count > 0 ? (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 border text-terminal-red border-terminal-red">
                        [{c.overdue_count} OVERDUE]
                      </span>
                    ) : c.outstanding > 0 ? (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 border text-terminal-amber border-terminal-amber">
                        [ACTIVE]
                      </span>
                    ) : c.invoice_count > 0 ? (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 border text-terminal-green border-terminal-green">
                        [CLEAR]
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 border text-terminal-cyan/30 border-terminal-cyan/30">
                        [NEW]
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="text-terminal-red/40 hover:text-terminal-red p-1.5 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Customer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary Footer */}
      {!loading && filtered.length > 0 && (
        <div className="flex justify-end gap-8 text-xs text-terminal-cyan/60 uppercase tracking-widest font-bold px-4">
          <span>
            Paid:{" "}
            <span className="text-terminal-green">
              {formatCurrency(totalPaid)}
            </span>
          </span>
          <span>
            Outstanding:{" "}
            <span className="text-terminal-amber">
              {formatCurrency(totalOutstanding)}
            </span>
          </span>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,255,255,0.1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-cyan uppercase tracking-widest flex items-center gap-2">
                <Plus size={20} /> Add Customer
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-terminal-cyan hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                  Customer Name *
                </label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                  placeholder="e.g. Acme Corp"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                  Payment Terms
                </label>
                <select
                  value={newTerms}
                  onChange={(e) => setNewTerms(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-transparent border-2 border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 uppercase font-bold tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-terminal-cyan text-black border-2 border-terminal-cyan hover:bg-cyan-200 uppercase font-bold tracking-widest text-xs"
                >
                  Create Customer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
