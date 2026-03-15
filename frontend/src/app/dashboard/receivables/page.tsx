"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Plus,
  X,
  MoreHorizontal,
  DollarSign,
  AlertCircle,
  Send,
  Download,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { CurrencySelector } from "@/components/ui/currency-selector";

interface Receivable {
  id: number;
  invoice_number: string;
  customer: {
    name: string;
  };
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  currency: string;
  exchange_rate: number;
  status: string;
  pdf_path: string | null;
}

export default function ReceivablesListPage() {
  const router = useRouter();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/receivables/");
      setReceivables(res.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.patch(`/receivables/${id}/status`, { status });
      fetchData();
      showToast(`Status updated to ${status}.`, "success");
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    try {
      await api.post(`/receivables/${selectedReceivable.id}/payment`, {
        amount: parseFloat(paymentAmount),
        method: "BANK_TRANSFER",
        reference: paymentReference || "Manual Receipt",
      });
      setPaymentModalOpen(false);
      setPaymentAmount("");
      fetchData();
      showToast("Payment recorded!", "success");
    } catch (err: any) {
      showToast("Failed to log payment", "error");
    }
  };

  const filteredReceivables = receivables.filter((rec) => {
    const query = searchQuery.toLowerCase();
    return (
      rec.invoice_number.toLowerCase().includes(query) ||
      rec.customer?.name.toLowerCase().includes(query) ||
      rec.status.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan">
            RECEIVABLES_LEDGER
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // Accounts Receivable Tracking
          </p>
        </div>
        <Button
          onClick={() => router.push("/dashboard/receivables/new")}
          className="tracking-widest bg-terminal-cyan text-black hover:bg-cyan-200 border-none px-6 flex items-center gap-2"
        >
          <Plus size={16} /> NEW_RECEIVABLE
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex items-center border-2 border-terminal-cyan bg-terminal-panel px-4">
          <Search size={20} className="text-terminal-cyan/50" />
          <input
            type="text"
            placeholder="SEARCH INVOICES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm text-terminal-cyan placeholder:text-terminal-cyan/50"
          />
        </div>
      </div>

      <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel text-terminal-cyan">
        <CardContent className="p-0">
          <div className="relative">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b-2 border-terminal-cyan font-bold">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center animate-pulse uppercase">Syncing...</td></tr>
                ) : filteredReceivables.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center uppercase">No Records Found</td></tr>
                ) : (
                  filteredReceivables.map((rec) => (
                    <tr key={rec.id} className="border-b border-[#333] hover:bg-terminal-cyan/5 transition-colors">
                      <td className="px-6 py-4 font-mono flex items-center gap-2">
                        {rec.invoice_number}
                        <FileText size={12} className={`text-terminal-cyan ${rec.pdf_path ? "animate-pulse" : "opacity-40"}`} />
                      </td>
                      <td className="px-6 py-4 font-bold uppercase">{rec.customer?.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">{new Date(rec.issue_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono text-right"><CurrencyDisplay amount={rec.total_amount} currency={rec.currency} /></td>
                      <td className="px-6 py-4 font-mono text-right text-terminal-cyan">
                        <CurrencyDisplay amount={rec.total_amount - rec.paid_amount} currency={rec.currency} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 border ${
                          rec.status === "PAID" ? "text-terminal-green border-terminal-green" :
                          rec.status === "OVERDUE" ? "text-terminal-red border-terminal-red" : "text-terminal-amber border-terminal-amber"
                        }`}>[{rec.status}]</span>
                      </td>
                      <td className="px-6 py-4 text-center relative">
                        <Button variant="ghost" onClick={() => setOpenDropdownId(openDropdownId === rec.id ? null : rec.id)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {openDropdownId === rec.id && (
                          <div className="absolute right-8 top-12 z-50 w-48 bg-terminal-panel border-2 border-terminal-cyan p-0 font-mono shadow-lg">
                            <button className="w-full text-left hover:bg-terminal-cyan hover:text-black uppercase text-[10px] font-bold p-3 flex items-center gap-2" 
                              onClick={async () => {
                                const { data: { session } } = await supabase.auth.getSession();
                                const token = session?.access_token ? `?token=${session.access_token}` : "";
                                const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                if (rec.pdf_path) {
                                  window.open(`${baseUrl}${rec.pdf_path}`, "_blank");
                                } else {
                                  window.open(`${baseUrl}/receivables/${rec.id}/pdf${token}`, "_blank");
                                }
                                setOpenDropdownId(null);
                              }}>
                              <Download size={14} /> VIEW_DOC
                            </button>
                            <button className="w-full text-left hover:bg-terminal-cyan hover:text-black uppercase text-[10px] font-bold p-3 flex items-center gap-2"
                              onClick={() => {
                                setSelectedReceivable(rec);
                                setPaymentModalOpen(true);
                                setOpenDropdownId(null);
                              }}>
                              <DollarSign size={14} /> Pay
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {paymentModalOpen && selectedReceivable && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-terminal-cyan uppercase mb-6 flex items-center gap-2"><DollarSign size={20} /> Log Receipt</h2>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="bg-terminal-cyan/5 p-4 border border-terminal-cyan/20 font-mono text-xs space-y-1">
                <div className="flex justify-between"><span>Inv:</span><span>{selectedReceivable.invoice_number}</span></div>
                <div className="flex justify-between">
                  <span>Bal:</span>
                  <span className="text-terminal-cyan">
                    <CurrencyDisplay amount={selectedReceivable.total_amount - selectedReceivable.paid_amount} currency={selectedReceivable.currency} />
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Amount</label>
                <input required type="number" step="0.01" max={selectedReceivable.total_amount - selectedReceivable.paid_amount} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button type="button" onClick={() => setPaymentModalOpen(false)} className="bg-transparent border border-terminal-cyan text-terminal-cyan uppercase text-xs">Cancel</Button>
                <Button type="submit" className="bg-terminal-cyan text-black uppercase text-xs px-6">Record</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
