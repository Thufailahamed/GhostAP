"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CopyIcon,
  ArrowLeft,
  PlusCircle,
  CheckCircle,
  AlertCircle,
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
  customer: { id: number; name: string };
  payments: Payment[];
};

export default function ReceivableDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rec, setRec] = useState<Receivable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Wire");
  const [paymentReference, setPaymentReference] = useState("");

  const fetchReceivable = async (recId: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/receivables/${recId}`);
      setRec(data);
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
      <div className="text-terminal-green/50 animate-pulse font-mono tracking-widest text-sm uppercase">
        LOADING AR_RECORD...
      </div>
    );
  }

  if (error || !rec) {
    return (
      <div className="bg-terminal-red/10 border-2 border-terminal-red p-4 flex gap-4 text-terminal-red items-center font-mono">
        <AlertCircle />
        <p className="font-bold uppercase tracking-wider text-sm">
          {error || "Record not found"}
        </p>
      </div>
    );
  }

  const balance = rec.total_amount - rec.paid_amount;
  const isPaid = rec.status === "PAID";

  return (
    <div className="space-y-6 font-mono">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/receivables")}
          className="bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green hover:text-black p-2 h-auto"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            REC_{rec.invoice_number}
          </h1>
          <p className="text-terminal-amber font-mono mt-1 tracking-widest text-xs uppercase">
            Customer: {rec.customer.name}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 border border-terminal-green/50 px-4 py-2">
          <span className="text-terminal-green/50 text-xs">STATUS:</span>
          <span
            className={`font-bold uppercase tracking-widest text-lg ${isPaid ? "text-terminal-green" : "text-terminal-amber"}`}
          >
            [{rec.status}]
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* DETAILS PANEL */}
        <div className="border border-terminal-green bg-terminal-panel p-6 space-y-6">
          <h3 className="font-bold uppercase tracking-widest text-sm text-terminal-green border-b border-terminal-green/30 pb-2">
            Ledger Details
          </h3>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="text-xs text-terminal-green/50 uppercase tracking-widest">
                Total Amount
              </div>
              <div className="text-xl font-bold text-terminal-cyan">
                $
                {rec.total_amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-terminal-green/50 uppercase tracking-widest">
                Paid Amount
              </div>
              <div className="text-xl font-bold text-terminal-green">
                $
                {rec.paid_amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-terminal-green/50 uppercase tracking-widest">
                Remaining Balance
              </div>
              <div
                className={`text-xl font-bold ${balance > 0 ? "text-terminal-amber" : "text-terminal-green"}`}
              >
                $
                {balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-terminal-green/50 uppercase tracking-widest">
                Due Date
              </div>
              <div className="text-lg font-bold text-terminal-green">
                {rec.due_date
                  ? new Date(rec.due_date).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENTS PANEL */}
        <div className="space-y-6 border border-terminal-green bg-terminal-bg p-6">
          <h3 className="font-bold uppercase tracking-widest text-sm text-terminal-green border-b border-terminal-green/30 pb-2">
            Payment History
          </h3>
          {rec.payments.length === 0 ? (
            <div className="text-sm text-terminal-green/50 italic tracking-widest">
              No payments recorded.
            </div>
          ) : (
            <div className="space-y-4">
              {rec.payments.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center border-l-2 border-terminal-cyan pl-3"
                >
                  <div>
                    <div className="font-bold text-terminal-cyan">
                      $
                      {p.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-terminal-green/70">
                      {new Date(p.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{p.method}</div>
                    <div className="text-xs text-terminal-green/50">
                      {p.reference || "N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isPaid && (
            <form
              onSubmit={handleRecordPayment}
              className="mt-8 pt-6 border-t border-terminal-green/30 space-y-4"
            >
              <h4 className="font-bold uppercase tracking-widest text-xs text-terminal-amber mb-4">
                Record New Payment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-terminal-green/70">
                    Amount ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    max={balance}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="bg-transparent border-terminal-green text-terminal-green font-mono uppercase rounded-none focus-visible:ring-terminal-amber"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-terminal-green/70">
                    Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-10 border border-terminal-green bg-terminal-bg text-terminal-green font-mono px-3 outline-none focus:border-terminal-amber rounded-none"
                  >
                    <option value="Wire">Wire Transfer</option>
                    <option value="ACH">ACH</option>
                    <option value="Check">Check</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] uppercase text-terminal-green/70">
                    Reference (Tx ID / Check #)
                  </label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="bg-transparent border-terminal-green text-terminal-green font-mono rounded-none focus-visible:ring-terminal-amber"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-terminal-cyan text-black hover:bg-terminal-cyan font-bold tracking-widest uppercase gap-2"
              >
                <PlusCircle size={16} /> RECORD PAYMENT
              </Button>
            </form>
          )}
          {isPaid && (
            <div className="mt-6 pt-6 border-t border-terminal-green/30 flex justify-center text-terminal-green gap-2">
              <CheckCircle size={24} />
              <span className="font-bold text-lg tracking-widest">
                FULLY PAID
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
