"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell
} from "recharts";
import { 
  LayoutDashboard, Target, PieChart, Save, Plus, ChevronRight, 
  ChevronLeft, Calendar, Info, AlertTriangle, CheckCircle2,
  FileBarChart, ArrowLeftRight
} from "lucide-react";
import api from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/ui/currency-display";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function BudgetingPage() {
  const { settings } = useSettings();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "edit" | "bva">("list");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [bvaData, setBvaData] = useState<any[]>([]);

  // Form states
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetYear, setNewBudgetYear] = useState(new Date().getFullYear());

  const fetchBudgets = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/budgeting/");
      setBudgets(res.data);
    } catch (err) {
      console.error("Failed to fetch budgets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleCreateBudget = async () => {
    try {
      const res = await api.post("/budgeting/", {
        name: newBudgetName,
        fiscal_year: newBudgetYear
      });
      setBudgets([...budgets, res.data]);
      setNewBudgetName("");
      setNewBudgetYear(new Date().getFullYear());
    } catch (err) {
      console.error("Failed to create budget:", err);
    }
  };

  const loadBudgetItems = async (budget: any) => {
    try {
      const res = await api.get(`/budgeting/${budget.id}/items`);
      setBudgetItems(res.data);
      setSelectedBudget(budget);
      setView("edit");
    } catch (err) {
      console.error("Failed to load budget items:", err);
    }
  };

  const loadBvaReport = async (budget: any, month: number) => {
    try {
      const res = await api.get(`/budgeting/${budget.id}/bva?month=${month}`);
      setBvaData(res.data);
      setSelectedBudget(budget);
      setSelectedMonth(month);
      setView("bva");
    } catch (err) {
      console.error("Failed to load BVA report:", err);
    }
  };

  const handleSaveItems = async () => {
    try {
      await api.put(`/budgeting/${selectedBudget.id}/items`, budgetItems);
      alert("Budget targets saved successfully!");
    } catch (err) {
      console.error("Failed to save items:", err);
    }
  };

  const updateItemTarget = (itemId: number, monthIndex: number, value: string) => {
    const monthKey = `${MONTHS[monthIndex].toLowerCase().slice(0, 3)}_target`;
    setBudgetItems(items => items.map(item => 
      item.id === itemId ? { ...item, [monthKey]: parseFloat(value) || 0 } : item
    ));
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-terminal-green animate-pulse font-mono tracking-widest text-xl uppercase">
          Initializing_Budget_Matrix...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            BUDGET_ANALYSIS_MOD
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
            Finance OS // Target Planning & Variance Telemetry
          </p>
        </div>
        <div className="flex gap-4">
           {view !== "list" && (
             <Button 
               onClick={() => setView("list")}
               variant="outline" 
               className="bg-black text-terminal-amber border-terminal-amber hover:bg-terminal-amber hover:text-black"
             >
               <ChevronLeft size={16} className="mr-2" /> EXIT_TO_MAIN
             </Button>
           )}
           {view === "edit" && (
             <Button 
               onClick={handleSaveItems}
               className="bg-terminal-green text-black hover:bg-terminal-green-dark border-none"
             >
               <Save size={16} className="mr-2" /> SAVE_TARGETS
             </Button>
           )}
        </div>
      </div>

      {view === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Budget Panel */}
          <Card className="rounded-none border-2 border-terminal-amber bg-black text-terminal-amber">
            <CardHeader className="border-b border-terminal-amber/30">
              <CardTitle className="text-xs tracking-widest uppercase flex items-center gap-2">
                <Plus size={16} /> INITIALIZE_NEW_BUDGET
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-60">Budget Name</label>
                <Input 
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="e.g. FY 2026 Core Operations"
                  className="bg-black border-terminal-amber/50 text-terminal-amber focus:border-terminal-amber focus:ring-0 rounded-none h-10 placeholder:text-terminal-amber/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-60">Fiscal Year</label>
                <Input 
                  type="number"
                  value={newBudgetYear}
                  onChange={(e) => setNewBudgetYear(parseInt(e.target.value))}
                  className="bg-black border-terminal-amber/50 text-terminal-amber focus:border-terminal-amber focus:ring-0 rounded-none h-10"
                />
              </div>
              <Button 
                onClick={handleCreateBudget}
                disabled={!newBudgetName}
                className="w-full bg-terminal-amber text-black hover:bg-terminal-amber/80 border-none font-bold uppercase tracking-widest text-xs h-12"
              >
                GENERATE_MATRIX
              </Button>
            </CardContent>
          </Card>

          {/* Budget List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-terminal-green/60 mb-4 px-2">Active Budget Profiles</h3>
            {budgets.map((b) => (
              <Card key={b.id} className="rounded-none border-2 border-terminal-green bg-terminal-panel hover:bg-terminal-green/5 transition-colors group">
                <CardContent className="p-6 flex justify-between items-center text-terminal-green">
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tighter">{b.name}</h4>
                    <div className="flex gap-4 mt-1 text-[10px] font-bold opacity-70">
                      <span className="flex items-center gap-1 uppercase"><Calendar size={12} /> FY_{b.fiscal_year}</span>
                      <span className="flex items-center gap-1 uppercase"><Info size={12} /> CREATED: {new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => loadBudgetItems(b)}
                      variant="outline" 
                      className="border-terminal-green/50 text-terminal-green hover:bg-terminal-green hover:text-black"
                    >
                      <Target size={16} className="mr-2" /> EDIT_TARGETS
                    </Button>
                    <Button 
                      onClick={() => loadBvaReport(b, selectedMonth)}
                      className="bg-terminal-cyan text-black hover:bg-terminal-cyan/80 border-none"
                    >
                      <FileBarChart size={16} className="mr-2" /> BVA_REPORT
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {budgets.length === 0 && (
              <div className="border-2 border-dashed border-terminal-green/20 p-12 text-center text-terminal-green/40 font-mono italic">
                No active budget profiles found. Initialize a new matrix to begin planning.
              </div>
            )}
          </div>
        </div>
      )}

      {view === "edit" && (
        <Card className="rounded-none border-2 border-terminal-green bg-black">
          <CardHeader className="border-b border-terminal-green/30 px-6">
            <div className="flex justify-between items-end">
              <div>
                <CardTitle className="text-2xl font-black text-terminal-green uppercase">
                  PLANNING_GRID: {selectedBudget?.name}
                </CardTitle>
                <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
                  Adjust monthly targets per category. Values will be saved to secure ledger.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-terminal-green text-black uppercase font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 border-r border-black/20 min-w-[200px]">Category</th>
                  {MONTHS.map(m => (
                    <th key={m} className="px-4 py-3 text-center border-r border-black/20 min-w-[100px]">
                      {m.slice(0, 3)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-terminal-green">
                {budgetItems.map(item => {
                   const total = MONTHS.reduce((acc, _, i) => {
                     const key = `${MONTHS[i].toLowerCase().slice(0, 3)}_target`;
                     return acc + (item[key] || 0);
                   }, 0);
                   
                   return (
                     <tr key={item.id} className="border-b border-terminal-green/10 hover:bg-terminal-green/5 group">
                       <td className="px-4 py-3 font-bold uppercase border-r border-terminal-green/10 truncate max-w-[200px]">
                         {item.category_name}
                       </td>
                       {MONTHS.map((_, i) => {
                         const key = `${MONTHS[i].toLowerCase().slice(0, 3)}_target`;
                         return (
                           <td key={i} className="p-0 border-r border-terminal-green/10">
                             <input 
                               type="number"
                               value={item[key] || 0}
                               onChange={(e) => updateItemTarget(item.id, i, e.target.value)}
                               className="w-full h-full bg-transparent border-none text-center py-3 px-2 focus:bg-terminal-green/10 focus:outline-none focus:ring-1 focus:ring-terminal-green font-mono"
                             />
                           </td>
                         );
                       })}
                       <td className="px-4 py-3 text-right font-black bg-terminal-green/5 text-terminal-cyan">
                         ${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                       </td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {view === "bva" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-terminal-panel border border-terminal-cyan/30 p-4">
             <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-[10px] font-bold text-terminal-cyan/50 uppercase tracking-widest">Active Report</h3>
                  <div className="text-lg font-black text-terminal-cyan uppercase">{selectedBudget?.name} BVA</div>
                </div>
                <div className="h-10 w-px bg-terminal-cyan/20"></div>
                <div className="flex gap-2">
                   {MONTHS.map((m, i) => (
                     <Button 
                       key={m}
                       onClick={() => loadBvaReport(selectedBudget, i+1)}
                       variant="outline"
                       size="sm"
                       className={`h-8 min-w-[50px] text-[10px] border-terminal-cyan/30 bg-transparent ${selectedMonth === i+1 ? "bg-terminal-cyan text-black border-terminal-cyan" : "text-terminal-cyan hover:bg-terminal-cyan/10"}`}
                     >
                       {m.slice(0, 3)}
                     </Button>
                   ))}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
               <Card className="rounded-none border-2 border-terminal-cyan bg-black">
                 <CardHeader className="border-b border-terminal-cyan/30">
                    <CardTitle className="text-xs uppercase tracking-widest text-terminal-cyan font-bold flex justify-between">
                      Variance Matrix // {MONTHS[selectedMonth-1].toUpperCase()}
                      <span className="text-terminal-amber">{settings?.base_currency || "USD"}_BASIS</span>
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <table className="w-full text-xs text-left">
                       <thead className="bg-terminal-cyan/10 text-terminal-cyan border-b border-terminal-cyan/30 uppercase font-black">
                          <tr>
                             <th className="px-6 py-4">Account Category</th>
                             <th className="px-6 py-4 text-right">Budget</th>
                             <th className="px-6 py-4 text-right">Actual</th>
                             <th className="px-6 py-4 text-right">Variance</th>
                             <th className="px-6 py-4 text-center">Efficiency</th>
                          </tr>
                       </thead>
                       <tbody className="text-terminal-cyan">
                          {bvaData.map((d, idx) => (
                            <tr key={idx} className="border-b border-terminal-cyan/10 hover:bg-terminal-cyan/5">
                               <td className="px-6 py-4 font-bold uppercase">{d.category_name}</td>
                               <td className="px-6 py-4 text-right font-mono"><CurrencyDisplay amount={d.budget} /></td>
                               <td className="px-6 py-4 text-right font-mono"><CurrencyDisplay amount={d.actual} /></td>
                               <td className={`px-6 py-4 text-right font-mono font-bold ${d.variance < 0 ? "text-terminal-red" : "text-terminal-green"}`}>
                                 {d.variance > 0 ? "+" : ""}<CurrencyDisplay amount={d.variance} />
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                     <div className="flex-1 h-1.5 bg-terminal-cyan/10 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full ${d.variance >= 0 ? "bg-terminal-green" : "bg-terminal-red"}`}
                                          style={{ width: `${Math.min(100, Math.abs(d.variance_pct))}%` }}
                                        ></div>
                                     </div>
                                     <span className="text-[9px] font-bold w-10 text-right">{Math.round(d.variance_pct)}%</span>
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </CardContent>
               </Card>
            </div>
            
            <div className="space-y-6">
               <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel p-4">
                  <h3 className="text-[10px] font-black uppercase text-terminal-green/50 tracking-widest mb-4">Cumulative Health</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bvaData.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                        <XAxis dataKey="category_name" hide />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#00ff88" }} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: "#000", border: "1px solid #00ff88", fontSize: "10px" }}
                        />
                        <Legend iconType="square" wrapperStyle={{ fontSize: "10px", textTransform: "uppercase" }} />
                        <Bar dataKey="budget" name="TARGET" fill="#00ff88" radius={0} />
                        <Bar dataKey="actual" name="ACTUAL" fill="#00ccff" radius={0} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </Card>
               
               <div className="border border-terminal-amber/30 bg-terminal-amber/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-terminal-amber font-bold text-xs uppercase underline">
                    <AlertTriangle size={14} /> Critical_Variance_Alerts
                  </div>
                  {bvaData.filter(d => d.variance < 0).slice(0, 3).map((d, i) => (
                    <div key={i} className="text-[10px] font-medium text-terminal-amber leading-relaxed">
                      [WARN] {d.category_name} EXCEEDED TARGET BY <CurrencyDisplay amount={Math.abs(d.variance)} /> ({Math.abs(Math.round(d.variance_pct))}% OVER)
                    </div>
                  ))}
                  {bvaData.filter(d => d.variance < 0).length === 0 && (
                    <div className="text-[10px] font-medium text-terminal-green leading-relaxed text-center">
                      SYSTEM_STATUS_NOMINAL: ALL CATEGORIES WITHIN BUDGET
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
