"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Package, Plus, RefreshCw, Trash2, FolderTree, AlertTriangle, Box, Edit } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function ProductsPage() {
  const { settings } = useSettings();
  const { showToast, showConfirm } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [isInventory, setIsInventory] = useState(false);
  const [reorderPoint, setReorderPoint] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, accRes] = await Promise.all([
        api.get("/products"),
        api.get("/categories?type=Revenue"),
      ]);
      setProducts(prodRes.data);
      setAccounts(accRes.data);
    } catch (err) {
      console.error("Failed to fetch products data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unitPrice || !incomeAccountId) {
      setError("Name, Unit Price, and Income Account are required.");
      return;
    }

    setError(null);
    try {
      const data = {
        name,
        sku: sku || null,
        unit_price: parseFloat(unitPrice),
        income_account_id: parseInt(incomeAccountId),
        is_inventory_item: isInventory,
        reorder_point: parseFloat(reorderPoint),
      };

      if (editProductId) {
        await api.patch(`/products/${editProductId}`, data);
        showToast("Product updated successfully.", "success");
      } else {
        await api.post("/products", data);
        showToast("Product saved to catalog.", "success");
      }

      // Reset & Reload
      setShowForm(false);
      setEditProductId(null);
      setName("");
      setSku("");
      setUnitPrice("");
      setIncomeAccountId("");
      setIsInventory(false);
      setReorderPoint("0");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save product.");
    }
  };

  const handleEdit = (product: any) => {
    setEditProductId(product.id);
    setName(product.name);
    setSku(product.sku || "");
    setUnitPrice(product.unit_price.toString());
    setIncomeAccountId(product.income_account_id?.toString() || "");
    setIsInventory(product.is_inventory_item);
    setReorderPoint(product.reorder_point?.toString() || "0");
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm("DELETE COMPONENT FROM CATALOG?");
    if (!confirmed) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to delete.", "error");
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
    <div className="space-y-6 font-mono pb-12 text-terminal-cyan">
      {/* Header */}
      <div className="flex justify-between items-start bg-terminal-panel p-6 border-2 border-terminal-cyan">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-3">
            <Package size={24} />
            Products & Services Catalog
          </h1>
          <p className="text-terminal-cyan/60 uppercase tracking-widest text-xs mt-2">
            Finance OS // Inventory & Catalog Management
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 border-2 border-terminal-cyan px-4 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-cyan hover:text-black transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Sync Catalog
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-terminal-cyan text-black border-2 border-terminal-cyan px-6 py-2 uppercase tracking-widest text-xs font-bold hover:bg-cyan-300 transition-colors"
          >
            <Plus size={16} />
            {showForm ? "Cancel" : "Add Item"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-terminal-red text-black font-bold p-4 uppercase tracking-widest flex items-center gap-4">
          <span className="bg-black text-terminal-red px-2 py-1 text-xs">ERR</span>
          {error}
        </div>
      )}

      {/* New Product Form */}
      {showForm && (
        <div className="border-2 border-terminal-cyan bg-black p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,255,255,0.1)]">
          <h2 className="text-terminal-cyan font-bold uppercase tracking-widest text-sm border-b border-terminal-cyan/30 pb-2 mb-4">
            {editProductId ? "Update Existing Item" : "Define New Catalog Item"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-terminal-cyan/60 uppercase tracking-widest text-[10px] font-bold">Item Name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-terminal-cyan/40 text-terminal-cyan font-bold p-2 focus:border-terminal-cyan outline-none" placeholder="e.g. Server Hosting" />
                </div>
                <div className="space-y-1">
                  <label className="text-terminal-cyan/60 uppercase tracking-widest text-[10px] font-bold">SKU / Item Code</label>
                  <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-transparent border-b border-terminal-cyan/40 text-terminal-cyan font-bold p-2 focus:border-terminal-cyan outline-none" placeholder="e.g. SRV-001" />
                </div>
                <div className="space-y-1">
                  <label className="text-terminal-cyan/60 uppercase tracking-widest text-[10px] font-bold">Unit Price *</label>
                  <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full bg-transparent border-b border-terminal-cyan/40 text-terminal-cyan font-bold p-2 focus:border-terminal-cyan outline-none" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-terminal-cyan/60 uppercase tracking-widest text-[10px] font-bold">Income Account *</label>
                  <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} className="w-full bg-black border-b border-terminal-cyan/40 text-terminal-cyan font-bold p-2 focus:border-terminal-cyan outline-none uppercase text-xs">
                    <option value="">-- Select --</option>
                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4 bg-terminal-cyan/5 p-4 border border-terminal-cyan/20">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isInv" checked={isInventory} onChange={(e) => setIsInventory(e.target.checked)} className="accent-terminal-cyan" />
                  <label htmlFor="isInv" className="text-terminal-cyan font-bold uppercase text-[11px] cursor-pointer">Track Inventory for this item</label>
                </div>
                {isInventory && (
                  <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1">
                    <label className="text-terminal-cyan/60 uppercase text-[10px] font-bold">Reorder Point (Min Stock)</label>
                    <input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="w-full bg-black border border-terminal-cyan/40 p-2 text-terminal-cyan font-bold text-xs" />
                    <p className="text-[9px] text-terminal-cyan/40 uppercase italic">We'll alert you when stock falls below this level.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-terminal-cyan/30 gap-4">
              {editProductId && (
                <button 
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditProductId(null);
                    // Reset fields
                    setName("");
                    setSku("");
                    setUnitPrice("");
                    setIncomeAccountId("");
                    setIsInventory(false);
                    setReorderPoint("0");
                  }}
                  className="border border-terminal-cyan text-terminal-cyan px-8 py-2 uppercase tracking-widest text-xs font-bold hover:bg-terminal-cyan/10 transition-colors"
                >
                  Cancel Edit
                </button>
              )}
              <button type="submit" className="bg-terminal-cyan text-black px-8 py-2 uppercase tracking-widest text-xs font-bold hover:bg-cyan-300 transition-colors">
                {editProductId ? "Update Item" : "Save to Catalog"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog Table */}
      <div className="border-2 border-terminal-cyan bg-black overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="text-center p-12 text-terminal-cyan/60 font-bold uppercase tracking-widest animate-pulse">Syncing catalog...</div>
        ) : products.length === 0 ? (
          <div className="text-center p-12 text-terminal-cyan/60 font-bold uppercase tracking-widest">Catalog empty.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs uppercase">
              <thead className="bg-terminal-cyan text-black tracking-widest">
                <tr>
                  <th className="p-4 font-bold">Item Name / SKU</th>
                  <th className="p-4 font-bold text-right">Price</th>
                  <th className="p-4 font-bold text-center">Stock</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold w-12">CMD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222] text-terminal-cyan">
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-terminal-cyan/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-[10px] text-terminal-cyan/50">{item.sku || "NO_SKU"}</div>
                    </td>
                    <td className="p-4 text-right font-bold tracking-tighter">{formatCurrency(item.unit_price)}</td>
                    <td className="p-4 text-center">
                      {item.is_inventory_item ? (
                        <div className="flex flex-col items-center">
                          <span className={`font-bold p-1 ${item.quantity_on_hand <= item.reorder_point ? "text-terminal-red border border-terminal-red" : "text-terminal-cyan"}`}>
                            {item.quantity_on_hand} UN
                          </span>
                          {item.quantity_on_hand <= item.reorder_point && (
                            <span className="text-[8px] text-terminal-red mt-1 flex items-center gap-1 animate-pulse">
                              <AlertTriangle size={8} /> LOW_STOCK
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-terminal-cyan/20">N/A</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {item.income_account_id ? <span className="text-[9px] bg-terminal-cyan/10 text-terminal-cyan px-2 py-0.5 border border-terminal-cyan/30">L_MAPPED</span> : <span className="text-[9px] bg-terminal-red/10 text-terminal-red px-2 py-0.5 border border-terminal-red/30">ERROR</span>}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(item)} className="text-terminal-cyan/40 hover:text-terminal-cyan transition-colors">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-terminal-red/40 hover:text-terminal-red transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
