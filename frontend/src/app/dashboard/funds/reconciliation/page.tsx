"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import api from "@/lib/api";
import { CopyPlus, Check, RefreshCw } from "lucide-react";

export default function ReconciliationPage() {
  const { settings } = useSettings();
  const [bankFeed, setBankFeed] = useState<any[]>([]);
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [feedRes, ledgerRes] = await Promise.all([
        api.get("/funds/bank-feed"),
        api.get("/funds/transactions"),
      ]);
      setBankFeed(feedRes.data);
      // Only show unreconciled transactions on the right
      setLedgerTxs(ledgerRes.data.filter((tx: any) => !tx.reconciled));
    } catch (err) {
      console.error("Failed to fetch reconciliation data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMatch = async (transactionId: number, bankStmtId: string) => {
    try {
      // Reconcile the ledger transaction
      await api.patch(`/funds/transactions/${transactionId}/reconcile`);

      // Remove from UI
      setBankFeed((prev) => prev.filter((f) => f.bank_id !== bankStmtId));
      setLedgerTxs((prev) => prev.filter((t) => t.id !== transactionId));
      setSelectedBankId(null);
    } catch (err) {
      console.error("Match failed:", err);
    }
  };

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
            <CopyPlus size={24} />
            Bank Reconciliation
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Match raw bank feed lines against the system ledger.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 border-2 border-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green hover:text-black transition-colors text-terminal-green"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Sync Feed
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left Side: Raw Bank Feed */}
        <div className="border border-terminal-green/50 bg-black">
          <div className="bg-terminal-green text-black uppercase tracking-widest text-sm font-bold p-3 border-b border-terminal-green">
            [ RAW BANK FEED (Simulated) ]
          </div>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="text-terminal-green/50 text-xs text-center py-8 uppercase tracking-widest animate-pulse">
                Fetching Feed...
              </div>
            ) : bankFeed.length === 0 ? (
              <div className="text-terminal-green/50 text-xs text-center py-8 uppercase tracking-widest">
                No new bank lines
              </div>
            ) : (
              bankFeed.map((feed) => (
                <div
                  key={feed.bank_id}
                  className={`border-2 p-3 cursor-pointer transition-colors ${selectedBankId === feed.bank_id ? "border-terminal-amber bg-terminal-amber/10" : "border-terminal-green/30 hover:border-terminal-green/60"}`}
                  onClick={() => setSelectedBankId(feed.bank_id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-terminal-green/70">
                      {feed.date}
                    </span>
                    <span
                      className={`font-bold ${feed.amount >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
                    >
                      {formatCurrency(feed.amount)}
                    </span>
                  </div>
                  <div className="text-sm font-bold uppercase tracking-widest text-terminal-green">
                    {feed.description}
                  </div>
                  <div className="text-[10px] text-terminal-green/40 mt-2 uppercase">
                    ID: {feed.bank_id}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Unreconciled Ledger Transactions */}
        <div className="border border-terminal-green/50 bg-black">
          <div className="bg-terminal-green text-black uppercase tracking-widest text-sm font-bold p-3 border-b border-terminal-green">
            [ SYSTEM LEDGER (Unreconciled) ]
          </div>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="text-terminal-green/50 text-xs text-center py-8 uppercase tracking-widest animate-pulse">
                Loading Ledger...
              </div>
            ) : ledgerTxs.length === 0 ? (
              <div className="text-terminal-green/50 text-xs text-center py-8 uppercase tracking-widest">
                All matched
              </div>
            ) : (
              ledgerTxs.map((tx) => {
                const isSuggestedMatch =
                  selectedBankId &&
                  bankFeed.find((f) => f.bank_id === selectedBankId)
                    ?.match_hint_id === tx.id;
                return (
                  <div
                    key={tx.id}
                    className={`border-2 p-3 ${isSuggestedMatch ? "border-terminal-amber bg-terminal-amber/5" : "border-terminal-green/30"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-terminal-green/70">
                        {new Date(tx.date).toLocaleDateString()}
                      </span>
                      <span
                        className={`font-bold ${tx.amount >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
                      >
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <div className="text-sm font-bold uppercase tracking-widest text-terminal-green">
                      {tx.type} / REF: {tx.reference || "N/A"}
                    </div>
                    <div className="flex justify-between items-end mt-4">
                      <span className="text-[10px] text-terminal-green/40 uppercase">
                        LEDGER ID: {tx.id}
                      </span>
                      {selectedBankId && (
                        <button
                          onClick={() => handleMatch(tx.id, selectedBankId)}
                          className={`flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${isSuggestedMatch ? "bg-terminal-amber text-black hover:bg-yellow-500" : "border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black"}`}
                        >
                          <Check size={14} />
                          {isSuggestedMatch ? "Confirm Match" : "Force Match"}
                        </button>
                      )}
                    </div>
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
