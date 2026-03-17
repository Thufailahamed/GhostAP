"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertCircle, Plus, Trash2, FolderTree, Edit3, Database, 
  ChevronDown, ChevronRight, Shield, Search, Info,
  BookOpen, Calculator
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";

type Category = {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
  parent_id: number | null;
  is_system: boolean;
};

type AccountBalance = {
  account_id: number;
  code: string;
  name: string;
  type: string;
  debit_total: number;
  credit_total: number;
  balance: number;
};

export default function CategoriesPage() {
  const { showToast, showConfirm } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Create form
  const [newCat, setNewCat] = useState({
    code: "",
    name: "",
    type: "Expense",
    description: "",
    parent_id: null as number | null,
    opening_balance: "" as string,
  });

  // Edit modal
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({
    code: "",
    name: "",
    description: "",
    parent_id: null as number | null,
  });

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const [catRes, balRes] = await Promise.all([
        api.get("/categories/"),
        api.get("/categories/balances"),
      ]);
      setCategories(catRes.data);
      setBalances(balRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/categories/", {
        code: newCat.code,
        name: newCat.name,
        type: newCat.type,
        description: newCat.description,
        parent_id: newCat.parent_id,
      });

      // Handle Opening Balance via Journal Entry
      const ob = parseFloat(newCat.opening_balance);
      if (!isNaN(ob) && ob !== 0) {
        try {
          // Find Equity account for balancing (Equity / Opening Balance Equity)
          const equityAcc = categories.find(c => c.type === "Equity") || res.data;
          
          await api.post("/ledger/entries", {
            date: new Date().toISOString(),
            description: `Opening Balance: ${newCat.name}`,
            reference: "OPENING",
            lines: [
              {
                account_id: res.data.id,
                debit: ob > 0 ? Math.abs(ob) : 0,
                credit: ob < 0 ? Math.abs(ob) : 0,
              },
              {
                account_id: equityAcc.id,
                debit: ob < 0 ? Math.abs(ob) : 0,
                credit: ob > 0 ? Math.abs(ob) : 0,
              }
            ]
          });
        } catch (jeErr) {
          console.error("Failed to post opening balance journal", jeErr);
          showToast("Account created, but opening balance journal failed.", "error");
        }
      }

      setNewCat({ code: "", name: "", type: "Expense", description: "", parent_id: null, opening_balance: "" });
      fetchCategories();
      showToast("Account created successfully", "success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create category.");
    }
  };

  const handleEdit = async () => {
    if (!editingCat) return;
    try {
      await api.put(`/categories/${editingCat.id}`, editForm);
      setEditingCat(null);
      fetchCategories();
      showToast("Account updated successfully", "success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update category.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm("Delete this account? Accounts with journal entries cannot be deleted.");
    if (!confirmed) return;
    setError("");
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
      showToast("Account deleted", "success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete category.");
    }
  };

  const handleSeedDefaults = async () => {
    const confirmed = await showConfirm("This will create 25+ standard accounts (Cash, AR, AP, Revenue, etc.). Proceed?");
    if (!confirmed) return;
    try {
      const res = await api.post("/categories/seed-defaults");
      showToast(res.data.message, "success");
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to seed accounts.");
    }
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setEditForm({
      code: cat.code,
      name: cat.name,
      description: cat.description || "",
      parent_id: cat.parent_id,
    });
  };

  const toggleNode = (id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getBalanceForAccount = (id: number) => {
    return balances.find(b => b.account_id === id);
  };

  const getGroupColor = (type: string) => {
    switch (type.toUpperCase()) {
      case "ASSET": return "border-terminal-green text-terminal-green";
      case "LIABILITY": return "border-terminal-red text-terminal-red";
      case "EQUITY": return "border-white text-white";
      case "REVENUE": return "border-terminal-cyan text-terminal-cyan";
      case "EXPENSE": return "border-terminal-amber text-terminal-amber";
      default: return "border-terminal-green text-terminal-green";
    }
  };

  // Build Tree Data
  const treeData = useMemo(() => {
    const filtered = categories.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "ALL" || c.type.toUpperCase() === filterType;
      return matchesSearch && matchesType;
    });

    const buildTree = (parentId: number | null): any[] => {
      return filtered
        .filter(c => c.parent_id === parentId)
        .map(c => ({
          ...c,
          children: buildTree(c.id)
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    };

    // If searching, we skip hierarchy and show flat list to avoid confusion
    if (searchQuery) {
        return filtered.map(c => ({ ...c, children: [] }));
    }

    return buildTree(null);
  }, [categories, searchQuery, filterType]);

  const AccountItem = ({ account, depth = 0 }: { account: any, depth?: number }) => {
    const bal = getBalanceForAccount(account.id);
    const hasChildren = account.children.length > 0;
    const isExpanded = expandedNodes.has(account.id);

    return (
      <>
        <tr className="border-b border-current/10 hover:bg-white/5 transition-colors group">
          <td className="px-4 py-3 font-bold text-xs">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
              {hasChildren ? (
                <button onClick={() => toggleNode(account.id)} className="opacity-60 hover:opacity-100">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <div className="w-[14px]" />
              )}
              {account.code}
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-bold">{account.name}</span>
              {account.is_system && (
                <Shield size={10} className="opacity-40" title="System Account" />
              )}
            </div>
            {account.description && (
              <div className="text-xs opacity-40 mt-0.5">
                {account.description}
              </div>
            )}
          </td>
          {!searchQuery && (
            <td className="px-4 py-3 text-xs opacity-60 uppercase tracking-widest hidden md:table-cell">
              {account.type}
            </td>
          )}
          <td className="px-4 py-3 text-right font-bold">
            {bal && (bal.balance !== 0 || bal.debit_total !== 0 || bal.credit_total !== 0) ? (
              <div className="flex flex-col items-end">
                <CurrencyDisplay amount={bal.balance} />
                {hasChildren && depth === 0 && (
                   <span className="text-[10px] opacity-40 uppercase tracking-tighter">(Aggregate)</span>
                )}
              </div>
            ) : (
              <span className="opacity-20">—</span>
            )}
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                onClick={() => openEdit(account)}
                className="text-terminal-cyan hover:text-black hover:bg-terminal-cyan h-7 w-7 p-0"
              >
                <Edit3 size={12} />
              </Button>
              {!account.is_system && (
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(account.id)}
                  className="text-terminal-red hover:text-black hover:bg-terminal-red h-7 w-7 p-0"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && account.children.map((child: any) => (
          <AccountItem key={child.id} account={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-terminal-green pb-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <FolderTree size={28} />
            CHART_OF_ACCOUNTS
          </h1>
          <p className="text-terminal-green/50 font-mono mt-1 tracking-widest text-xs uppercase">
            Finance OS // General Ledger Categorization
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => window.open('/accounting-guide', '_blank')}
            variant="outline"
            className="border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 uppercase tracking-widest text-xs font-bold flex items-center gap-2"
          >
            <BookOpen size={14} /> Guide
          </Button>
          {categories.length === 0 && (
            <Button
              onClick={handleSeedDefaults}
              className="bg-terminal-cyan text-black border-none hover:bg-terminal-cyan/80 uppercase tracking-widest text-xs font-bold flex items-center gap-2"
            >
              <Database size={14} /> Seed Defaults
            </Button>
          )}
        </div>
      </div>

      {/* View Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-1">
          {["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map(
            (type) => (
              <Button
                key={type}
                type="button"
                variant={filterType === type ? "default" : "outline"}
                onClick={() => setFilterType(type)}
                className={`flex-shrink-0 min-w-24 ${filterType === type ? "bg-terminal-green text-black border-none font-bold" : "bg-transparent text-terminal-green border-terminal-green/50 hover:border-terminal-green"}`}
              >
                {type}
              </Button>
            ),
          )}
        </div>
        <div className="relative w-full md:w-64">
           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-green/50" />
           <Input 
             placeholder="SEARCH ACCOUNTS..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="bg-black/50 border-terminal-green/30 text-terminal-green pl-9 font-mono text-xs focus-visible:ring-terminal-amber h-10 rounded-none uppercase tracking-widest"
           />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* CREATE NEW FORM */}
        <form
          onSubmit={handleCreate}
          className="border-2 border-terminal-green bg-terminal-panel p-6 space-y-4 lg:sticky lg:top-6"
        >
          <h3 className="font-bold uppercase tracking-widest text-terminal-green border-b border-terminal-green/30 pb-2 flex items-center gap-2">
            <Plus size={16} /> New Account
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-terminal-green/70">Account Code</label>
              <Input
                required
                value={newCat.code}
                onChange={(e) => setNewCat({ ...newCat, code: e.target.value })}
                placeholder="e.g. 1000"
                className="bg-transparent border-terminal-green text-terminal-green font-mono uppercase rounded-none h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-terminal-green/70">Account Name</label>
              <Input
                required
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                placeholder="e.g. Petty Cash"
                className="bg-transparent border-terminal-green text-terminal-green font-mono rounded-none h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-terminal-green/70">Type</label>
                <select
                    required
                    value={newCat.type}
                    onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
                    className="w-full h-8 border border-terminal-green bg-terminal-bg text-terminal-green font-mono text-xs outline-none px-2 focus:border-terminal-amber rounded-none"
                >
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                </select>
                </div>
                <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-terminal-green/70">Parent</label>
                <select
                    value={newCat.parent_id || ""}
                    onChange={(e) => setNewCat({ ...newCat, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full h-8 border border-terminal-green bg-terminal-bg text-terminal-green font-mono text-xs outline-none px-2 focus:border-terminal-amber rounded-none"
                >
                    <option value="">[None]</option>
                    {categories
                        .filter(c => c.type === newCat.type)
                        .map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)
                    }
                </select>
                </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-terminal-green/70 flex items-center justify-between">
                <span>Opening Balance ($)</span>
                <Calculator size={10} className="opacity-40" />
              </label>
              <Input
                type="number"
                step="0.01"
                value={newCat.opening_balance}
                onChange={(e) => setNewCat({ ...newCat, opening_balance: e.target.value })}
                placeholder="0.00"
                className="bg-transparent border-terminal-amber text-terminal-amber font-mono rounded-none h-8 text-xs"
              />
              <p className="text-[9px] opacity-40 mt-1 italic uppercase">Initial entry for ledger cut-over.</p>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full mt-4 bg-terminal-green text-black hover:bg-terminal-green border-none flex items-center justify-center gap-2 font-black uppercase text-xs h-10"
          >
            REGISTER_ACCOUNT
          </Button>
        </form>

        {/* LIST / TABLE */}
        <div className="lg:col-span-3 space-y-4">
          <div className="border border-terminal-green/20 bg-terminal-panel overflow-hidden">
            <table className="w-full text-sm text-left font-mono">
              <thead className="bg-terminal-green/10 border-b-2 border-terminal-green text-xs uppercase font-bold tracking-widest text-terminal-green">
                <tr>
                  <th className="px-4 py-3 w-32">Code</th>
                  <th className="px-4 py-3">Account Account</th>
                  {!searchQuery && <th className="px-4 py-3 hidden md:table-cell">Type</th>}
                  <th className="px-4 py-3 text-right w-40">Running Balance</th>
                  <th className="px-4 py-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-24 text-center">
                       <div className="flex flex-col items-center gap-4 animate-pulse">
                         <RefreshCw className="animate-spin text-terminal-green" size={24} />
                         <span className="uppercase tracking-widest text-xs opacity-50">Transverse_Ledger_Tree...</span>
                       </div>
                    </td>
                  </tr>
                ) : treeData.length === 0 ? (
                    <tr>
                    <td colSpan={5} className="p-24 text-center">
                       <div className="flex flex-col items-center gap-4 opacity-30">
                         <Info size={32} />
                         <span className="uppercase tracking-widest text-xs italic">No matching segments found.</span>
                       </div>
                    </td>
                  </tr>
                ) : (
                  treeData.map((node) => <AccountItem key={node.id} account={node} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingCat && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-terminal-panel border-2 border-terminal-cyan w-full max-w-md p-6 space-y-4 shadow-[0_0_50px_rgba(0,255,255,0.1)]">
            <h3 className="font-bold uppercase tracking-widest text-terminal-cyan border-b border-terminal-cyan/30 pb-2 flex items-center gap-2">
              <Edit3 size={16} /> Segment Calibration
            </h3>
            <div className="space-y-4">
                <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-terminal-cyan/70">Account Code</label>
                <Input
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    className="bg-transparent border-terminal-cyan text-terminal-cyan font-mono uppercase rounded-none"
                />
                </div>
                <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-terminal-cyan/70">Account Name</label>
                <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-transparent border-terminal-cyan text-terminal-cyan font-mono rounded-none"
                />
                </div>
                <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-terminal-cyan/70">Parent Account</label>
                <select
                    value={editForm.parent_id || ""}
                    onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full h-10 border border-terminal-cyan bg-terminal-bg text-terminal-cyan font-mono outline-none px-3 focus:border-terminal-amber rounded-none"
                >
                    <option value="">[None]</option>
                    {categories
                        .filter(c => c.type === editingCat.type && c.id !== editingCat.id)
                        .map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)
                    }
                </select>
                </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleEdit}
                className="flex-1 bg-terminal-cyan text-black hover:bg-terminal-cyan/80 border-none font-black uppercase tracking-widest text-xs h-12"
              >
                SAVE_CHANGES
              </Button>
              <Button
                onClick={() => setEditingCat(null)}
                variant="outline"
                className="flex-1 border-terminal-cyan/50 text-terminal-cyan hover:bg-terminal-cyan/10 font-bold uppercase tracking-widest text-xs h-12"
              >
                ABORT
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RefreshCw = ({ className, size }: { className?: string, size?: number }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
);
