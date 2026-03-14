"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import api from "@/lib/api";
import Link from "next/link";
import { BookDashed, Plus, RefreshCw, FileText } from "lucide-react";

export default function GeneralLedgerPage() {
  const { settings } = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/ledger/entries");
      setEntries(res.data);
    } catch (err) {
      console.error("Failed to fetch ledger entries:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
    }).format(val);
  };

  return (
    <div className="space-y-6 font-mono pb-12">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-green">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <BookDashed size={24} />
            General Ledger
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Immutable Double-Entry Accounting Records.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={fetchEntries}
            disabled={isLoading}
            className="flex items-center gap-2 border-2 border-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green hover:text-black transition-colors text-terminal-green"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Sync Ledger
          </button>
          <Link
            href="/dashboard/ledger/new"
            className="flex items-center gap-2 bg-terminal-green text-black border-2 border-terminal-green px-6 py-2 uppercase tracking-widest text-xs font-bold hover:bg-green-400 transition-colors"
          >
            <Plus size={16} />
            Post Entry
          </Link>
        </div>
      </div>

      {/* Ledger Entries List */}
      <div className="border-2 border-terminal-green bg-black">
        {isLoading ? (
          <div className="text-center p-12 text-terminal-green/60 font-bold uppercase tracking-widest animate-pulse">
            Querying Master Ledger...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center p-12 text-terminal-green/60 font-bold uppercase tracking-widest">
            No entries found in ledger.
          </div>
        ) : (
          <div className="space-y-0 text-sm">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="border-b border-terminal-green/30 last:border-0 p-4 hover:bg-terminal-green/5 transition-colors"
              >
                {/* Entry Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-terminal-green text-black font-bold uppercase tracking-widest px-2 py-1 text-xs">
                      ID: {entry.id.toString().padStart(6, "0")}
                    </div>
                    <span className="text-terminal-amber font-bold tracking-widest">
                      {new Date(entry.date).toLocaleString()}
                    </span>
                    {entry.reference && (
                      <span className="text-terminal-cyan flex items-center gap-1 text-xs font-bold tracking-widest border border-terminal-cyan px-2 py-1">
                        <FileText size={12} /> REF: {entry.reference}
                      </span>
                    )}
                  </div>
                </div>

                {/* Entry Description */}
                <div className="text-terminal-green font-bold text-lg uppercase tracking-widest mb-4">
                  {entry.description}
                </div>

                {/* Journal Lines Table */}
                <table className="w-full text-left font-mono text-sm border-t border-terminal-green/30 mt-2">
                  <thead>
                    <tr className="text-terminal-green/50 text-[10px] uppercase tracking-widest border-b border-terminal-green/30">
                      <th className="py-2 w-1/2">Account</th>
                      <th className="py-2 text-right w-1/4 pr-8">Debit DR</th>
                      <th className="py-2 text-right w-1/4 pr-4">Credit CR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-terminal-green/20">
                    {entry.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-terminal-green/10">
                        <td className="py-2 text-terminal-green/80 flex items-center gap-2">
                          <span className="text-terminal-green/40">
                            ACC_{line.account_id}
                          </span>
                        </td>
                        <td className="py-2 text-right font-bold pr-8 text-terminal-green">
                          {line.debit > 0 ? formatCurrency(line.debit) : ""}
                        </td>
                        <td className="py-2 text-right font-bold pr-4 text-terminal-amber">
                          {line.credit > 0 ? formatCurrency(line.credit) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
