"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import api from "@/lib/api";
import { CheckCircle, AlertCircle, RefreshCw, Link2, X, Upload, Database, ChevronDown, Wand2, Plus, ArrowRight } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { Button } from "@/components/ui/button";

interface BankAccount {
  id: number;
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  balance_current: number;
}

interface BankTxn {
  id: number;
  bank_account_id: number;
  date: string;
  amount: number;
  type: string;
  reference: string;
  merchant_name: string;
}

interface JournalLine {
  id: number;
  account_id: number;
  debit: number;
  credit: number;
  account_name?: string;
}

interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference: string;
  lines: JournalLine[];
}

interface Suggestion {
  bank_transaction_id: number;
  suggested_journal_id: number;
  confidence: number;
  reason: string;
}

export default function ReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [bankTxns, setBankTxns] = useState<BankTxn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { showToast, showConfirm } = useToast();

  const [selectedBankList, setSelectedBankList] = useState<number | null>(null);
  const [selectedJournalList, setSelectedJournalList] = useState<number | null>(null);

  // States for Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreateMatchModal, setShowCreateMatchModal] = useState<BankTxn | null>(null);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [targetGlAccount, setTargetGlAccount] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accRes, glRes] = await Promise.all([
        api.get("/bank-sync/accounts"),
        api.get("/categories/")
      ]);
      setAccounts(accRes.data);
      setGlAccounts(glRes.data);
      
      if (accRes.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accRes.data[0].id);
      }
    } catch (error) {
      showToast("Failed to fetch account data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmatched = async () => {
    if (!selectedAccountId) return;
    try {
      const [unmatchedRes, sugRes] = await Promise.all([
        api.get(`/reconciliation/unmatched?bank_account_id=${selectedAccountId}`),
        api.get("/reconciliation/suggestions")
      ]);
      setBankTxns(unmatchedRes.data.bank_transactions);
      setJournalEntries(unmatchedRes.data.journal_entries);
      setSuggestions(sugRes.data);
    } catch (error) {
      showToast("Failed to fetch reconciliation data", "error");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchUnmatched();
      setSelectedBankList(null);
      setSelectedJournalList(null);
    }
  }, [selectedAccountId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/bank-sync/sync-all");
      showToast("Synced bank feeds", "success");
      fetchUnmatched();
    } catch (error) {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedBankList || !selectedJournalList) return;
    
    try {
      await api.post("/reconciliation/match", {
        bank_transaction_id: selectedBankList,
        journal_entry_id: selectedJournalList
      });
      showToast("Reconciled successfully", "success");
      setBankTxns(prev => prev.filter(t => t.id !== selectedBankList));
      setJournalEntries(prev => prev.filter(j => j.id !== selectedJournalList));
      setSelectedBankList(null);
      setSelectedJournalList(null);
    } catch (error: any) {
      showToast(error.response?.data?.detail || "Failed to match", "error");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAccountId) return;

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    try {
      const res = await api.post(`/bank-sync/accounts/${selectedAccountId}/import-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      showToast(`Imported ${res.data.imported} transactions. ${res.data.skipped_duplicates} duplicates skipped.`, "success");
      fetchUnmatched();
      setShowImportModal(false);
    } catch (error: any) {
      showToast(error.response?.data?.detail || "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateAndMatch = async () => {
    if (!showCreateMatchModal || !targetGlAccount) return;

    try {
      await api.post("/reconciliation/create-and-match", {
        bank_transaction_id: showCreateMatchModal.id,
        account_id: parseInt(targetGlAccount)
      });
      showToast("Created GL entry and reconciled", "success");
      setBankTxns(prev => prev.filter(t => t.id !== showCreateMatchModal.id));
      setShowCreateMatchModal(null);
      setTargetGlAccount("");
      fetchUnmatched(); // Refresh GL list
    } catch (error: any) {
      showToast(error.response?.data?.detail || "Action failed", "error");
    }
  };

  const getJournalTotal = (entry: JournalEntry) => {
    return entry.lines.reduce((sum, line) => sum + line.debit, 0);
  };

  const selectedBankObj = bankTxns.find(t => t.id === selectedBankList);
  const selectedJournalObj = journalEntries.find(j => j.id === selectedJournalList);

  const isMatchingAmount = selectedBankObj && selectedJournalObj && 
      Math.abs(Math.abs(selectedBankObj.amount) - getJournalTotal(selectedJournalObj)) < 0.01;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-terminal-green">
        <RefreshCw className="animate-spin mb-4" size={48} />
        <span className="tracking-widest uppercase font-mono text-xl">Initializing_Ledger_Scanner...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Account Selector */}
      <div className="flex justify-between items-center border-b-2 border-terminal-green pb-6 text-terminal-green">
        <div className="flex items-center gap-6">
          <div className="bg-terminal-green text-black p-3">
            <RefreshCw size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tighter">Bank_Reconciliation</h1>
            <div className="flex items-center gap-4 mt-1">
              <select
                value={selectedAccountId || ""}
                onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
                className="bg-black border border-terminal-green text-terminal-green font-mono uppercase text-xs p-1 focus:outline-none"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.name} ({acc.account_number})</option>
                ))}
              </select>
              <span className="text-[10px] opacity-50 uppercase font-bold tracking-widest">
                {bankTxns.length} Pending // {journalEntries.length} Unlinked GL
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowImportModal(true)}
            className="bg-transparent border-2 border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan hover:text-black uppercase tracking-widest text-xs font-bold"
          >
            <Upload size={14} className="mr-2" /> Import CSV
          </Button>
          <Button 
            onClick={handleSync}
            disabled={syncing}
            className="bg-terminal-green text-black border-none hover:bg-terminal-green/80 uppercase tracking-widest text-xs font-bold"
          >
            <RefreshCw size={14} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} /> Sync Feeds
          </Button>
        </div>
      </div>

      {/* Matching Control Strip */}
      <div className={`border-2 p-5 flex items-center justify-between transition-all duration-300 ${selectedBankList && selectedJournalList ? (isMatchingAmount ? 'border-terminal-green bg-terminal-green/10 shadow-[0_0_20px_rgba(0,255,136,0.2)]' : 'border-terminal-amber bg-terminal-amber/10 shadow-[0_0_20px_rgba(255,191,0,0.2)]') : 'border-terminal-green/20 bg-black/50'}`}>
        <div className="flex-1 space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">Bank Side</div>
          {selectedBankObj ? (
            <div className="flex justify-between items-center pr-12">
              <span className="font-bold text-lg text-terminal-cyan">{selectedBankObj.merchant_name || 'Generic Transaction'}</span>
              <span className="text-terminal-cyan font-black text-xl"><CurrencyDisplay amount={Math.abs(selectedBankObj.amount)} /></span>
            </div>
          ) : <div className="text-white/20 italic font-mono uppercase text-xs">Waiting for selection...</div>}
        </div>

        <div className="flex flex-col items-center px-8">
           <Link2 size={32} className={`transition-all ${selectedBankList && selectedJournalList ? (isMatchingAmount ? 'text-terminal-green scale-110' : 'text-terminal-amber animate-pulse') : 'text-white/10'}`} />
        </div>

        <div className="flex-1 space-y-1 text-right border-l border-white/10 pl-12">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">Ledger Side</div>
          {selectedJournalObj ? (
            <div className="flex justify-between items-center">
              <span className="text-terminal-amber font-black text-xl"><CurrencyDisplay amount={getJournalTotal(selectedJournalObj)} /></span>
              <span className="font-bold text-lg text-terminal-amber text-right truncate max-w-[200px]">{selectedJournalObj.description}</span>
            </div>
          ) : <div className="text-white/20 italic font-mono uppercase text-xs">Waiting for selection...</div>}
        </div>

        <div className="ml-12">
          <Button
            onClick={handleMatch}
            disabled={!selectedBankList || !selectedJournalList}
            className={`h-12 px-10 font-black uppercase tracking-[0.3em] text-xs transition-all
              ${selectedBankList && selectedJournalList 
                  ? (isMatchingAmount ? "bg-terminal-green text-black hover:bg-green-400" : "bg-terminal-amber text-black hover:bg-amber-400")
                  : "bg-white/5 text-white/20 border border-white/10 cursor-not-allowed"}`}
          >
            {selectedBankList && selectedJournalList && !isMatchingAmount ? "Resolve Variance" : "Confirm Match"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 h-[700px]">
        {/* Left: Bank Records */}
        <div className="border-2 border-terminal-cyan bg-black/40 flex flex-col relative overflow-hidden group">
          <div className="bg-terminal-cyan/10 p-4 border-b-2 border-terminal-cyan flex justify-between items-center">
            <h2 className="font-black text-terminal-cyan tracking-[0.2em] text-xs uppercase flex items-center gap-2">
               Live_Statement_Data
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {bankTxns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-mono text-sm uppercase">No pending bank items.</div>
            ) : (
              bankTxns.map((txn) => {
                const isSelected = selectedBankList === txn.id;
                const sug = suggestions.find(s => s.bank_transaction_id === txn.id);
                // Highlight if it matches the selected journal
                const isSuggestedAuto = !isSelected && selectedJournalObj && (Math.abs(Math.abs(txn.amount) - getJournalTotal(selectedJournalObj)) < 0.01);

                return (
                  <div 
                    key={txn.id}
                    onClick={() => setSelectedBankList(isSelected ? null : txn.id)}
                    className={`border-2 p-4 cursor-pointer transition-all relative
                      ${isSelected ? "border-terminal-cyan bg-terminal-cyan/20 ring-4 ring-terminal-cyan/10" : 
                        isSuggestedAuto ? "border-terminal-green/50 bg-terminal-green/5 animate-pulse" :
                        sug ? "border-terminal-amber/30 bg-terminal-amber/5" : "border-white/5 hover:border-terminal-cyan/40 bg-white/2"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-bold opacity-40 uppercase">{new Date(txn.date).toLocaleDateString()}</span>
                       <span className={`text-sm font-black ${txn.amount > 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                         <CurrencyDisplay amount={Math.abs(txn.amount)} /> {txn.amount > 0 ? 'IN' : 'OUT'}
                       </span>
                    </div>
                    <div className="text-white font-bold uppercase tracking-tighter truncate">{txn.merchant_name || txn.reference || "Unknown Entity"}</div>
                    
                    {/* Actions on hover */}
                    <div className="mt-3 flex gap-2 opacity-0 group-hover/list:opacity-100 transition-opacity">
                       {!isSelected && (
                         <Button 
                          onClick={(e) => { e.stopPropagation(); setShowCreateMatchModal(txn); }}
                          variant="ghost" 
                          className="h-6 px-2 text-[8px] bg-terminal-green/10 text-terminal-green border border-terminal-green/20 hover:bg-terminal-green hover:text-black font-bold uppercase tracking-widest"
                         >
                           <Plus size={10} className="mr-1"/> Post & Match
                         </Button>
                       )}
                    </div>
                    
                    {sug && !isSelected && (
                      <div className="mt-2 text-[9px] text-terminal-amber font-bold uppercase flex items-center gap-1 border-t border-terminal-amber/20 pt-2">
                        <Wand2 size={10} /> {sug.reason} ({Math.round(sug.confidence * 100)}%)
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: GL Records */}
        <div className="border-2 border-terminal-amber bg-black/40 flex flex-col relative overflow-hidden group">
          <div className="bg-terminal-amber/10 p-4 border-b-2 border-terminal-amber flex justify-between items-center">
            <h2 className="font-black text-terminal-amber tracking-[0.2em] text-xs uppercase flex items-center gap-2">
               General_Ledger_Query
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {journalEntries.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-mono text-sm uppercase">No unlinked GL entries.</div>
            ) : (
                journalEntries.map((entry) => {
                const isSelected = selectedJournalList === entry.id;
                const total = getJournalTotal(entry);
                const isSuggestedAuto = !isSelected && selectedBankObj && (Math.abs(Math.abs(selectedBankObj.amount) - total) < 0.01);
                const isSuggestByAI = suggestions.some(s => s.suggested_journal_id === entry.id && s.bank_transaction_id === selectedBankList);

                return (
                  <div 
                    key={entry.id}
                    onClick={() => setSelectedJournalList(isSelected ? null : entry.id)}
                    className={`border-2 p-4 cursor-pointer transition-all relative
                      ${isSelected ? "border-terminal-amber bg-terminal-amber/20 ring-4 ring-terminal-amber/10" : 
                        isSuggestedAuto ? "border-terminal-green/50 bg-terminal-green/5 animate-pulse" :
                        isSuggestByAI ? "border-terminal-cyan/50 bg-terminal-cyan/5" : "border-white/5 hover:border-terminal-amber/40 bg-white/2"}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black text-terminal-amber uppercase tracking-widest">{entry.reference || `JRNL-${entry.id}`}</span>
                       <span className="text-[10px] font-bold opacity-40 uppercase">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-white font-bold uppercase tracking-tight line-clamp-1">{entry.description}</div>
                    
                    <div className="mt-3 bg-black/60 p-2 border border-white/5 space-y-1">
                       {entry.lines.slice(0, 2).map((l, i) => (
                         <div key={i} className="flex justify-between text-[9px] uppercase font-bold text-white/40">
                            <span>{l.account_name || `Acc_${l.account_id}`}</span>
                            <span className={l.debit > 0 ? "text-terminal-green" : "text-terminal-amber"}>
                                {l.debit > 0 ? "DR" : "CR"} <CurrencyDisplay amount={Math.max(l.debit, l.credit)} />
                            </span>
                         </div>
                       ))}
                       {entry.lines.length > 2 && <div className="text-[8px] text-center opacity-20">+ {entry.lines.length - 2} more lines</div>}
                    </div>

                    <div className="mt-2 flex justify-between items-center border-t border-white/10 pt-2">
                        <span className="text-[10px] font-black text-terminal-amber/50">Total Value</span>
                        <span className="text-xs font-black text-terminal-amber"><CurrencyDisplay amount={total} /></span>
                    </div>

                    {isSuggestByAI && <div className="mt-2 text-[9px] text-terminal-cyan font-bold uppercase flex items-center gap-1 border-t border-terminal-cyan/20 pt-2"><Wand2 size={10} /> Recommended for selection</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-terminal-panel border-4 border-terminal-cyan w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.3)]">
              <div className="bg-terminal-cyan text-black p-4 flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
                   <Upload size={20} /> Statement_Import_Buffer
                 </h3>
                 <button onClick={() => setShowImportModal(false)}><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="text-sm text-terminal-cyan/80 font-mono space-y-2">
                    <p>// Drag bank statement (CSV) into the buffer segment.</p>
                    <p>// Format: Date, Description, Amount (or Debit/Credit).</p>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-terminal-cyan/40 h-40 flex flex-col items-center justify-center cursor-pointer hover:border-terminal-cyan hover:bg-terminal-cyan/5 transition-all"
                >
                   {importing ? (
                     <RefreshCw className="animate-spin text-terminal-cyan" size={32} />
                   ) : (
                     <>
                       <Upload className="text-terminal-cyan/40 mb-3" size={40} />
                       <span className="text-terminal-cyan font-black uppercase text-xs tracking-[0.2em]">Select_CSV_Data_Packet</span>
                     </>
                   )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImportCSV} hidden accept=".csv" />
                
                <div className="flex justify-end gap-4">
                  <Button onClick={() => setShowImportModal(false)} variant="outline" className="border-terminal-cyan/40 text-terminal-cyan uppercase font-bold tracking-widest text-[10px]">Abandon_Process</Button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Create & Match Modal */}
      {showCreateMatchModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-terminal-panel border-4 border-terminal-green w-full max-w-md shadow-[0_0_50px_rgba(0,255,136,0.2)]">
              <div className="bg-terminal-green text-black p-4 flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
                   <Plus size={20} /> Direct_Ledger_Post
                 </h3>
                 <button onClick={() => setShowCreateMatchModal(null)}><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="bg-white/5 border border-white/10 p-4 font-mono text-xs space-y-3">
                    <div className="flex justify-between uppercase opacity-50"><span>Source</span> <span>Bank Statement</span></div>
                    <div className="flex justify-between font-bold text-terminal-green"><span>{showCreateMatchModal.merchant_name}</span> <span><CurrencyDisplay amount={Math.abs(showCreateMatchModal.amount)} /></span></div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] text-terminal-green/60 uppercase font-black tracking-widest">Select_Target_GL_Account</label>
                    <select 
                      value={targetGlAccount}
                      onChange={(e) => setTargetGlAccount(e.target.value)}
                      className="w-full bg-black border-2 border-terminal-green text-terminal-green p-3 font-mono text-xs focus:outline-none"
                    >
                       <option value="">-- Choose Segment --</option>
                       {glAccounts.map(acc => (
                         <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.type})</option>
                       ))}
                    </select>
                 </div>

                 <Button 
                   onClick={handleCreateAndMatch}
                   disabled={!targetGlAccount}
                   className="w-full h-14 bg-terminal-green text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-green-400 disabled:opacity-30"
                 >
                   Execute_Transaction <ArrowRight size={14} className="ml-2" />
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
