"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CopyIcon,
  ArrowLeft,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

type Payment = {
  id: number;
  amount: number;
  date: string;
  method: string;
  reference: string;
};

type Receivable = {
  id: number;
  invoice_number: string;
  customer_id: number;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  status: string;
  pdf_path: string | null;
  customer: { id: number; name: string };
  payments: Payment[];
};

export default function ReceivableDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rec, setRec] = useState<Receivable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Wire");
  const [paymentReference, setPaymentReference] = useState("");

  const fetchReceivable = async (recId: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/receivables/${recId}`);
      setRec(data);
      if (data.pdf_path) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        setPdfUrl(`${baseUrl}${data.pdf_path}`);
      }
    } catch (err: any) {
      setError("Failed to load receivable details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReceivable(id as string);
    }
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rec) return;
    try {
      await api.post(`/receivables/${rec.id}/payment`, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentReference,
      });
      // Refresh
      fetchReceivable(rec.id.toString());
      setPaymentAmount("");
      setPaymentReference("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to record payment");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-terminal-bg font-mono">
        <div className="text-terminal-green animate-pulse tracking-widest text-lg uppercase flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-terminal-green border-t-transparent rounded-full animate-spin"></div>
           CHARGING_AR_INTERFACE...
        </div>
      </div>
    );
  }

  if (error || !rec) {
    return (
      <div className="p-8">
        <div className="bg-terminal-red/10 border-2 border-terminal-red p-6 flex gap-4 text-terminal-red items-center font-mono">
          <AlertCircle size={32} />
          <div>
             <h2 className="font-bold uppercase tracking-widest text-lg">CRITICAL_RECORD_ERROR</h2>
             <p className="opacity-80">{error || "The requested receivable node could not be located in the ledger."}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard/receivables")} className="ml-auto border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-black">
             RE-ROUTE
          </Button>
        </div>
      </div>
    );
  }

  const balance = rec.total_amount - rec.paid_amount;
  const isPaid = rec.status === "PAID";

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-8 font-mono text-terminal-green bg-terminal-bg">
      {/* Header */}
      <header className="h-16 border-b-2 border-terminal-green bg-terminal-bg flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/receivables")}
            className="bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green hover:text-black p-2 h-auto"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="font-bold text-lg">
            RECEIVABLE: <span className="text-terminal-cyan">{rec.invoice_number}</span>
          </div>
          <p className="text-terminal-amber text-[10px] font-black uppercase tracking-widest border border-terminal-amber px-2 py-0.5 ml-2">
            {rec.customer.name}
          </p>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 border border-terminal-green/50 px-3 py-1">
              <span className="text-[10px] opacity-50 uppercase">Balance:</span>
              <span className={`font-bold ${balance > 0 ? "text-terminal-amber" : "text-terminal-green"}`}>
                 ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
           </div>
           <Button className="bg-terminal-green text-black hover:bg-terminal-green/80 font-bold text-xs px-6 border-none">
              SEND_STATEMENT
           </Button>
        </div>
      </header>

      {/* Split Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: PDF Preview Pane */}
        <div className="w-1/2 border-r-2 border-terminal-green bg-terminal-panel p-6 overflow-y-auto flex flex-col items-center">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-2 border-terminal-green shadow-[0_0_20px_rgba(0,255,136,0.1)]"
              title="Receivable PDF Preview"
            />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-terminal-green/30 flex flex-col items-center justify-center text-terminal-green/30 text-center p-12">
              <FileText size={80} className="mb-6 opacity-20" />
              <h3 className="text-xl font-bold uppercase tracking-[0.2em] mb-2">[ NO_DOCUMENT_LINKED ]</h3>
              <p className="text-sm max-w-[300px]">Electronic image not available for this ledger entry. Verify physical records.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Ledger Entry Verifier */}
        <div className="w-1/2 bg-terminal-bg overflow-y-auto flex flex-col">
           <div className="sticky top-0 z-10 bg-terminal-green/5 border-b border-terminal-green/20 p-4 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
                 <DollarSign size={14} /> TRANSACTION_METADATA
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none border ${isPaid ? "border-terminal-green text-terminal-green" : "border-terminal-amber text-terminal-amber"}`}>
                 {rec.status}
              </span>
           </div>

           <div className="p-8 space-y-10">
              {/* Financial Summary */}
              <section className="grid grid-cols-2 gap-8">
                 <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-terminal-green/50">Total Billed</label>
                    <div className="text-3xl font-black text-terminal-cyan leading-none">
                       ${rec.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-terminal-green/50">Applied Payments</label>
                    <div className="text-3xl font-black text-terminal-green leading-none">
                       ${rec.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-terminal-green/50">Issue Date</label>
                    <div className="text-lg font-bold">{new Date(rec.issue_date).toLocaleDateString()}</div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-terminal-green/50">Due Date</label>
                    <div className={`text-lg font-bold ${!isPaid && rec.due_date && new Date(rec.due_date) < new Date() ? "text-terminal-red underline decoration-wavy" : ""}`}>
                       {rec.due_date ? new Date(rec.due_date).toLocaleDateString() : "UPON RECEIPT"}
                    </div>
                 </div>
              </section>

              {/* Payment Recording */}
              <section className="border-t-2 border-terminal-green/20 pt-10">
                 <h3 className="font-black uppercase tracking-[0.2em] text-sm mb-6 flex items-center gap-2">
                    <PlusCircle size={18} /> RECORD_NEW_CASH_RECEIPT
                 </h3>
                 
                 <form onSubmit={handleRecordPayment} className="grid grid-cols-2 gap-6 bg-terminal-panel p-6 border border-terminal-green/30">
                    <div className="space-y-2">
                       <label className="text-[10px] uppercase font-bold text-terminal-green/50">Receipt Amount</label>
                       <Input
                         type="number"
                         step="0.01"
                         max={balance}
                         required
                         value={paymentAmount}
                         onChange={(e) => setPaymentAmount(e.target.value)}
                         className="bg-black border-terminal-green/50 text-terminal-green font-mono uppercase h-12 text-xl focus-visible:ring-terminal-amber"
                         placeholder="0.00"
                         disabled={isPaid}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] uppercase font-bold text-terminal-green/50">Payment Method</label>
                       <select
                         value={paymentMethod}
                         onChange={(e) => setPaymentMethod(e.target.value)}
                         className="w-full h-12 border border-terminal-green/50 bg-black text-terminal-green font-mono px-3 outline-none focus:border-terminal-amber rounded-none disabled:opacity-50"
                         disabled={isPaid}
                       >
                         <option value="Wire">Electronic Wire</option>
                         <option value="ACH">ACH Transfer</option>
                         <option value="Check">Physical Check</option>
                         <option value="Credit Card">Credit Card</option>
                       </select>
                    </div>
                    <div className="col-span-2 space-y-2">
                       <label className="text-[10px] uppercase font-bold text-terminal-green/50">Electronic Reference / Authorization #</label>
                       <Input
                         value={paymentReference}
                         onChange={(e) => setPaymentReference(e.target.value)}
                         className="bg-black border-terminal-green/50 text-terminal-green font-mono uppercase h-12 focus-visible:ring-terminal-amber"
                         placeholder="E.G. TXN-99823-AR"
                         disabled={isPaid}
                       />
                    </div>
                    <div className="col-span-2 pt-2">
                       <Button
                         type="submit"
                         className="w-full bg-terminal-green text-black hover:bg-terminal-green/90 font-black h-12 uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(0,255,136,0.3)] disabled:opacity-30 border-none"
                         disabled={isPaid || !paymentAmount}
                       >
                         {isPaid ? "RECORD_FULL_PAYMENT_MET" : "COMMIT_ENTRY"}
                       </Button>
                    </div>
                 </form>
              </section>

              {/* Audit Trail */}
              <section className="border-t-2 border-terminal-green/20 pt-10 pb-10">
                 <h3 className="font-black uppercase tracking-[0.2em] text-sm mb-6">Payment_History_Log</h3>
                 <div className="space-y-0 border border-terminal-green/30">
                    <div className="grid grid-cols-3 bg-terminal-green/10 p-3 text-[10px] font-black uppercase text-terminal-green opacity-70">
                       <div>Timestamp</div>
                       <div>Method</div>
                       <div className="text-right">Amount</div>
                    </div>
                    {rec.payments.length === 0 ? (
                       <div className="p-12 text-center text-[10px] text-terminal-green/30 uppercase font-black">
                          [ NO_ENTRIES_FOUND ]
                       </div>
                    ) : (
                       rec.payments.map((p, i) => (
                          <div key={i} className="grid grid-cols-3 p-4 border-b border-terminal-green/10 items-center hover:bg-terminal-green/5">
                             <div className="text-xs font-bold">{new Date(p.date).toLocaleDateString()}</div>
                             <div className="text-[10px]">
                                <span className="font-black uppercase">{p.method}</span>
                                <div className="text-terminal-green/50 truncate text-[9px]">{p.reference || "NO_REF"}</div>
                             </div>
                             <div className="text-right font-black text-terminal-green text-lg">
                                ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </section>
           </div>
        </div>
      </div>
    </div>
  );
}
