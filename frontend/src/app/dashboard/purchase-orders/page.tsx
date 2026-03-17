"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Package, 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XSquare,
  FileText,
  DollarSign,
  User,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { CurrencySelector } from "@/components/ui/currency-selector";

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create form states
  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poCurrency, setPoCurrency] = useState("USD");
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState<any[]>([{ description: "", quantity: 1, unit_price: 0, product_id: null }]);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<number, number>>({});

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [poRes, vendorRes, productRes] = await Promise.all([
        api.get("/purchase-orders/"),
        api.get("/invoices/vendors"),
        api.get("/products/")
      ]);
      setPos(poRes.data);
      setVendors(vendorRes.data);
      setProducts(productRes.data);
    } catch (err) {
      console.error("Failed to fetch PO data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePO = async () => {
    try {
      const payload = {
        vendor_id: parseInt(vendorId),
        po_number: poNumber,
        expected_delivery_date: expectedDate ? new Date(expectedDate).toISOString() : null,
        currency: poCurrency,
        items: items.map(it => ({
          ...it,
          product_id: it.product_id ? parseInt(it.product_id) : null
        }))
      };
      const res = await api.post("/purchase-orders/", payload);
      setPos([...pos, res.data]);
      setView("list");
      setItems([{ description: "", quantity: 1, unit_price: 0, product_id: null }]);
    } catch (err) {
      console.error("Failed to create PO:", err);
    }
  };

  const handleReceive = async () => {
    try {
      const itemsToReceive = Object.entries(receiptQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({
          item_id: parseInt(id),
          received: qty
        }));

      if (itemsToReceive.length === 0) {
        alert("Enter quantities to receive in the 'RECEIVE_NOW' column.");
        return;
      }

      const res = await api.post(`/purchase-orders/${selectedPO.id}/receive`, itemsToReceive);
      
      // Refresh detailed PO to get updated items
      const refreshRes = await api.get(`/purchase-orders/${selectedPO.id}`);
      const updatedPO = refreshRes.data;
      
      setSelectedPO(updatedPO);
      setPos(pos.map(p => p.id === selectedPO.id ? updatedPO : p));
      setReceiptQuantities({});
      alert(`Update successful. Status: ${updatedPO.status}`);
    } catch (err) {
      console.error("Failed to receive items:", err);
      alert("Error processing receipt. Check logs.");
    }
  };

  const handleConvertToBill = async () => {
    try {
      const res = await api.post(`/purchase-orders/${selectedPO.id}/convert-to-bill`);
      alert(`PO converted to Bill! Invoice ID: ${res.data.invoice_id}`);
      setSelectedPO({ ...selectedPO, status: "BILLED" });
      setPos(pos.map(p => p.id === selectedPO.id ? { ...p, status: "BILLED" } : p));
    } catch (err) {
      console.error("Failed to convert to bill:", err);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT": return "text-terminal-amber border-terminal-amber";
      case "ISSUED": return "text-terminal-cyan border-terminal-cyan";
      case "RECEIVED": return "text-terminal-green border-terminal-green";
      case "PARTIALLY_RECEIVED": return "text-terminal-amber border-terminal-amber";
      case "BILLED": return "text-terminal-green border-terminal-green opacity-50";
      default: return "text-terminal-red border-terminal-red";
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-terminal-green animate-pulse font-mono tracking-widest text-xl uppercase">
          Initializing_Procurement_Mod...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            PURCHASE_ORDERS
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
            Finance OS // Commitment Tracking & Supply Chain Intake
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
           {view === "list" && (
             <Button 
               onClick={() => setView("create")}
               className="bg-terminal-green text-black hover:bg-terminal-green-dark border-none"
             >
               <Plus size={16} className="mr-2" /> ISSUE_NEW_PO
             </Button>
           )}
        </div>
      </div>

      {view === "list" && (
        <div className="grid grid-cols-1 gap-4">
          <div className="flex justify-between items-center bg-terminal-panel/50 p-4 border border-terminal-green/20">
             <div className="flex gap-8">
                <div className="text-center">
                   <div className="text-[10px] font-bold text-terminal-green/40 uppercase">Total Pending</div>
                   <div className="text-lg font-black text-terminal-green"><CurrencyDisplay amount={pos.reduce((acc, p) => p.status === 'ISSUED' ? acc + (p.total_amount * (p.exchange_rate || 1)) : acc, 0)} /></div>
                </div>
                <div className="text-center">
                   <div className="text-[10px] font-bold text-terminal-amber/40 uppercase">Partially Received</div>
                   <div className="text-lg font-black text-terminal-amber">{pos.filter(p => p.status === 'PARTIALLY_RECEIVED').length} Orders</div>
                </div>
             </div>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-green/30" size={14} />
                <Input 
                  placeholder="SEARCH_ORDERS..." 
                  className="bg-black border-terminal-green/50 text-terminal-green h-9 pl-10 w-64 rounded-none text-xs"
                />
             </div>
          </div>

          <Card className="rounded-none border-2 border-terminal-green bg-black">
            <CardContent className="p-0">
               <table className="w-full text-xs text-left">
                  <thead className="bg-terminal-green text-black uppercase font-bold">
                     <tr>
                        <th className="px-6 py-4">PO_ID</th>
                        <th className="px-6 py-4">Vendor</th>
                        <th className="px-6 py-4">Issue Date</th>
                        <th className="px-6 py-4 text-right">Total Amount</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4"></th>
                     </tr>
                  </thead>
                  <tbody className="text-terminal-green">
                     {pos.sort((a,b) => b.id - a.id).map((po) => (
                       <tr key={po.id} className="border-b border-terminal-green/10 hover:bg-terminal-green/5 transition-colors group">
                          <td className="px-6 py-4 font-black font-mono tracking-tighter text-lg">{po.po_number}</td>
                          <td className="px-6 py-4">
                             <div className="font-bold uppercase tracking-tight">{vendors.find(v => v.id === po.vendor_id)?.name || "Unknown Vendor"}</div>
                             <div className="text-[9px] opacity-40">SYSTEM_ID: PO-{po.id}</div>
                          </td>
                          <td className="px-6 py-4 font-mono opacity-70">
                             {new Date(po.issue_date).toLocaleDateString()}
                          </td>
                           <td className="px-6 py-4 text-right font-black text-terminal-cyan">
                              <CurrencyDisplay amount={po.total_amount} currency={po.currency} />
                           </td>
                          <td className="px-6 py-4">
                             <div className={`mx-auto w-fit px-3 py-1 border text-[10px] font-bold uppercase tracking-widest ${getStatusColor(po.status)}`}>
                                [{po.status}]
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Button 
                               onClick={() => { setSelectedPO(po); setView("detail"); }}
                               variant="outline" 
                               size="sm" 
                               className="border-terminal-green/50 text-terminal-green hover:bg-terminal-green hover:text-black h-8 px-4"
                             >
                               VIEW_INTEL <ChevronRight size={14} className="ml-1" />
                             </Button>
                          </td>
                       </tr>
                     ))}
                     {pos.length === 0 && (
                       <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-terminal-green/20 italic font-mono">
                             No order telemetry found. Issue a new PO to begin procurement tracking.
                          </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-none border-2 border-terminal-green bg-black">
                 <CardHeader className="border-b border-terminal-green/30">
                    <CardTitle className="text-xs font-black uppercase text-terminal-green tracking-[0.2em]">PO_CONFIGURATION_ENTRY</CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-terminal-green/50">Target Vendor</label>
                          <select 
                             value={vendorId}
                             onChange={(e) => setVendorId(e.target.value)}
                             className="w-full bg-black border-2 border-terminal-green/50 text-terminal-green h-12 px-4 focus:border-terminal-green focus:ring-0 outline-none uppercase font-bold text-xs"
                          >
                             <option value="">SELECT_VENDOR...</option>
                             {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                       </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase text-terminal-green/50">Order Serial Number</label>
                           <Input 
                              value={poNumber}
                              onChange={(e) => setPoNumber(e.target.value)}
                              placeholder="PO-2026-XXXX"
                              className="bg-black border-2 border-terminal-green/50 h-10 text-terminal-green rounded-none"
                           />
                        </div>
                        <div className="space-y-2">
                           <CurrencySelector value={poCurrency} onChange={setPoCurrency} label="Transaction Currency" />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-end border-b border-terminal-green/20 pb-2">
                          <h3 className="text-xs font-black uppercase text-terminal-green tracking-widest">Line Item Definition</h3>
                          <Button onClick={addItem} variant="outline" size="sm" className="h-7 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black text-[10px]">
                             + ADD_ROW
                          </Button>
                       </div>
                       
                       <div className="space-y-3">
                          {items.map((item, idx) => (
                             <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-4 space-y-1">
                                   <label className="text-[8px] font-bold text-terminal-green/40 uppercase">Product/Svc</label>
                                   <select 
                                      value={item.product_id || ""}
                                      onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                                      className="w-full bg-black border border-terminal-green/30 text-terminal-green h-9 px-2 text-[10px] focus:border-terminal-green outline-none"
                                   >
                                      <option value="">SELECT_ITEM...</option>
                                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                   </select>
                                </div>
                                <div className="col-span-4 space-y-1">
                                   <label className="text-[8px] font-bold text-terminal-green/40 uppercase">Custom Description</label>
                                   <Input 
                                      value={item.description}
                                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                                      className="bg-black border border-terminal-green/30 h-9 text-terminal-green text-[10px] rounded-none"
                                   />
                                </div>
                                <div className="col-span-1 space-y-1">
                                   <label className="text-[8px] font-bold text-terminal-green/40 uppercase">Qty</label>
                                   <Input 
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value))}
                                      className="bg-black border border-terminal-green/30 h-9 text-terminal-green text-[10px] rounded-none text-center"
                                   />
                                </div>
                                <div className="col-span-2 space-y-1">
                                   <label className="text-[8px] font-bold text-terminal-green/40 uppercase">Unit Price</label>
                                   <Input 
                                      type="number"
                                      value={item.unit_price}
                                      onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value))}
                                      className="bg-black border border-terminal-green/30 h-9 text-terminal-green text-[10px] rounded-none text-right"
                                   />
                                </div>
                                <div className="col-span-1 flex justify-center pb-2">
                                   <Button 
                                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                      className="h-6 w-6 p-0 bg-terminal-red/20 text-terminal-red hover:bg-terminal-red hover:text-black border-none"
                                   >
                                      <XSquare size={14} />
                                   </Button>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>
           
           <div className="space-y-6">
              <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-cyan/5 p-6">
                 <h3 className="text-xs font-black uppercase text-terminal-cyan tracking-widest mb-6">Order Summary</h3>
                 <div className="space-y-4 font-mono text-xs">
                     <div className="flex justify-between border-b border-terminal-cyan/20 pb-2">
                        <span className="text-terminal-cyan/50">SUBTOTAL</span>
                        <span className="text-terminal-cyan"><CurrencyDisplay amount={items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0)} currency={poCurrency} /></span>
                     </div>
                     <div className="flex justify-between border-b border-terminal-cyan/20 pb-2">
                        <span className="text-terminal-cyan/50">TAX (EST)</span>
                        <span className="text-terminal-cyan"><CurrencyDisplay amount={0} currency={poCurrency} /></span>
                     </div>
                     <div className="flex justify-between pt-4">
                        <span className="text-terminal-cyan font-bold">TOTAL_COMMITMENT</span>
                        <span className="text-xl font-black text-terminal-cyan underline">
                           <CurrencyDisplay amount={items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0)} currency={poCurrency} />
                        </span>
                     </div>
                 </div>
                 <Button 
                    onClick={handleCreatePO}
                    disabled={!vendorId || !poNumber || items.length === 0}
                    className="w-full mt-8 bg-terminal-cyan text-black hover:bg-terminal-cyan/80 border-none h-14 font-black uppercase tracking-[0.2em]"
                 >
                    TRANSMIT_ORDER_SERIAL
                 </Button>
              </Card>
           </div>
        </div>
      )}

      {view === "detail" && selectedPO && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-3 space-y-6">
              <Card className="rounded-none border-2 border-terminal-green bg-black">
                 <div className="p-8 flex justify-between items-start border-b border-terminal-green/20">
                    <div>
                       <div className={`w-fit px-3 py-1 border text-[10px] font-bold uppercase tracking-[0.2em] mb-4 ${getStatusColor(selectedPO.status)}`}>
                          STATUS: {selectedPO.status}
                       </div>
                       <h2 className="text-4xl font-black text-terminal-green tracking-tighter uppercase">{selectedPO.po_number}</h2>
                       <div className="flex gap-6 mt-4 text-[10px] font-bold uppercase opacity-60 font-mono">
                          <div className="flex items-center gap-2"><Calendar size={14} /> ISSUED: {new Date(selectedPO.issue_date).toLocaleDateString()}</div>
                          <div className="flex items-center gap-2 text-terminal-cyan"><Truck size={14} /> EXPECTED: {selectedPO.expected_delivery_date ? new Date(selectedPO.expected_delivery_date).toLocaleDateString() : "TBD"}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] font-bold text-terminal-green/50 uppercase mb-1">Target Vendor</div>
                       <div className="text-xl font-bold text-terminal-green">{vendors.find(v => v.id === selectedPO.vendor_id)?.name}</div>
                    </div>
                 </div>
                 
                 <CardContent className="p-0">
                    <table className="w-full text-xs text-left">
                       <thead className="bg-terminal-green/10 text-terminal-green uppercase font-bold border-b border-terminal-green/20">
                          <tr>
                             <th className="px-8 py-4">Item Description</th>
                             <th className="px-8 py-4 text-center">Qty Ordered</th>
                             <th className="px-8 py-4 text-center">Qty Received</th>
                             { (selectedPO.status === 'ISSUED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                               <th className="px-8 py-4 text-center text-terminal-amber">Receive Now</th>
                             )}
                             <th className="px-8 py-4 text-right">Unit Price</th>
                             <th className="px-8 py-4 text-right">Total</th>
                          </tr>
                       </thead>
                       <tbody className="text-terminal-green">
                          {selectedPO.items.map((item: any) => (
                             <tr key={item.id} className="border-b border-terminal-green/10">
                                <td className="px-8 py-6 font-bold uppercase">{item.description}</td>
                                <td className="px-8 py-6 text-center font-mono">{item.quantity}</td>
                                <td className="px-8 py-6 text-center font-mono text-terminal-amber">
                                   {item.quantity_received} / {item.quantity}
                                </td>
                                { (selectedPO.status === 'ISSUED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                                  <td className="px-8 py-6 text-center">
                                     {item.quantity_received < item.quantity ? (
                                       <Input 
                                         type="number"
                                         className="w-20 mx-auto bg-black border-terminal-amber text-terminal-amber h-8 text-xs text-center rounded-none"
                                         placeholder="0"
                                         value={receiptQuantities[item.id] || ""}
                                         onChange={(e) => setReceiptQuantities({
                                           ...receiptQuantities,
                                           [item.id]: parseFloat(e.target.value) || 0
                                         })}
                                       />
                                     ) : (
                                       <CheckCircle2 size={16} className="mx-auto text-terminal-green opacity-50" />
                                     )}
                                  </td>
                                )}
                                 <td className="px-8 py-6 text-right font-mono"><CurrencyDisplay amount={item.unit_price} currency={selectedPO.currency} /></td>
                                 <td className="px-8 py-6 text-right font-black text-terminal-cyan"><CurrencyDisplay amount={item.total_price} currency={selectedPO.currency} /></td>
                             </tr>
                          ))}
                          <tr className="bg-terminal-green/5">
                              <td colSpan={(selectedPO.status === 'ISSUED' || selectedPO.status === 'PARTIALLY_RECEIVED') ? 5 : 4} className="px-8 py-6 text-right font-bold uppercase text-terminal-green/60">Total Commitment Value</td>
                              <td className="px-8 py-6 text-right font-black text-2xl text-terminal-cyan"><CurrencyDisplay amount={selectedPO.total_amount} currency={selectedPO.currency} /></td>
                          </tr>
                       </tbody>
                    </table>
                 </CardContent>
              </Card>
           </div>
           
           <div className="space-y-6">
              <Card className="rounded-none border-2 border-terminal-amber bg-black p-6">
                 <h3 className="text-xs font-black uppercase text-terminal-amber tracking-widest mb-6 flex items-center gap-2">
                    <ClipboardList size={16} /> Order Actions
                 </h3>
                 <div className="space-y-4">
                    <Button 
                       onClick={() => window.print()}
                       variant="outline"
                       className="w-full border-terminal-amber text-terminal-amber hover:bg-terminal-amber hover:text-black font-bold uppercase h-12"
                    >
                       PRINT_PO_TELEGRAM
                    </Button>
                    {(selectedPO.status === 'ISSUED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                       <Button 
                          onClick={handleReceive}
                          className="w-full bg-terminal-amber text-black hover:bg-terminal-amber/80 border-none font-bold uppercase h-12"
                       >
                          PROCESS_CARGO_RECEIPT
                       </Button>
                    )}
                    {(selectedPO.status === 'RECEIVED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                       <Button 
                          onClick={handleConvertToBill}
                          variant="outline"
                          className="w-full border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan hover:text-black font-bold uppercase h-12"
                       >
                          CONVERT_TO_BILL
                       </Button>
                    )}
                 </div>
              </Card>
              
              <div className="border-2 border-terminal-green/30 bg-terminal-panel p-6 space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-terminal-green/50 tracking-widest">Audit Trail</h4>
                 <div className="space-y-3 font-mono text-[9px]">
                    <div className="flex gap-2 text-terminal-green/60 uppercase">
                       <span>[{new Date(selectedPO.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                       <span className="text-terminal-green">INITIALIZED</span>
                    </div>
                    <div className="flex gap-2 text-terminal-green/60 uppercase underline italic">
                       <span>[SYSTEM]</span>
                       <span>WATCHING_COMMODITY_FLOATS_</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
