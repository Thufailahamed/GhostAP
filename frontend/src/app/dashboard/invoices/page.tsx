"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search,
  Filter,
  Trash2,
  Download,
  CheckSquare,
  Square,
  AlertTriangle,
  Check,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  amount: number;
  status: string;
  date: string;
  source: string;
  source_email_from: string;
  source_email_subject: string;
  currency: string;
  created_at?: string;
}

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchApproving, setBatchApproving] = useState(false);
  const { showToast, showConfirm } = useToast();

  const fetchInvoices = async () => {
    try {
      const response = await api.get("/invoices");
      setInvoices(response.data);
    } catch (error) {
      console.error("Failed to fetch live invoices from FastAPI:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    const confirmed = await showConfirm(
      `Are you sure you want to PERMANENTLY delete invoice ${invoiceNumber}? This action cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await api.delete(`/invoices/${invoiceId}`);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      showToast(`Invoice ${invoiceNumber} deleted.`, "success");
    } catch (error: any) {
      showToast(
        `Error: ${error.response?.data?.detail || error.message}`,
        "error",
      );
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pending = filteredInvoices.filter(
      (inv) => inv.status === "REVIEW_REQUIRED" || inv.status === "PENDING",
    );
    if (selectedIds.size === pending.length && pending.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map((inv) => inv.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchApproving(true);
    let approved = 0;
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      const inv = invoices.find((i) => i.id === id);
      try {
        await api.post(`/invoices/review/${id}`, {
          vendor_name: inv?.vendor_name || "",
          status: "APPROVED",
        });
        approved++;
      } catch {
        failed++;
      }
    }
    setBatchApproving(false);
    setSelectedIds(new Set());
    await fetchInvoices();
    if (failed === 0) {
      showToast(
        `✅ ${approved} invoice${approved !== 1 ? "s" : ""} approved successfully!`,
        "success",
      );
    } else {
      showToast(`${approved} approved, ${failed} failed.`, "error");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Invoice #",
      "Vendor",
      "Amount",
      "Currency",
      "Date",
      "Status",
      "Source",
    ];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number,
      inv.vendor_name,
      inv.amount.toFixed(2),
      inv.currency || "USD",
      inv.date,
      inv.status,
      inv.source || "UPLOAD",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      `Exported ${filteredInvoices.length} invoices to CSV.`,
      "success",
    );
  };

  const filteredInvoices = invoices.filter((inv) => {
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(query) ||
      inv.vendor_name.toLowerCase().includes(query) ||
      inv.status.toLowerCase().includes(query) ||
      inv.amount.toString().includes(query)
    );
  });

  const today = new Date();
  const overdueCount = invoices.filter((inv) => {
    if (inv.status === "PAID" || inv.status === "APPROVED") return false;
    // We don't have due_date on the list endpoint, so flag older REVIEW_REQUIRED ones
    if (inv.created_at) {
      const age =
        (today.getTime() - new Date(inv.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      return age > 30 && inv.status === "REVIEW_REQUIRED";
    }
    return false;
  }).length;

  const pendingToApprove = filteredInvoices.filter(
    (inv) => inv.status === "REVIEW_REQUIRED" || inv.status === "PENDING",
  );

  return (
    <div className="space-y-4 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            INVOICE_INDEX
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
            Finance OS // Document Lifecycle Management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportCSV}
            className="h-10 border-2 border-terminal-green bg-transparent text-terminal-green hover:bg-terminal-green hover:text-black flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
          >
            <Download size={16} /> Export CSV
          </Button>
          <Link href="/dashboard/upload">
            <Button className="tracking-widest bg-terminal-green text-black hover:bg-terminal-green-dark border-none px-6">
              + NEW_UPLOAD
            </Button>
          </Link>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 border-2 border-terminal-red bg-terminal-red/10 text-terminal-red font-mono text-sm font-bold uppercase tracking-widest">
          <AlertTriangle size={18} className="flex-shrink-0 animate-pulse" />
          <span>
            ⚠ {overdueCount} invoice{overdueCount !== 1 ? "s" : ""} pending
            review for 30+ days — immediate attention required!
          </span>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 flex items-center border-2 border-terminal-green bg-terminal-panel px-4">
          <Search size={20} className="text-terminal-green/50" />
          <input
            type="text"
            placeholder="SEARCH INVOICES (ID, VENDOR, STATUS, AMOUNT)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm text-terminal-green placeholder:text-terminal-green/50"
          />
        </div>
        <Button className="h-[52px] border-2 border-terminal-green bg-terminal-panel text-terminal-green hover:bg-terminal-green hover:text-black flex items-center gap-2">
          <Filter size={20} />
          FILTER STATUS
        </Button>
      </div>

      <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
        <CardContent className="p-0 mt-0 bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b-2 border-terminal-green font-bold text-terminal-green">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-terminal-green hover:text-white transition-colors"
                    >
                      {selectedIds.size > 0 &&
                      selectedIds.size === pendingToApprove.length ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Invoice #
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Vendor
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center font-bold text-terminal-amber bg-transparent"
                    >
                      Loading Live Database...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center font-bold text-terminal-amber uppercase tracking-widest bg-transparent"
                    >
                      {searchQuery
                        ? "No Invoices Match Your Search"
                        : "No Invoices Uploaded Yet"}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const canSelect =
                      inv.status === "REVIEW_REQUIRED" ||
                      inv.status === "PENDING";
                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-[#333] hover:bg-[#111] transition-colors bg-transparent ${selectedIds.has(inv.id) ? "bg-terminal-green/5 border-l-2 border-l-terminal-green" : ""}`}
                      >
                        <td className="px-4 py-4">
                          {canSelect ? (
                            <button
                              onClick={() => toggleSelect(inv.id)}
                              className="text-terminal-green hover:text-white transition-colors"
                            >
                              {selectedIds.has(inv.id) ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          ) : (
                            <span className="block w-4" />
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold font-mono">
                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="hover:text-terminal-cyan transition-colors"
                          >
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-bold">
                          <div className="flex items-center gap-2">
                            {inv.vendor_name}
                            {inv.source === "EMAIL" && (
                              <span
                                title={`Via Email: ${inv.source_email_from}\n${inv.source_email_subject}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase border border-terminal-cyan text-terminal-cyan cursor-help bg-black"
                              >
                                📧 Email
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-terminal-green">
                          {inv.currency === "GBP"
                            ? "£"
                            : inv.currency === "EUR"
                              ? "€"
                              : inv.currency === "AED"
                                ? "AED "
                                : "$"}
                          {inv.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 font-mono">{inv.date}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {inv.created_at
                            ? new Date(inv.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <StatusChip status={inv.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Link href={`/dashboard/invoices/${inv.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-terminal-panel text-terminal-green border border-terminal-green hover:bg-terminal-green hover:text-black px-4"
                              >
                                OPEN
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDelete(inv.id, inv.invoice_number)
                              }
                              className="bg-transparent text-terminal-red border-terminal-red hover:bg-terminal-red hover:text-black px-3"
                              title="Delete Invoice"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-black border-2 border-terminal-green shadow-[0_0_30px_rgba(0,255,0,0.2)] font-mono">
          <span className="text-terminal-green font-bold uppercase tracking-widest text-sm">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-6 bg-terminal-green/30" />
          <Button
            onClick={handleBatchApprove}
            disabled={batchApproving}
            className="bg-terminal-green text-black hover:bg-green-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2 px-6"
          >
            <Check size={16} />
            {batchApproving
              ? "Approving..."
              : `Approve All (${selectedIds.size})`}
          </Button>
          <Button
            onClick={() => setSelectedIds(new Set())}
            className="bg-transparent border border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-bold uppercase text-xs tracking-widest"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  let colorClass = "text-terminal-amber";
  if (status === "APPROVED" || status === "SYNCED_TO_ERP")
    colorClass = "text-terminal-green";
  else if (status === "REJECTED" || status === "FAILED")
    colorClass = "text-terminal-red";
  else if (status === "PENDING" || status === "REVIEW_REQUIRED")
    colorClass = "text-terminal-amber";
  else if (status === "PROCESSING") colorClass = "text-terminal-cyan";
  else if (status === "PARTIAL") colorClass = "text-terminal-cyan";
  else if (status === "PAID") colorClass = "text-terminal-green";
  return (
    <span
      className={`text-[11px] font-bold tracking-tighter uppercase whitespace-nowrap ${colorClass}`}
    >
      [{status}]
    </span>
  );
}
