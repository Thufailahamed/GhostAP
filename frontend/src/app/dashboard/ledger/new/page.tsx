"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { BookDashed, Save, Plus, Trash2, ArrowLeft } from "lucide-react";

export default function NewJournalEntryPage() {
  const { settings } = useSettings();
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [lines, setLines] = useState([
    { account_id: "", debit: "", credit: "" },
    { account_id: "", debit: "", credit: "" },
  ]);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Chart of Accounts for the dropdowns
    api
      .get("/categories")
      .then((res) => setAccounts(res.data))
      .catch((err) => console.error("Failed to load accounts:", err));
  }, []);

  const totalDebits = lines.reduce(
    (sum, line) => sum + (parseFloat(line.debit) || 0),
    0,
  );
  const totalCredits = lines.reduce(
    (sum, line) => sum + (parseFloat(line.credit) || 0),
    0,
  );
  const isBalanced =
    Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const handleLineChange = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // Auto-clear opposite field to prevent both debit and credit on same line
    if (field === "debit" && value) newLines[index].credit = "";
    if (field === "credit" && value) newLines[index].debit = "";

    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { account_id: "", debit: "", credit: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return; // Minimum 2 lines
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description) {
      setError("Description is required.");
      return;
    }
    if (lines.some((l) => !l.account_id)) {
      setError("All lines must have an account selected.");
      return;
    }
    if (!isBalanced) {
      setError("Journal breaks double-entry math. Debits must equal Credits.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      date: new Date(date).toISOString(),
      description,
      reference: reference || null,
      lines: lines.map((l) => ({
        account_id: parseInt(l.account_id),
        debit: parseFloat(l.debit) || 0.0,
        credit: parseFloat(l.credit) || 0.0,
      })),
    };

    try {
      await api.post("/ledger/entries", payload);
      router.push("/dashboard/ledger");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to post entry.");
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6 font-mono pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-green">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <BookDashed size={24} />
            Post Journal Entry
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Manual general ledger adjustment.
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 border border-terminal-green text-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Cancel
        </button>
      </div>

      {error && (
        <div className="bg-terminal-red text-black font-bold p-4 uppercase tracking-widest flex items-center gap-4">
          <span className="bg-black text-terminal-red px-2 py-1 text-xs">
            ERR
          </span>
          {error}
        </div>
      )}

      {/* Form Details */}
      <div className="border-2 border-terminal-green bg-black p-6 space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-terminal-green/60 uppercase tracking-widest text-xs font-bold">
              Entry Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent border-b-2 border-terminal-green/50 text-terminal-green font-bold p-2 focus:border-terminal-green outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-terminal-green/60 uppercase tracking-widest text-xs font-bold">
              Reference # / Memo
            </label>
            <input
              type="text"
              placeholder="e.g. ADJ-2026-01"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-transparent border-b-2 border-terminal-green/50 text-terminal-green font-bold p-2 focus:border-terminal-green outline-none placeholder:text-terminal-green/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-terminal-green/60 uppercase tracking-widest text-xs font-bold">
            Description *
          </label>
          <input
            type="text"
            placeholder="Brief description of the adjustment"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-transparent border-b-2 border-terminal-green/50 text-terminal-green font-bold p-2 focus:border-terminal-green outline-none placeholder:text-terminal-green/20"
          />
        </div>
      </div>

      {/* Journal Lines */}
      <div className="border-2 border-terminal-green bg-black">
        <div className="bg-terminal-green text-black uppercase tracking-widest text-sm font-bold p-3 border-b border-terminal-green flex justify-between items-center">
          <span>Lines (Debits & Credits)</span>
          <button
            onClick={addLine}
            className="flex items-center gap-1 bg-black text-terminal-green px-2 py-1 text-xs hover:bg-terminal-green/80 hover:text-black border border-black transition-colors"
          >
            <Plus size={14} /> Add Line
          </button>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex gap-4 text-terminal-green/40 text-[10px] font-bold uppercase tracking-widest mb-2 px-2">
            <div className="w-12">Action</div>
            <div className="flex-1">Account</div>
            <div className="w-32 text-right">Debit (DR)</div>
            <div className="w-32 text-right">Credit (CR)</div>
          </div>

          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex gap-4 items-center bg-terminal-green/5 p-2"
            >
              <div className="w-12">
                <button
                  onClick={() => removeLine(idx)}
                  disabled={lines.length <= 2}
                  className="text-terminal-red/50 hover:text-terminal-red disabled:opacity-20"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex-1">
                <select
                  value={line.account_id}
                  onChange={(e) =>
                    handleLineChange(idx, "account_id", e.target.value)
                  }
                  className="w-full bg-transparent border-b border-terminal-green/30 text-terminal-green font-bold p-2 focus:border-terminal-green outline-none uppercase text-xs"
                >
                  <option value="" className="bg-black text-terminal-green">
                    -- Select Account --
                  </option>
                  {accounts.map((acc) => (
                    <option
                      key={acc.id}
                      value={acc.id}
                      className="bg-black text-terminal-green"
                    >
                      {acc.code} - {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={line.debit}
                  onChange={(e) =>
                    handleLineChange(idx, "debit", e.target.value)
                  }
                  className="w-full bg-transparent border-b border-terminal-green/30 text-terminal-green text-right font-bold p-2 focus:border-terminal-green outline-none placeholder:text-terminal-green/20"
                />
              </div>
              <div className="w-32">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={line.credit}
                  onChange={(e) =>
                    handleLineChange(idx, "credit", e.target.value)
                  }
                  className="w-full bg-transparent border-b border-terminal-amber/30 text-terminal-amber text-right font-bold p-2 focus:border-terminal-amber outline-none placeholder:text-terminal-amber/20"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Math Validation Footer */}
        <div className="bg-terminal-green/10 border-t border-terminal-green/30 p-4 flex justify-between items-center">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
            <span className="text-terminal-green/60">Math Validation:</span>
            {isBalanced ? (
              <span className="text-terminal-green border border-terminal-green px-2 py-1">
                OK [ BALANCED ]
              </span>
            ) : (
              <span className="text-terminal-red border border-terminal-red px-2 py-1 animate-pulse">
                ERR [ OUT OF BALANCE ]
              </span>
            )}
          </div>
          <div className="flex gap-8 text-lg font-bold tracking-widest">
            <div className="text-right">
              <div className="text-[10px] text-terminal-green/40 uppercase mb-1">
                Total Debits
              </div>
              <div className="text-terminal-green">
                {formatCurrency(totalDebits)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-terminal-amber/40 uppercase mb-1">
                Total Credits
              </div>
              <div className="text-terminal-amber">
                {formatCurrency(totalCredits)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSubmit}
          disabled={!isBalanced || isSubmitting}
          className="flex items-center gap-2 bg-terminal-green text-black px-8 py-3 uppercase tracking-widest text-sm font-bold hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          {isSubmitting ? "Posting..." : "[ POST_ENTRY ]"}
        </button>
      </div>
    </div>
  );
}
