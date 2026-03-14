"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Box, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  AlertTriangle, 
  Plus, 
  RefreshCw,
  Search,
  Filter,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useSettings } from "@/hooks/use-settings";

export default function InventoryDashboard() {
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Adjustment State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [adjustmentUnitCost, setAdjustmentUnitCost] = useState("0");
  const [adjustmentType, setAdjustmentType] = useState("MANUAL_ADJUSTMENT");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [lowRes, prodRes] = await Promise.all([
        api.get("/inventory/low-stock"),
        api.get("/products"),
      ]);
      setLowStock(lowRes.data);
      setProducts(prodRes.data.filter((p: any) => p.is_inventory_item));
      
      // Fetch movements for first 5 inventory products or just general?
      // For now let's just show low stock and allow adjustments.
    } catch (err) {
      console.error("Failed to fetch inventory data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    try {
      await api.post("/inventory/adjust", {
        product_id: parseInt(selectedProductId),
        adjustment_amount: parseFloat(adjustmentAmount),
        reason: adjustmentType,
        notes: adjustmentNotes,
        unit_cost: parseFloat(adjustmentAmount) > 0 ? parseFloat(adjustmentUnitCost) : undefined
      });
      setShowAdjustModal(false);
      setAdjustmentAmount("0");
      setAdjustmentUnitCost("0");
      setAdjustmentNotes("");
      fetchData();
      showToast("Stock adjustment recorded.", "success");
    } catch (err: any) {
      showToast("Failed to adjust stock.", "error");
    }
  };

  return (
    <div className="space-y-8 font-mono pb-12 text-terminal-cyan">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-3">
            <Box size={24} /> INVENTORY_CONTROL_HUB
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // Stock Level Optimization & Alerts
          </p>
        </div>
        <Button
          onClick={() => setShowAdjustModal(true)}
          className="tracking-widest bg-terminal-cyan text-black hover:bg-cyan-200 border-none px-6 flex items-center gap-2"
        >
          <Plus size={16} /> MANUAL_ADJUSTMENT
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <Card className="col-span-2 rounded-none border-2 border-terminal-red/50 bg-terminal-panel shadow-[8px_8px_0px_0px_rgba(255,82,82,0.1)]">
          <CardHeader className="border-b border-terminal-red/20 pb-4">
            <CardTitle className="text-terminal-red text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={18} /> STOCK_REORDER_ALERTS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <div className="p-12 text-center text-terminal-cyan/40 uppercase text-xs font-bold italic">
                All stock levels within nominal parameters.
              </div>
            ) : (
              <table className="w-full text-left text-xs uppercase">
                <thead className="bg-terminal-red/10 text-terminal-red border-b border-terminal-red/20">
                  <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4 text-center">In Stock</th>
                    <th className="p-4 text-center">Threshold</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-red/10">
                  {lowStock.map((item) => (
                    <tr key={item.id} className="hover:bg-terminal-red/5">
                      <td className="p-4 font-bold">{item.name}</td>
                      <td className="p-4 text-center font-mono text-terminal-red">{item.quantity_on_hand}</td>
                      <td className="p-4 text-center font-mono opacity-60">{item.reorder_point}</td>
                      <td className="p-4 text-right">
                        <span className="text-[9px] bg-terminal-red text-black px-2 py-0.5 font-bold">REORDER_NOW</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats / Info */}
        <div className="space-y-6">
          <div className="border-2 border-terminal-cyan p-6 bg-terminal-panel h-full flex flex-col justify-center">
            <h3 className="text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest mb-2 text-center">Inventory Health Index</h3>
            <div className="text-4xl font-black text-terminal-cyan text-center font-mono tabular-nums leading-none">
              {products.length > 0 ? Math.round(((products.length - lowStock.length) / products.length) * 100) : 100}%
            </div>
            <div className="mt-4 h-2 bg-black border border-terminal-cyan/20">
              <div 
                className="h-full bg-terminal-cyan transition-all duration-500" 
                style={{ width: `${products.length > 0 ? ((products.length - lowStock.length) / products.length) * 100 : 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel mt-8">
        <CardHeader className="border-b border-terminal-cyan/20 pb-4">
          <CardTitle className="text-terminal-cyan text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <History size={18} /> STOCK_RECORDS_CATALOG
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs uppercase">
            <thead className="bg-terminal-cyan/10 text-terminal-cyan border-b border-terminal-cyan/20">
              <tr>
                <th className="p-4">Item Name / SKU</th>
                <th className="p-4 text-right">On Hand</th>
                <th className="p-4 text-right">Avg Cost</th>
                <th className="p-4 text-right pr-8 text-terminal-cyan font-bold">Total Valuation</th>
                <th className="p-4 text-center">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-terminal-cyan/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] opacity-40">{p.sku || "NO_SKU"}</div>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-terminal-cyan">{p.quantity_on_hand} UN</td>
                  <td className="p-4 text-right font-mono text-terminal-cyan/60"><CurrencyDisplay amount={p.average_cost} /></td>
                  <td className="p-4 text-right font-mono pr-8 font-black text-terminal-cyan"><CurrencyDisplay amount={p.quantity_on_hand * p.average_cost} /></td>
                  <td className="p-4 text-center">
                    <span className="text-[9px] border border-terminal-cyan/30 px-2 py-0.5 opacity-60">ENABLED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-lg shadow-[12px_12px_0px_0px_rgba(0,255,255,0.1)]">
            <div className="flex justify-between items-center mb-8 border-b-2 border-terminal-cyan/30 pb-4">
              <h2 className="text-xl font-bold text-terminal-cyan uppercase tracking-widest flex items-center gap-3">
                <Box size={24} /> STOCK_ADJUSTMENT_LOG
              </h2>
              <button 
                onClick={() => setShowAdjustModal(false)}
                className="text-terminal-cyan hover:text-terminal-red transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleAdjust} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest">Select Product</label>
                <select 
                  required 
                  value={selectedProductId} 
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
                >
                  <option value="">-- ALL_INVENTORY_ITEMS --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Current: {p.quantity_on_hand})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest">Adjustment (±)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={adjustmentAmount} 
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors"
                  />
                  <p className="text-[9px] text-terminal-cyan/40 uppercase italic mt-1">Positive to add, negative to remove.</p>
                </div>
                {parseFloat(adjustmentAmount) > 0 && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-1">
                    <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest">Unit Cost ({settings?.base_currency || "—"})</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      value={adjustmentUnitCost} 
                      onChange={(e) => setAdjustmentUnitCost(e.target.value)}
                      className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors"
                    />
                    <p className="text-[9px] text-terminal-cyan/40 uppercase italic mt-1">Required to update valuation.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest">Adjustment Reason</label>
                  <select 
                    value={adjustmentType} 
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-[11px] outline-none uppercase"
                  >
                    <option value="MANUAL_ADJUSTMENT">Manual Overide</option>
                    <option value="STOCK_LOSS">Stock Loss / Damage</option>
                    <option value="RESTOCK">Manual Restock</option>
                    <option value="COUNT_CORRECTION">Cycle Count Correction</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase tracking-widest">Auditor Notes</label>
                <textarea 
                  value={adjustmentNotes} 
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="PROVIDE RATIONALE FOR SYSTEM LOG..."
                  className="w-full bg-black border-2 border-terminal-cyan p-3 text-terminal-cyan font-bold text-xs outline-none focus:border-white transition-colors uppercase h-24"
                />
              </div>

              <div className="pt-4 flex justify-end gap-6 border-t border-terminal-cyan/30">
                <Button 
                  type="button" 
                  onClick={() => setShowAdjustModal(false)}
                  className="bg-transparent border-2 border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 uppercase font-extrabold tracking-widest text-xs h-12 px-8"
                >
                  ABORT
                </Button>
                <Button 
                  type="submit"
                  className="bg-terminal-cyan text-black border-2 border-terminal-cyan hover:bg-cyan-200 uppercase font-extrabold tracking-widest text-xs h-12 px-8"
                >
                  EXEC_ADJUSTMENT
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
