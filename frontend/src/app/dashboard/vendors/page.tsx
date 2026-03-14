"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Flag, FileText, Edit3, Check, X } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface Vendor {
  id: number;
  name: string;
  tax_id: string;
  default_currency: string;
  notes: string;
  is_flagged: boolean;
  invoice_count: number;
}

export default function VendorsListPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const { showToast } = useToast();

  const fetchVendors = useCallback(async () => {
    try {
      const res = await api.get("/invoices/vendors");
      setVendors(res.data);
    } catch (err) {
      console.error("Failed to fetch vendors", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleToggleFlag = async (vendor: Vendor) => {
    try {
      await api.patch(`/invoices/vendors/${vendor.id}/notes`, {
        is_flagged: !vendor.is_flagged,
      });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, is_flagged: !v.is_flagged } : v,
        ),
      );
      showToast(
        vendor.is_flagged
          ? `${vendor.name} unflagged.`
          : `⚑ ${vendor.name} flagged as risky.`,
        vendor.is_flagged ? "success" : "info",
      );
    } catch {
      showToast("Failed to update flag", "error");
    }
  };

  const handleSaveNotes = async (vendor: Vendor) => {
    try {
      await api.patch(`/invoices/vendors/${vendor.id}/notes`, {
        notes: editingNotes,
      });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, notes: editingNotes } : v,
        ),
      );
      setEditingId(null);
      showToast("Vendor notes saved.", "success");
    } catch {
      showToast("Failed to save notes", "error");
    }
  };

  const filtered = vendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) || v.tax_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            VENDOR_DIRECTORY
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1 tracking-widest">
            Finance OS // Vendor Intelligence Registry
          </p>
        </div>
        <span className="text-terminal-green/40 font-mono text-sm">
          {vendors.length} vendors
        </span>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex items-center border-2 border-terminal-green bg-terminal-panel px-4">
          <Search size={20} className="text-terminal-green/50" />
          <input
            type="text"
            placeholder="SEARCH VENDORS (NAME, TAX ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm text-terminal-green placeholder:text-terminal-green/50"
          />
        </div>
      </div>

      <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
        <CardContent className="p-0 mt-0 bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b-2 border-terminal-green font-bold text-terminal-green">
                <tr>
                  <th className="px-6 py-4">Vendor Name</th>
                  <th className="px-6 py-4">Tax ID</th>
                  <th className="px-6 py-4 text-center">Invoices</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-center">Flag</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-terminal-green/50 uppercase tracking-widest animate-pulse bg-transparent"
                    >
                      Loading Vendor Registry...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-terminal-green/50 uppercase tracking-widest bg-transparent"
                    >
                      No vendors found
                    </td>
                  </tr>
                ) : (
                  filtered.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className={`border-b border-[#333] hover:bg-terminal-green/5 transition-colors bg-transparent ${vendor.is_flagged ? "border-l-4 border-l-terminal-red" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {vendor.is_flagged && (
                            <Flag
                              size={14}
                              className="text-terminal-red flex-shrink-0"
                            />
                          )}
                          <span
                            className={`font-bold uppercase ${vendor.is_flagged ? "text-terminal-red" : "text-terminal-green"}`}
                          >
                            {vendor.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-terminal-green/60 text-xs">
                        {vendor.tax_id || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-terminal-cyan text-xs font-bold">
                          <FileText size={13} /> {vendor.invoice_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 w-80">
                        {editingId === vendor.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveNotes(vendor);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 bg-black border border-terminal-green px-2 py-1 text-terminal-green text-xs font-mono outline-none focus:border-white"
                              placeholder="Type a note..."
                            />
                            <button
                              onClick={() => handleSaveNotes(vendor)}
                              className="text-terminal-green hover:text-white transition-colors"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-terminal-red hover:text-white transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => {
                              setEditingId(vendor.id);
                              setEditingNotes(vendor.notes || "");
                            }}
                          >
                            <span
                              className={`text-xs font-mono ${vendor.notes ? "text-terminal-amber" : "text-terminal-green/30 italic"}`}
                            >
                              {vendor.notes || "Click to add note..."}
                            </span>
                            <Edit3
                              size={12}
                              className="text-terminal-green/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleFlag(vendor)}
                          className={`transition-all hover:scale-110 ${vendor.is_flagged ? "text-terminal-red" : "text-terminal-green/20 hover:text-terminal-red"}`}
                          title={
                            vendor.is_flagged ? "Remove flag" : "Flag as risky"
                          }
                        >
                          <Flag
                            size={18}
                            fill={vendor.is_flagged ? "currentColor" : "none"}
                          />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
