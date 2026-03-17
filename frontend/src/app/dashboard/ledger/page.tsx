"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import api from "@/lib/api";
import Link from "next/link";
import { BookDashed, Plus, RefreshCw, FileText, Search, Undo2, Filter, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function GeneralLedgerPage() {
  const { settings } = useSettings();
  const { showToast, showConfirm } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchRef, setSearchRef] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (searchRef) params.reference = searchRef;
      const res = await api.get("/ledger/entries", { params });
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

  const handleReverse = async (entryId: number) => {
    const confirmed = await showConfirm("Create a reversing entry? This will generate an equal-and-opposite journal entry.");
    if (!confirmed) return;
    try {
      await api.post(`/ledger/entries/${entryId}/reverse`);
      showToast("Reversing entry posted successfully", "success");
      fetchEntries();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to reverse entry", "error");
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSearchRef("");
    setTimeout(fetchEntries, 0);
  };

  const totalDebits = entries.reduce((sum, e) =>
    sum + e.lines.reduce((ls: number, l: any) => ls + l.debit, 0), 0);
  const totalCredits = entries.reduce((sum, e) =>
    sum + e.lines.reduce((ls: number, l: any) => ls + l.credit, 0), 0);

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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border-2 px-4 py-2 uppercase tracking-widest text-xs font-bold transition-colors
              ${showFilters ? "border-terminal-cyan bg-terminal-cyan text-black" : "border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black"}`}
          >
            <Filter size={14} />
            Filters
          </button>
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

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-2 border-terminal-cyan bg-terminal-panel p-4">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest font-bold flex items-center gap-1">
                <Calendar size={10} /> Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-transparent border border-terminal-cyan/30 text-terminal-cyan font-mono p-2 text-xs focus:border-terminal-cyan outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest font-bold flex items-center gap-1">
                <Calendar size={10} /> Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-transparent border border-terminal-cyan/30 text-terminal-cyan font-mono p-2 text-xs focus:border-terminal-cyan outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest font-bold flex items-center gap-1">
                <Search size={10} /> Reference
              </label>
              <input
                type="text"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                placeholder="e.g. INV-2026"
                className="w-full bg-transparent border border-terminal-cyan/30 text-terminal-cyan font-mono p-2 text-xs focus:border-terminal-cyan outline-none placeholder:text-terminal-cyan/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchEntries}
                className="flex-1 bg-terminal-cyan text-black font-bold uppercase tracking-widest text-xs py-2 px-4 hover:bg-terminal-cyan/80 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={clearFilters}
                className="border border-terminal-cyan/30 text-terminal-cyan font-bold uppercase tracking-widest text-xs py-2 px-4 hover:bg-terminal-cyan/10 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-2 border-terminal-green bg-terminal-panel p-4">
          <div className="text-[10px] text-terminal-green/50 uppercase tracking-widest font-bold">Entries</div>
          <div className="text-2xl font-bold text-terminal-green mt-1">{entries.length}</div>
        </div>
        <div className="border-2 border-terminal-green bg-terminal-panel p-4">
          <div className="text-[10px] text-terminal-green/50 uppercase tracking-widest font-bold">Total Debits</div>
          <div className="text-2xl font-bold text-terminal-green mt-1"><CurrencyDisplay amount={totalDebits} /></div>
        </div>
        <div className="border-2 border-terminal-amber bg-terminal-panel p-4">
          <div className="text-[10px] text-terminal-amber/50 uppercase tracking-widest font-bold">Total Credits</div>
          <div className="text-2xl font-bold text-terminal-amber mt-1"><CurrencyDisplay amount={totalCredits} /></div>
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
                className="border-b border-terminal-green/30 last:border-0 p-4 hover:bg-terminal-green/5 transition-colors group"
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
                  <button
                    onClick={() => handleReverse(entry.id)}
                    className="flex items-center gap-1 border border-terminal-red/30 text-terminal-red/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest
                      hover:border-terminal-red hover:text-terminal-red hover:bg-terminal-red/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Create reversing entry"
                  >
                    <Undo2 size={12} /> Reverse
                  </button>
                </div>

                {/* Entry Description */}
                <div className="text-terminal-green font-bold text-lg uppercase tracking-widest mb-4">
                  {entry.description}
                </div>

                {/* Journal Lines Table */}
                <table className="w-full text-left font-mono text-sm border-t border-terminal-green/30 mt-2">
                  <thead>
                    <tr className="text-terminal-green/50 text-[10px] uppercase tracking-widest border-b border-terminal-green/30">
                      <th className="py-2 w-24">Code</th>
                      <th className="py-2">Account</th>
                      <th className="py-2 text-right w-1/4 pr-8">Debit DR</th>
                      <th className="py-2 text-right w-1/4 pr-4">Credit CR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-terminal-green/20">
                    {entry.lines.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-terminal-green/10">
                        <td className="py-2 text-terminal-green/40 text-xs font-bold">
                          {line.account_code || `#${line.account_id}`}
                        </td>
                        <td className="py-2 text-terminal-green/80">
                          <span className="font-bold">{line.account_name || `ACC_${line.account_id}`}</span>
                          {line.account_type && (
                            <span className="text-terminal-green/30 text-xs ml-2">({line.account_type})</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-bold pr-8 text-terminal-green">
                          {line.debit > 0 ? <CurrencyDisplay amount={line.debit} /> : ""}
                        </td>
                        <td className="py-2 text-right font-bold pr-4 text-terminal-amber">
                          {line.credit > 0 ? <CurrencyDisplay amount={line.credit} /> : ""}
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
