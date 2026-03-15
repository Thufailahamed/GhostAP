import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  X,
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  ChevronDown,
  Info,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { CurrencySelector } from "@/components/ui/currency-selector";

interface Item {
  description: string;
  quantity: number;
  unit_price: number;
  product_id: number | null;
  tax_rate: number;
}

export default function NewReceivablePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: 1, unit_price: 0, product_id: null, tax_rate: 0 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          api.get("/receivables/customers"),
          api.get("/products"),
        ]);
        setCustomers(custRes.data);
        setProducts(prodRes.data);
      } catch (error) {
        showToast("Failed to sync system data.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, product_id: null, tax_rate: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    if (field === "product_id" && value) {
      const prod = products.find((p) => p.id === parseInt(value));
      if (prod) {
        newItems[index] = {
          ...newItems[index],
          product_id: parseInt(value),
          description: prod.name,
          unit_price: prod.unit_price,
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.tax_rate / 100)), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (shouldSend: boolean = false) => {
    if (!customerId) {
        showToast("Please select a valid customer.", "error");
        return;
    }

    try {
      const res = await api.post("/receivables/", {
        invoice_number: invoiceNumber,
        customer_id: parseInt(customerId),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        total_amount: calculateTotal(),
        currency: currency,
        items: items.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          product_id: it.product_id
        }))
      });

      if (shouldSend) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ? `&token=${session.access_token}` : "";
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        window.open(`${baseUrl}/receivables/${res.data.id}/pdf?auth=true${token}`, "_blank");
      }

      showToast(shouldSend ? "Invoice sent successfully!" : "Invoice created successfully!", "success");
      router.push("/dashboard/receivables");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "System Error: Record creation failed.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-terminal-cyan uppercase font-bold animate-pulse tracking-[0.2em]">
          Initializing Terminal...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header / Actions */}
      <div className="flex justify-between items-center border-b border-terminal-cyan/20 pb-6 sticky top-0 bg-terminal-bg/80 backdrop-blur-md z-10 pt-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="text-terminal-cyan/60 hover:text-terminal-cyan p-2 border border-terminal-cyan/20 rounded-none transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-terminal-cyan flex items-center gap-3">
              GEN_INVOICE <span className="text-[10px] font-mono font-bold bg-terminal-cyan/10 px-2 py-0.5 border border-terminal-cyan/30 rounded-none">DRAFT_MODE</span>
            </h1>
            <p className="text-[9px] text-terminal-cyan/50 font-bold uppercase tracking-widest mt-0.5">
              Ledger Entry // Sales Workflow
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard/receivables")}
            className="border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/5 rounded-none uppercase font-bold text-xs px-6"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(false)}
            className="bg-terminal-cyan/10 border border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/20 rounded-none uppercase font-bold text-xs px-6 flex items-center gap-2"
          >
            <Save size={14} /> Save Draft
          </Button>
          <Button 
            onClick={() => handleSubmit(true)}
            className="bg-terminal-cyan text-black hover:bg-cyan-200 border-none rounded-none uppercase font-extrabold text-xs px-8 flex items-center gap-2"
          >
            <Send size={14} /> Save & Send
          </Button>
        </div>
      </div>

      {/* Main Metadata Grid */}
      <Card className="rounded-none border-2 border-terminal-cyan/30 bg-terminal-panel shadow-2xl">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Customer / Client</label>
              <div className="relative group">
                <select 
                  value={customerId} 
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-black border-2 border-terminal-cyan/30 p-3 text-terminal-cyan uppercase font-bold text-sm focus:border-terminal-cyan outline-none transition-all appearance-none"
                >
                  <option value="">-- SELECT RECIPIENT --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-terminal-cyan/50 pointer-events-none group-focus-within:text-terminal-cyan" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Invoice # </label>
              <input 
                value={invoiceNumber} 
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="GENERATE_AUTO"
                className="w-full bg-black border-2 border-terminal-cyan/30 p-3 text-terminal-cyan uppercase font-mono font-bold text-sm focus:border-terminal-cyan outline-none transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Reference</label>
              <input 
                value={reference} 
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO / CONTRACT #"
                className="w-full bg-black border-2 border-terminal-cyan/30 p-3 text-terminal-cyan uppercase font-bold text-sm focus:border-terminal-cyan outline-none transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Issue Date</label>
              <input 
                type="date"
                value={issueDate} 
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-black border-2 border-terminal-cyan/30 p-3 text-terminal-cyan uppercase font-bold text-sm focus:border-terminal-cyan outline-none transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Due Date</label>
              <input 
                type="date"
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-black border-2 border-terminal-cyan/30 p-3 text-terminal-cyan uppercase font-bold text-sm focus:border-terminal-cyan outline-none transition-all" 
              />
            </div>

            <div className="space-y-1.5">
                <CurrencySelector 
                  value={currency} 
                  onChange={setCurrency} 
                  label="Transaction Currency"
                />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Pricing</label>
              <div className="w-full bg-terminal-cyan/5 border-2 border-terminal-cyan/10 p-3 text-terminal-cyan/60 uppercase font-bold text-sm italic">
                Tax Exclusive
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Item Table */}
      <div className="border-2 border-terminal-cyan/30 bg-terminal-panel overflow-hidden shadow-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-terminal-cyan/10 border-b-2 border-terminal-cyan/30">
              <th className="p-4 text-left text-[10px] font-black text-terminal-cyan uppercase tracking-widest w-1/3">Item / Description</th>
              <th className="p-4 text-center text-[10px] font-black text-terminal-cyan uppercase tracking-widest w-24">Qty</th>
              <th className="p-4 text-right text-[10px] font-black text-terminal-cyan uppercase tracking-widest w-40">Unit Price</th>
              <th className="p-4 text-center text-[10px] font-black text-terminal-cyan uppercase tracking-widest w-32">Tax Rate %</th>
              <th className="p-4 text-right text-[10px] font-black text-terminal-cyan uppercase tracking-widest w-40">Amount</th>
              <th className="p-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-terminal-cyan/10 group hover:bg-terminal-cyan/[0.02]">
                <td className="p-4 space-y-2">
                  <select 
                    value={item.product_id || ""} 
                    onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                    className="w-full bg-black border border-terminal-cyan/20 p-2 text-terminal-cyan/80 uppercase text-xs focus:border-terminal-cyan outline-none"
                  >
                    <option value="">-- MANUAL ENTRY --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input 
                    placeholder="DESCRIPTION..." 
                    value={item.description} 
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="w-full bg-black border-2 border-terminal-cyan/10 p-2 text-terminal-cyan uppercase text-sm focus:border-terminal-cyan outline-none transition-all" 
                  />
                </td>
                <td className="p-4">
                  <input 
                    type="number" 
                    value={item.quantity} 
                    onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value))}
                    className="w-full bg-black border-2 border-terminal-cyan/10 p-2 text-terminal-cyan text-center font-mono focus:border-terminal-cyan outline-none" 
                  />
                </td>
                <td className="p-4">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-terminal-cyan/40 text-xs">$</span>
                    <input 
                      type="number" 
                      value={item.unit_price} 
                      onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value))}
                      className="w-full bg-black border-2 border-terminal-cyan/10 p-2 pl-6 text-terminal-cyan text-right font-mono focus:border-terminal-cyan outline-none" 
                    />
                  </div>
                </td>
                <td className="p-4">
                  <input 
                    type="number" 
                    value={item.tax_rate} 
                    onChange={(e) => updateItem(idx, "tax_rate", parseFloat(e.target.value))}
                    className="w-full bg-black border-2 border-terminal-cyan/10 p-2 text-terminal-cyan text-center font-mono focus:border-terminal-cyan outline-none" 
                  />
                </td>
                <td className="p-4 text-right">
                  <div className="text-terminal-cyan font-mono font-bold text-sm">
                    <CurrencyDisplay amount={item.quantity * item.unit_price} currency={currency} />
                  </div>
                </td>
                <td className="p-4">
                  <button 
                    onClick={() => removeItem(idx)}
                    className="text-terminal-cyan/20 hover:text-terminal-red transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 bg-terminal-cyan/5">
           <Button 
            onClick={addItem}
            variant="outline" 
            className="border-dashed border-2 border-terminal-cyan/30 text-terminal-cyan/60 hover:text-terminal-cyan hover:border-terminal-cyan rounded-none uppercase font-black text-[10px] w-48"
           >
            <Plus size={14} className="mr-2" /> Add New Row
           </Button>
        </div>
      </div>

      {/* Totals & Footer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="bg-terminal-cyan/5 border-l-4 border-terminal-cyan p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-terminal-cyan tracking-widest flex items-center gap-2">
              <Info size={14} /> System Metadata
            </h3>
            <div className="space-y-2 font-mono text-[9px] text-terminal-cyan/60 uppercase">
              <p>// Entry classified as AR_RECEIVABLE</p>
              <p>// Multi-currency validation: {currency} active</p>
              <p>// Journal entries will be auto-generated upon submission</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-terminal-cyan/60 tracking-wider">Admin Notes</label>
             <textarea 
               placeholder="PRIVATE NOTES..."
               className="w-full h-32 bg-black border-2 border-terminal-cyan/10 p-4 text-terminal-cyan uppercase font-bold text-sm focus:border-terminal-cyan outline-none transition-all resize-none"
             />
          </div>
        </div>

        <div className="bg-terminal-panel border-2 border-terminal-cyan shadow-xl p-10 space-y-8">
          <div className="space-y-4 divide-y divide-terminal-cyan/10">
            <div className="flex justify-between items-center pb-4">
              <span className="text-xs font-black uppercase text-terminal-cyan/50 tracking-widest">Subtotal</span>
              <span className="text-lg font-mono font-bold text-terminal-cyan"><CurrencyDisplay amount={calculateSubtotal()} currency={currency} /></span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-xs font-black uppercase text-terminal-cyan/50 tracking-widest">Calculated Tax</span>
              <span className="text-lg font-mono font-bold text-terminal-cyan"><CurrencyDisplay amount={calculateTax()} currency={currency} /></span>
            </div>
            <div className="flex justify-between items-center pt-6">
              <span className="text-sm font-black uppercase text-terminal-cyan tracking-[0.2em]">Total Amount</span>
              <div className="text-right">
                <div className="text-3xl font-black font-mono text-terminal-cyan">
                  <CurrencyDisplay amount={calculateTotal()} currency={currency} />
                </div>
                <div className="text-[9px] font-bold text-terminal-cyan/40 uppercase mt-1 tracking-widest">
                  {currency} // Payable on Receipt
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
