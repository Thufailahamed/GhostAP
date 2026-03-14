"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import api from "@/lib/api";
import { CheckCircle, AlertCircle, RefreshCw, Link2, X } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/currency-display";

interface BankTxn {
  id: number;
  date: string;
  amount: number;
  type: string;
  reference: string;
}

interface JournalLine {
  id: number;
  account_id: number;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference: string;
  lines: JournalLine[];
}

export default function ReconciliationPage() {
  const [bankTxns, setBankTxns] = useState<BankTxn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [selectedBankList, setSelectedBankList] = useState<number | null>(null);
  const [selectedJournalList, setSelectedJournalList] = useState<number | null>(null);

  const fetchUnmatched = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/reconciliation/unmatched");
      setBankTxns(data.bank_transactions);
      setJournalEntries(data.journal_entries);
    } catch (error) {
      showToast("Failed to fetch reconciliation data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnmatched();
  }, []);

  const handleMatch = async () => {
    if (!selectedBankList || !selectedJournalList) return;
    
    try {
      await api.post("/reconciliation/match", {
        bank_transaction_id: selectedBankList,
        journal_entry_id: selectedJournalList
      });
      showToast("Transaction matched and reconciled successfully", "success");
      // Remove them from local state
      setBankTxns(prev => prev.filter(t => t.id !== selectedBankList));
      setJournalEntries(prev => prev.filter(j => j.id !== selectedJournalList));
      // Reset selection
      setSelectedBankList(null);
      setSelectedJournalList(null);
    } catch (error: any) {
      showToast(error.response?.data?.detail || "Failed to match transaction", "error");
    }
  };

  const getJournalTotal = (entry: JournalEntry) => {
    return entry.lines.reduce((sum, line) => sum + line.debit, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-terminal-green">
        <RefreshCw className="animate-spin" size={32} />
        <span className="ml-4 tracking-widest uppercase font-mono">Scanning ledgers...</span>
      </div>
    );
  }

  const selectedBankObj = bankTxns.find(t => t.id === selectedBankList);
  const selectedJournalObj = journalEntries.find(j => j.id === selectedJournalList);

  const isMatchingAmount = selectedBankObj && selectedJournalObj && 
      Math.abs(Math.abs(selectedBankObj.amount) - getJournalTotal(selectedJournalObj)) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            BANK_RECONCILIATION
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
            Match Bank Feeds vs General Ledger
          </p>
        </div>
        <div className="text-xs font-mono text-terminal-cyan flex items-center gap-4">
          <span>Unmatched Bank: {bankTxns.length}</span>
          <span>Unmatched GL: {journalEntries.length}</span>
        </div>
      </div>

      {/* Control Panel for Selection */}
      <div className={`border-2 p-4 flex items-center justify-between transition-colors ${selectedBankList && selectedJournalList ? (isMatchingAmount ? 'border-terminal-green bg-terminal-green/10' : 'border-terminal-amber bg-terminal-amber/10') : 'border-terminal-green/30 bg-black'}`}>
        <div className="flex gap-8 items-center font-mono text-sm w-full">
          <div className="flex-1">
            <div className="text-[10px] text-terminal-green/50 uppercase tracking-widest mb-1">Selected Bank Transaction</div>
            {selectedBankObj ? (
              <div className="flex justify-between items-center text-terminal-cyan">
                <span>{new Date(selectedBankObj.date).toLocaleDateString()} - {selectedBankObj.reference || "No Ref"}</span>
                <span className="font-bold">
                  <CurrencyDisplay amount={Math.abs(selectedBankObj.amount)} /> {selectedBankObj.amount > 0 ? '(IN)' : '(OUT)'}
                </span>
              </div>
            ) : <span className="text-terminal-green/30 italic">None selected...</span>}
          </div>
          
          <div className="flex flex-col items-center">
            <Link2 size={24} className={selectedBankList && selectedJournalList ? (isMatchingAmount ? "text-terminal-green" : "text-terminal-amber") : "text-terminal-green/20"} />
          </div>

          <div className="flex-1">
            <div className="text-[10px] text-terminal-green/50 uppercase tracking-widest mb-1">Selected Ledger Entry</div>
            {selectedJournalObj ? (
              <div className="flex justify-between items-center text-terminal-amber">
                <span>{new Date(selectedJournalObj.date).toLocaleDateString()} - {selectedJournalObj.description}</span>
                <span className="font-bold">
                  <CurrencyDisplay amount={getJournalTotal(selectedJournalObj)} />
                </span>
              </div>
            ) : <span className="text-terminal-green/30 italic">None selected...</span>}
          </div>
        </div>
        
        <div className="ml-8 flex-shrink-0">
          <button 
            onClick={handleMatch}
            disabled={!selectedBankList || !selectedJournalList} 
            className={`px-8 py-3 font-bold text-xs tracking-widest uppercase transition-all
              ${selectedBankList && selectedJournalList 
                  ? (isMatchingAmount 
                      ? "bg-terminal-green text-black hover:bg-terminal-green/80 hover:shadow-[0_0_15px_rgba(0,255,136,0.5)]" 
                      : "bg-terminal-amber text-black hover:bg-terminal-amber/80") 
                  : "bg-terminal-green/10 text-terminal-green/30 cursor-not-allowed border border-terminal-green/20"}`}
          >
            {selectedBankList && selectedJournalList && !isMatchingAmount ? "Force Match (Variance)" : "Match & Clear"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 h-[800px]">
        {/* Left Pane: Bank Feed */}
        <div className="border-2 border-terminal-cyan flex flex-col h-full bg-black shrink-0 relative">
          <div className="bg-terminal-cyan/20 p-3 border-b-2 border-terminal-cyan flex justify-between items-center sticky top-0">
            <h2 className="font-bold text-terminal-cyan tracking-widest text-sm uppercase flex items-center gap-2">
              <CheckCircle size={14}/> Live Bank Feed (Pending)
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 relative custom-scrollbar">
            {bankTxns.length === 0 ? (
              <div className="text-terminal-cyan/50 text-center mt-12 font-mono text-sm uppercase italic">No unmatched bank transactions.</div>
            ) : (
              bankTxns.map((txn) => {
                const isSelected = selectedBankList === txn.id;
                // Auto-suggest logic: if this bank amount perfectly matches the currently selected Journal amount
                const isSuggested = !isSelected && selectedJournalObj && (Math.abs(Math.abs(txn.amount) - getJournalTotal(selectedJournalObj)) < 0.01);

                return (
                  <div 
                    key={txn.id} 
                    onClick={() => setSelectedBankList(isSelected ? null : txn.id)}
                    className={`border p-3 cursor-pointer transition-all font-mono text-xs
                      ${isSelected ? "border-terminal-cyan bg-terminal-cyan/20 shadow-[0_0_10px_rgba(0,255,255,0.3)]" : 
                        isSuggested ? "border-terminal-cyan border-dashed bg-terminal-cyan/5 object-pulse" : 
                        "border-terminal-cyan/30 hover:border-terminal-cyan/60"}`}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="text-terminal-cyan/70">{new Date(txn.date).toLocaleDateString()}</span>
                      <span className={`font-bold ${txn.amount > 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        <CurrencyDisplay amount={Math.abs(txn.amount)} /> {txn.amount > 0 ? 'IN' : 'OUT'}
                      </span>
                    </div>
                    <div className="text-terminal-cyan line-clamp-2">{txn.reference || txn.type || "Incoming/Outgoing Wire"}</div>
                    {isSuggested && <div className="mt-2 text-[10px] text-terminal-cyan uppercase tracking-widest font-bold">● Match Found</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: General Ledger */}
        <div className="border-2 border-terminal-amber flex flex-col h-full bg-black shrink-0 relative">
          <div className="bg-terminal-amber/20 p-3 border-b-2 border-terminal-amber flex justify-between items-center sticky top-0">
            <h2 className="font-bold text-terminal-amber tracking-widest text-sm uppercase flex items-center gap-2">
              <AlertCircle size={14}/> General Ledger (Unlinked)
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 relative custom-scrollbar">
            {journalEntries.length === 0 ? (
              <div className="text-terminal-amber/50 text-center mt-12 font-mono text-sm uppercase italic">No unlinked journal entries.</div>
            ) : (
              journalEntries.map((entry) => {
                const isSelected = selectedJournalList === entry.id;
                const total = getJournalTotal(entry);
                // Auto-suggest logic: if this journal amount perfectly matches the currently selected Bank amount
                const isSuggested = !isSelected && selectedBankObj && (Math.abs(Math.abs(selectedBankObj.amount) - total) < 0.01);

                return (
                  <div 
                    key={entry.id} 
                    onClick={() => setSelectedJournalList(isSelected ? null : entry.id)}
                    className={`border p-3 cursor-pointer transition-all font-mono text-xs
                      ${isSelected ? "border-terminal-amber bg-terminal-amber/20 shadow-[0_0_10px_rgba(255,176,0,0.3)]" : 
                        isSuggested ? "border-terminal-amber border-dashed bg-terminal-amber/5 animate-pulse" : 
                        "border-terminal-amber/30 hover:border-terminal-amber/60"}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-terminal-amber/70 font-bold">{entry.reference || `JRNL-${entry.id}`}</span>
                      <span className="text-terminal-amber/70">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-terminal-amber mb-3 break-words">{entry.description}</div>
                    
                    <div className="bg-black border border-terminal-amber/20 p-2 space-y-1">
                      {entry.lines.map((line) => (
                        <div key={line.id} className="flex justify-between text-[10px] text-terminal-amber/50">
                          <span>ACCT_{line.account_id}</span>
                          <div className="flex gap-4">
                           {line.debit > 0 && <span>DR: <CurrencyDisplay amount={line.debit} /></span>}
                           {line.credit > 0 && <span>CR: <CurrencyDisplay amount={line.credit} /></span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t border-terminal-amber/20 pt-2 text-terminal-amber font-bold">
                        <span>NET TOTAL</span>
                        <CurrencyDisplay amount={total} />
                    </div>
                    {isSuggested && <div className="mt-2 text-[10px] text-terminal-amber uppercase tracking-widest font-bold">● Match Found</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
