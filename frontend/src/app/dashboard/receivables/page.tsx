"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Plus,
  X,
  MoreHorizontal,
  DollarSign,
  AlertCircle,
  Send,
  Download,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { CurrencySelector } from "@/components/ui/currency-selector";

interface Receivable {
  id: number;
  invoice_number: string;
  customer: {
    name: string;
  };
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  currency: string;
  exchange_rate: number;
  status: string;
}

export default function ReceivablesListPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newInvNumber, setNewInvNumber] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newDueDate, setNewDueDate] = useState("");
  const [items, setItems] = useState<any[]>([{ description: "", quantity: 1, unit_price: 0, product_id: null }]);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const { showToast } = useToast();

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recRes, custRes, prodRes] = await Promise.all([
        api.get("/receivables/"),
        api.get("/receivables/customers"),
        api.get("/products"),
      ]);
      setReceivables(recRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId) {
      showToast("Please select a customer.", "error");
      return;
    }
    try {
      const total = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
      await api.post("/receivables/", {
        invoice_number: newInvNumber,
        customer_id: parseInt(newCustomerId),
        due_date: newDueDate ? new Date(newDueDate).toISOString() : null,
        total_amount: total,
        currency: newCurrency,
        items: items.map(it => ({
          ...it,
          product_id: it.product_id ? parseInt(it.product_id) : null
        }))
      });
      setShowAddModal(false);
      setNewInvNumber("");
      setItems([{ description: "", quantity: 1, unit_price: 0, product_id: null }]);
      fetchData();
      showToast("Invoice created successfully!", "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Error creating receivable", "error");
    }
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0, product_id: null }]);
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === "product_id" && value) {
      const prod = products.find(p => p.id === parseInt(value));
      if (prod) {
        newItems[index] = { 
          ...newItems[index], 
          product_id: value, 
          description: prod.name, 
          unit_price: prod.unit_price 
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const res = await api.post("/receivables/customers", { name: newCustomerName.trim() });
      await fetchData();
      setNewCustomerId(res.data.id.toString());
      setShowAddCustomer(false);
      setNewCustomerName("");
      showToast("Customer created!", "success");
    } catch (err: any) {
      showToast("Failed to create customer", "error");
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.patch(`/receivables/${id}/status`, { status });
      fetchData();
      showToast(`Status updated to ${status}.`, "success");
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    try {
      await api.post(`/receivables/${selectedReceivable.id}/payment`, {
        amount: parseFloat(paymentAmount),
        method: "BANK_TRANSFER",
        reference: paymentReference || "Manual Receipt",
      });
      setPaymentModalOpen(false);
      setPaymentAmount("");
      fetchData();
      showToast("Payment recorded!", "success");
    } catch (err: any) {
      showToast("Failed to log payment", "error");
    }
  };

  const filteredReceivables = receivables.filter((rec) => {
    const query = searchQuery.toLowerCase();
    return (
      rec.invoice_number.toLowerCase().includes(query) ||
      rec.customer?.name.toLowerCase().includes(query) ||
      rec.status.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan">
            RECEIVABLES_LEDGER
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // Accounts Receivable Tracking
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="tracking-widest bg-terminal-cyan text-black hover:bg-cyan-200 border-none px-6 flex items-center gap-2"
        >
          <Plus size={16} /> NEW_RECEIVABLE
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex items-center border-2 border-terminal-cyan bg-terminal-panel px-4">
          <Search size={20} className="text-terminal-cyan/50" />
          <input
            type="text"
            placeholder="SEARCH INVOICES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm text-terminal-cyan placeholder:text-terminal-cyan/50"
          />
        </div>
      </div>

      <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel text-terminal-cyan">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b-2 border-terminal-cyan font-bold">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center animate-pulse uppercase">Syncing...</td></tr>
                ) : filteredReceivables.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center uppercase">No Records Found</td></tr>
                ) : (
                  filteredReceivables.map((rec) => (
                    <tr key={rec.id} className="border-b border-[#333] hover:bg-terminal-cyan/5 transition-colors">
                      <td className="px-6 py-4 font-mono">{rec.invoice_number}</td>
                      <td className="px-6 py-4 font-bold uppercase">{rec.customer?.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">{new Date(rec.issue_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono text-right"><CurrencyDisplay amount={rec.total_amount} currency={rec.currency} /></td>
                      <td className="px-6 py-4 font-mono text-right text-terminal-cyan">
                        <CurrencyDisplay amount={rec.total_amount - rec.paid_amount} currency={rec.currency} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 border ${
                          rec.status === "PAID" ? "text-terminal-green border-terminal-green" :
                          rec.status === "OVERDUE" ? "text-terminal-red border-terminal-red" : "text-terminal-amber border-terminal-amber"
                        }`}>[{rec.status}]</span>
                      </td>
                      <td className="px-6 py-4 text-center relative">
                        <Button variant="ghost" onClick={() => setOpenDropdownId(openDropdownId === rec.id ? null : rec.id)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {openDropdownId === rec.id && (
                          <div className="absolute right-8 top-12 z-50 w-48 bg-terminal-panel border-2 border-terminal-cyan p-0 font-mono shadow-lg">
                            <button className="w-full text-left hover:bg-terminal-cyan hover:text-black uppercase text-[10px] font-bold p-3 flex items-center gap-2" 
                              onClick={() => {
                                window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/receivables/${rec.id}/pdf`, "_blank");
                                setOpenDropdownId(null);
                              }}>
                              <Download size={14} /> PDF
                            </button>
                            <button className="w-full text-left hover:bg-terminal-cyan hover:text-black uppercase text-[10px] font-bold p-3 flex items-center gap-2"
                              onClick={() => {
                                setSelectedReceivable(rec);
                                setPaymentModalOpen(true);
                                setOpenDropdownId(null);
                              }}>
                              <DollarSign size={14} /> Pay
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-2xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-terminal-cyan uppercase tracking-widest flex items-center gap-2">
                <Plus size={20} /> Create Invoice
              </h2>
              <button onClick={() => setShowAddModal(false)}><X size={24} className="text-terminal-cyan" /></button>
            </div>
            
            <form onSubmit={handleAddReceivable} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Invoice #</label>
                  <input required value={newInvNumber} onChange={(e) => setNewInvNumber(e.target.value)} className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Due Date</label>
                  <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan" />
                </div>
                <div>
                  <CurrencySelector value={newCurrency} onChange={setNewCurrency} label="Transaction Currency" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Customer</label>
                <div className="flex gap-2">
                  <select required value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} className="flex-1 bg-black border border-terminal-cyan p-2 text-terminal-cyan uppercase">
                    <option value="">Select...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button type="button" onClick={() => setShowAddCustomer(!showAddCustomer)} className="bg-terminal-amber text-black">+</Button>
                </div>
                {showAddCustomer && (
                  <div className="mt-2 flex gap-2">
                    <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Name" className="flex-1 bg-black border border-terminal-amber p-2 text-terminal-cyan" />
                    <Button type="button" onClick={handleAddCustomer} className="bg-terminal-amber text-black">Add</Button>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-terminal-cyan/20 pt-4">
                <label className="block text-[10px] font-bold text-terminal-cyan/60 uppercase">Line Items</label>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 border-b border-[#222] pb-4">
                    <div className="col-span-12 md:col-span-6">
                      <select value={it.product_id || ""} onChange={(e) => updateItem(idx, "product_id", e.target.value)} className="w-full bg-black border border-terminal-cyan/40 p-2 text-terminal-cyan text-xs uppercase mb-1">
                        <option value="">Manual Entry...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit_price})</option>)}
                      </select>
                      <input placeholder="Description" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="w-full bg-black border border-terminal-cyan/40 p-2 text-terminal-cyan text-xs uppercase" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value))} className="w-full bg-black border border-terminal-cyan/40 p-2 text-terminal-cyan text-xs" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" placeholder="Price" value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value))} className="w-full bg-black border border-terminal-cyan/40 p-2 text-terminal-cyan text-xs" />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-terminal-red hover:text-white"><X size={16} /></button>
                    </div>
                  </div>
                ))}
                <Button type="button" onClick={addItem} variant="outline" className="w-full border-dashed border-terminal-cyan/40 text-terminal-cyan/60 hover:text-terminal-cyan text-[10px]">+ Add Item</Button>
              </div>

              <div className="flex justify-between items-center p-4 bg-terminal-cyan/5 border border-terminal-cyan/20">
                 <span className="text-[10px] font-bold uppercase text-terminal-cyan/60">Grand Total</span>
                 <span className="text-xl font-bold text-terminal-cyan font-mono">
                   <CurrencyDisplay amount={items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0)} currency={newCurrency} />
                 </span>
              </div>

              <div className="pt-4 flex justify-end gap-4 border-t border-terminal-cyan/30">
                <Button type="button" onClick={() => setShowAddModal(false)} className="bg-transparent border border-terminal-cyan text-terminal-cyan uppercase font-bold text-xs">Cancel</Button>
                <Button type="submit" className="bg-terminal-cyan text-black uppercase font-bold text-xs px-6">Save Invoice</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModalOpen && selectedReceivable && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-terminal-bg border-4 border-terminal-cyan p-8 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-terminal-cyan uppercase mb-6 flex items-center gap-2"><DollarSign size={20} /> Log Receipt</h2>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="bg-terminal-cyan/5 p-4 border border-terminal-cyan/20 font-mono text-xs space-y-1">
                <div className="flex justify-between"><span>Inv:</span><span>{selectedReceivable.invoice_number}</span></div>
                <div className="flex justify-between">
                  <span>Bal:</span>
                  <span className="text-terminal-cyan">
                    <CurrencyDisplay amount={selectedReceivable.total_amount - selectedReceivable.paid_amount} currency={selectedReceivable.currency} />
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Amount</label>
                <input required type="number" step="0.01" max={selectedReceivable.total_amount - selectedReceivable.paid_amount} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-4">
                <Button type="button" onClick={() => setPaymentModalOpen(false)} className="bg-transparent border border-terminal-cyan text-terminal-cyan uppercase text-xs">Cancel</Button>
                <Button type="submit" className="bg-terminal-cyan text-black uppercase text-xs px-6">Record</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
