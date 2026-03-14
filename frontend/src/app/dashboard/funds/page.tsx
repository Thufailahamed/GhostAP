"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import api from "@/lib/api";
import {
  Wallet,
  Plus,
  RefreshCw,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

export default function FundsPage() {
  const { showToast } = useToast();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "TRANSACTIONS">(
    "ACCOUNTS",
  );
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddTxModal, setShowAddTxModal] = useState(false);

  // Form States
  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");

  const [newTxType, setNewTxType] = useState("INCOMING");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxRef, setNewTxRef] = useState("");
  const [newTxBankId, setNewTxBankId] = useState("");

  const [showAddCashModal, setShowAddCashModal] = useState(false);
  const [newCashAmount, setNewCashAmount] = useState("");
  const [newCashRef, setNewCashRef] = useState(
    "Owner Investment / Manual Cash",
  );

  const fetchSummaryAndAccounts = async () => {
    setIsLoading(true);
    try {
      const [sumRes, accRes, txRes] = await Promise.all([
        api.get("/funds/summary"),
        api.get("/funds/bank-accounts"),
        api.get("/funds/transactions?limit=20"),
      ]);
      setSummary(sumRes.data);
      setAccounts(accRes.data);
      setTransactions(txRes.data);
      if (accRes.data.length > 0 && !newTxBankId) {
        setNewTxBankId(accRes.data[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch funds data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryAndAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/funds/bank-accounts", {
        name: newAccName,
        bank_name: newAccBank,
        account_number: newAccNumber,
        currency: settings?.base_currency || "USD",
      });
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccBank("");
      setNewAccNumber("");
      fetchSummaryAndAccounts();
    } catch (err) {
      console.error("Failed to add account", err);
      showToast("Error adding account", "error");
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxBankId) {
      showToast("Please select a bank account.", "error");
      return;
    }
    try {
      await api.post("/funds/transactions", {
        amount: parseFloat(newTxAmount),
        type: newTxType,
        reference: newTxRef,
        bank_account_id: parseInt(newTxBankId),
      });
      setShowAddTxModal(false);
      setNewTxAmount("");
      setNewTxRef("");
      fetchSummaryAndAccounts();
    } catch (err) {
      console.error("Failed to post transaction", err);
      showToast("Error posting transaction. Ensure amount is valid.", "error");
    }
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/funds/add-cash", {
        amount: parseFloat(newCashAmount),
        reference: newCashRef,
      });
      setShowAddCashModal(false);
      setNewCashAmount("");
      setNewCashRef("Owner Investment / Manual Cash");
      fetchSummaryAndAccounts();
    } catch (err: any) {
      console.error("Failed to add cash", err);
      showToast(err.response?.data?.detail || "Error adding cash.", "error");
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 font-mono pb-12">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-green">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <Wallet size={24} />
            Funds Management
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-2">
            Centralized Banking and Liquid Assets.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowAddCashModal(true)}
            className="flex items-center gap-2 bg-terminal-green text-black border-2 border-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-green-400 transition-colors"
          >
            <Plus size={14} />
            ADD CASH IN HAND
          </button>
          <button
            onClick={fetchSummaryAndAccounts}
            disabled={isLoading}
            className="flex items-center gap-2 border-2 border-terminal-green px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-green hover:text-black transition-colors text-terminal-green"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Sync Data
          </button>
          <Link
            href="/dashboard/funds/connect"
            className="flex items-center gap-2 border-2 border-terminal-cyan px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-cyan hover:text-black transition-colors text-terminal-cyan"
          >
            <Link2 size={14} />
            Manage Connections
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 border-2 border-terminal-green bg-black p-4">
          <div className="border border-terminal-green/30 p-4">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-1">
              Total Available Cash
            </div>
            <div className="text-terminal-green text-xl font-bold">
              {formatCurrency(summary.total_available_cash)}
            </div>
          </div>
          <div className="border border-terminal-green/30 p-4">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-1">
              Total Payables
            </div>
            <div className="text-terminal-amber text-xl font-bold">
              {formatCurrency(summary.total_payables)}
            </div>
          </div>
          <div className="border border-terminal-green/30 p-4">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-1">
              Total Receivables
            </div>
            <div className="text-terminal-cyan text-xl font-bold">
              {formatCurrency(summary.total_receivables)}
            </div>
          </div>
          <div className="border border-terminal-green/30 p-4">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-1">
              Net Position
            </div>
            <div
              className={
                summary.net_position >= 0
                  ? "text-green-500 text-xl font-bold"
                  : "text-red-500 text-xl font-bold"
              }
            >
              {formatCurrency(summary.net_position)}
            </div>
          </div>
        </div>
      )}

      {/* Controls & Modals */}
      <div className="flex items-center gap-6 border-b-2 border-terminal-green pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("ACCOUNTS")}
            className={`px-6 py-2 font-bold uppercase tracking-widest border-2 transition-all text-xs ${
              activeTab === "ACCOUNTS"
                ? "bg-terminal-green text-black border-terminal-green"
                : "bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green/20"
            }`}
          >
            [ Bank Accounts ]
          </button>
          <button
            onClick={() => setActiveTab("TRANSACTIONS")}
            className={`px-6 py-2 font-bold uppercase tracking-widest border-2 transition-all text-xs ${
              activeTab === "TRANSACTIONS"
                ? "bg-terminal-green text-black border-terminal-green"
                : "bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green/20"
            }`}
          >
            [ Transaction History ]
          </button>
        </div>

        <div className="flex-1"></div>

        <div className="flex gap-4">
          <Button
            onClick={() => setShowAddAccountModal(true)}
            className="font-bold text-xs tracking-widest bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black flex gap-2 uppercase"
          >
            <Plus size={16} /> New Account
          </Button>
          <Button
            onClick={() => setShowAddTxModal(true)}
            className="font-bold text-xs tracking-widest border-2 border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan hover:text-black bg-transparent flex gap-2 uppercase"
          >
            <Plus size={16} /> Post Transaction
          </Button>
        </div>
      </div>

      {/* Lists */}
      <div className="border-2 border-terminal-green bg-black">
        {isLoading ? (
          <div className="text-center p-12 text-terminal-green/60 font-bold uppercase tracking-widest animate-pulse">
            Querying Funds Repository...
          </div>
        ) : activeTab === "ACCOUNTS" ? (
          <div className="space-y-0 text-sm">
            {accounts.length === 0 ? (
              <div className="text-center p-12 text-terminal-amber/60 font-bold uppercase tracking-widest">
                No bank accounts registered.
              </div>
            ) : (
              accounts.map((acc: any) => (
                <div
                  key={acc.id}
                  className="border-b border-terminal-green/30 last:border-0 p-4 hover:bg-terminal-green/5 transition-colors flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-lg text-terminal-green uppercase flex items-center gap-2">
                      <Wallet size={16} className="text-terminal-green/50" />
                      {acc.name}
                    </div>
                    <div className="text-xs text-terminal-green/60 mt-1 uppercase tracking-widest flex gap-4">
                      <span>BANK: {acc.bank_name || "UNKNOWN"}</span>
                      <span>
                        ACCT: ****{acc.account_number?.slice(-4) || "0000"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-terminal-green/50 uppercase tracking-widest mb-1">
                      BALANCE
                    </div>
                    <div className="font-bold text-xl text-terminal-green">
                      {formatCurrency(acc.balance)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-0 text-sm">
            {transactions.length === 0 ? (
              <div className="text-center p-12 text-terminal-amber/60 font-bold uppercase tracking-widest">
                No transaction history.
              </div>
            ) : (
              transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="border-b border-terminal-green/30 last:border-0 p-4 hover:bg-terminal-green/5 transition-colors flex justify-between items-center"
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-8 flex justify-center">
                      {tx.type === "INCOMING" ? (
                        <ArrowDownRight className="text-terminal-green" />
                      ) : (
                        <ArrowUpRight className="text-terminal-amber" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-terminal-green uppercase tracking-widest">
                        {tx.reference || "MANUAL ENTRY"}
                      </div>
                      <div className="text-xs text-terminal-green/50 mt-1 uppercase">
                        {new Date(tx.date).toLocaleDateString()} | ACCT{" "}
                        {tx.bank_account_id}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-bold text-lg ${tx.amount < 0 ? "text-terminal-amber" : "text-terminal-green"}`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-terminal-bg border-4 border-terminal-green p-8 w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(200,200,200,0.1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
                <Wallet size={20} /> Register Account
              </h2>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="text-terminal-green hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                  Internal Alias
                </label>
                <input
                  required
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                  placeholder="e.g. MAIN OPERATING"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Bank Name
                  </label>
                  <input
                    required
                    type="text"
                    value={newAccBank}
                    onChange={(e) => setNewAccBank(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                    placeholder="CHASE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                    Account Num
                  </label>
                  <input
                    required
                    type="text"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors"
                    placeholder="12345678"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green/10 uppercase font-bold tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-terminal-green text-black border-2 border-terminal-green hover:bg-green-400 uppercase font-bold tracking-widest text-xs"
                >
                  Save Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddTxModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(200,200,200,0.1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-cyan uppercase tracking-widest flex items-center gap-2">
                <ArrowDownRight size={20} /> Post Transaction
              </h2>
              <button
                onClick={() => setShowAddTxModal(false)}
                className="text-terminal-cyan hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                  Bank Account
                </label>
                <select
                  required
                  value={newTxBankId}
                  onChange={(e) => setNewTxBankId(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (***{a.account_number?.slice(-4) || "0000"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                    Direction
                  </label>
                  <select
                    required
                    value={newTxType}
                    onChange={(e) => setNewTxType(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                  >
                    <option value="INCOMING">Incoming (+)</option>
                    <option value="OUTGOING">Outgoing (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                    Amount
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-terminal-cyan/60 uppercase tracking-widest mb-1">
                  Reference / Description
                </label>
                <input
                  required
                  type="text"
                  value={newTxRef}
                  onChange={(e) => setNewTxRef(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                  placeholder="e.g. VENDOR PAYMENT 103"
                />
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="bg-transparent border-2 border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 uppercase font-bold tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-terminal-cyan text-black border-2 border-terminal-cyan hover:bg-cyan-200 uppercase font-bold tracking-widest text-xs"
                >
                  Post to Ledger
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCashModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-terminal-bg border-4 border-terminal-green p-8 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(200,200,200,0.1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-green uppercase tracking-widest flex items-center gap-2">
                <Plus size={20} /> Add Cash In Hand
              </h2>
              <button
                onClick={() => setShowAddCashModal(false)}
                className="text-terminal-green hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddCash} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                  Deposit Amount
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newCashAmount}
                  onChange={(e) => setNewCashAmount(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-2xl outline-none focus:border-white transition-colors"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-terminal-green/60 uppercase tracking-widest mb-1">
                  Reference Note
                </label>
                <input
                  type="text"
                  value={newCashRef}
                  onChange={(e) => setNewCashRef(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-green p-3 text-terminal-green font-bold text-sm outline-none focus:border-white transition-colors uppercase"
                  placeholder="e.g. Owner Investment / Manual Cash"
                />
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button
                  type="button"
                  onClick={() => setShowAddCashModal(false)}
                  className="bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green/10 uppercase font-bold tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-terminal-green text-black border-2 border-terminal-green hover:bg-green-400 uppercase font-bold tracking-widest text-xs"
                >
                  Deposit Cash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
