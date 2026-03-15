"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  FileText,
  Check,
  X,
  Save,
  Send,
  ChevronLeft,
  AlertTriangle,
  DollarSign,
  RefreshCw,
} from "lucide-react";

import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function InvoiceDetailSplitView() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    vendor_name: "Loading...",
    invoice_number: id,
    date: "",
    due_date: "",
    subtotal: "0.00",
    discount: "0.00",
    tax: "0.00",
    shipping: "0.00",
    total: "0.00",
    line_items: [] as any[],
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [invoiceStatus, setInvoiceStatus] = useState("REVIEW_REQUIRED");
  const [paidAmount, setPaidAmount] = useState(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [emailSource, setEmailSource] = useState<{
    from: string;
    subject: string;
  } | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Fetch Live Data on Mount
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await api.get(`/invoices/${id}`);
        const data = response.data;
        // Normalize date to YYYY-MM-DD for HTML date input
        const rawDate = data.date || data.issue_date || "";
        let normalizedDate = "";
        if (rawDate && rawDate !== "N/A") {
          // If already YYYY-MM-DD keep it, otherwise try to convert
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            normalizedDate = rawDate;
          } else {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) {
              normalizedDate = parsed.toISOString().split("T")[0];
            }
          }
        }

        setFormData({
          vendor_name: data.vendor_name || "Unknown Vendor",
          invoice_number: data.invoice_number || id,
          date: normalizedDate,
          due_date:
            data.due_date && data.due_date !== "N/A" ? data.due_date : "",
          subtotal: (data.subtotal || 0).toFixed(2),
          discount: (data.discount_amount || 0).toFixed(2),
          tax: (data.tax_amount || 0).toFixed(2),
          shipping: (data.shipping_amount || 0).toFixed(2),
          total: (data.total_amount || 0).toFixed(2),
          line_items: data.line_items || [],
        });

        setCurrency(data.currency || "USD");
        setInvoiceStatus(data.status || "REVIEW_REQUIRED");

        // Fetch full detail if available to get paid amount (the list API might not perfectly map to detail view)
        // If not, we map it.
        setPaidAmount(data.paid_amount || 0);

        if (data.source === "EMAIL") {
          setEmailSource({
            from: data.source_email_from || "",
            subject: data.source_email_subject || "",
          });
        }

        if (data.pdf_path) {
          // Construct absolute URL mapping to the FastAPI backend static file route
          const baseUrl =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          setPdfUrl(`${baseUrl}${data.pdf_path}`);
        }

        // Fetch customers for conversion
        const custRes = await api.get("/receivables/customers");
        setCustomers(custRes.data);
      } catch (err) {
        console.error("Failed to load invoice:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  // Re-calculate Total on Change
  useEffect(() => {
    const s = parseFloat(formData.subtotal) || 0;
    const d = parseFloat(formData.discount) || 0;
    const t = parseFloat(formData.tax) || 0;
    const sh = parseFloat(formData.shipping) || 0;
    const newTotal = (s - d + t + sh).toFixed(2);
    if (newTotal !== formData.total) {
      setFormData((prev) => ({ ...prev, total: newTotal }));
    }
  }, [formData.subtotal, formData.discount, formData.tax, formData.shipping]);

  // Automatic Validation Layer Effect
  useEffect(() => {
    if (isLoading) return; // Skip validation while still fetching DB row

    const validateData = async () => {
      setIsValidating(true);
      try {
        const response = await api.post(`/invoices/${id}/validate`, formData);
        const result = response.data;
        if (result.validation) {
          setErrors(result.validation.errors || []);
          setWarnings(result.validation.warnings || []);
        }
      } catch (err) {
        console.error("Failed to connect to Intelligence Layer", err);
      } finally {
        setIsValidating(false);
      }
    };

    // Debounce the validation call
    const timeoutId = setTimeout(() => {
      validateData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData, id, isLoading]);

  const handleAction = async (action: string) => {
    if (action === "REPROCESS") {
      setIsReprocessing(true);
      try {
        await api.post(`/invoices/${id}/reprocess`);
        showToast(
          "Invoice successfully re-processed. Reloading data...",
          "success",
        );
        // Refresh the page to load new data
        window.location.reload();
        return;
      } catch (err: any) {
        console.error("Reprocess failed:", err);
        showToast(
          err.response?.data?.detail || "Failed to reprocess OCR.",
          "error",
        );
        setIsReprocessing(false);
        return;
      }
    }

    if (action === "REJECT") {
      try {
        await api.post(`/invoices/review/${id}`, {
          ...formData,
          status: "REJECTED",
        });
        router.push("/dashboard/invoices");
        return;
      } catch (err) {
        console.error("Reject failed:", err);
        return;
      }
    }

    if (action === "OPEN_PAYMENT") {
      setPaymentAmountStr((parseFloat(formData.total) - paidAmount).toFixed(2));
      setIsPaymentModalOpen(true);
      return;
    }

    if (action === "SUBMIT_PAYMENT") {
      try {
        const payFormData = new FormData();
        payFormData.append("bank_account_id", "1"); // Default Main Account
        payFormData.append("amount", paymentAmountStr);
        await api.post(`/invoices/${id}/pay`, payFormData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        setIsPaymentModalOpen(false);
        // Refresh invoice data
        router.refresh();
        window.location.reload();
        return;
      } catch (err) {
        console.error("Payment failed:", err);
        showToast(
          "Payment failed. Please check balance or try again.",
          "error",
        );
        return;
      }
    }

    if (action === "CONVERT_RECEIVABLE") {
      if (!selectedCustomerId) {
        showToast("Please select a customer first.", "error");
        return;
      }
      setIsConverting(true);
      try {
        const res = await api.post(`/invoices/${id}/convert-to-receivable?customer_id=${selectedCustomerId}`);
        showToast("Successfully converted to Receivable record.", "success");
        router.push(`/dashboard/receivables/${res.data.receivable_id}`);
      } catch (err: any) {
        showToast(err.response?.data?.detail || "Conversion failed.", "error");
      } finally {
        setIsConverting(false);
      }
      return;
    }

    if (action === "APPROVE" && errors.length > 0) {
      showToast(
        "Cannot approve invoice with active critical validation errors.",
        "error",
      );
      return;
    }

    try {
      const status = action === "APPROVE" ? "APPROVED" : "SYNCED_TO_ERP";
      await api.post(`/invoices/review/${id}`, {
        ...formData,
        status,
        approval_comment: approvalComment || undefined,
      });
      showToast(`Invoice ${status} successfully.`, "success");
      router.push("/dashboard/invoices");
    } catch (err) {
      console.error("Action failed:", err);
      showToast("Failed to save invoice changes.", "error");
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-8 text-terminal-green">
      {/* Header Bar */}
      <header className="h-16 border-b-2 border-terminal-green bg-terminal-bg flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button
              variant="ghost"
              size="sm"
              className="border border-terminal-green hover:bg-terminal-green hover:text-black p-2 h-auto text-terminal-green"
            >
              <ChevronLeft size={20} />
            </Button>
          </Link>
          <div className="font-mono text-lg font-bold">
            INVOICE: <span className="text-terminal-cyan">{id}</span>
          </div>
          <span className="px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border bg-transparent border-terminal-amber text-terminal-amber">
            PENDING REVIEW
          </span>
          {emailSource && (
            <span
              title={`From: ${emailSource.from}\nSubject: ${emailSource.subject}`}
              className="px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border bg-transparent border-terminal-cyan text-terminal-cyan flex items-center gap-1 cursor-help"
            >
              📧 VIA EMAIL
            </span>
          )}
          {isValidating && (
            <span className="text-xs font-mono font-bold text-terminal-green/50 animate-pulse ml-4">
              VALIDATING...
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={isReprocessing}
            className="bg-transparent text-terminal-cyan border-terminal-cyan hover:bg-terminal-cyan hover:text-black gap-2 text-xs"
            onClick={() => handleAction("REPROCESS")}
          >
            <AlertCircle size={16} />{" "}
            {isReprocessing ? "RUNNING OCR..." : "REPROCESS OCR"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-xs bg-transparent text-terminal-amber border-terminal-amber hover:bg-terminal-amber hover:text-black"
            onClick={() => handleAction("SAVE_DRAFT")}
          >
            <Save size={16} /> SAVE CHANGES
          </Button>
          <Button
            variant="destructive"
            className="bg-transparent gap-2 text-xs"
            onClick={() => handleAction("REJECT")}
          >
            <X size={16} /> REJECT
          </Button>
          <Button
            disabled={errors.length > 0}
            className="bg-transparent text-terminal-green border border-terminal-green hover:bg-terminal-green hover:text-black gap-2 text-xs disabled:opacity-30 disabled:border-terminal-green/30 disabled:text-terminal-green/30"
            onClick={() => handleAction("APPROVE")}
          >
            <Check size={16} /> APPROVE
          </Button>
          <Button
            variant="outline"
            className="bg-transparent text-terminal-cyan border-terminal-cyan hover:bg-terminal-cyan hover:text-black gap-2 text-xs"
            onClick={() => handleAction("SUBMIT_ERP")}
          >
            <Send size={16} /> SUBMIT TO ERP
          </Button>
          <Button
            variant="outline"
            className="bg-transparent text-terminal-cyan border-terminal-cyan hover:bg-terminal-cyan hover:text-black gap-2 text-xs"
            onClick={() => setIsConvertModalOpen(true)}
          >
            <RefreshCw size={16} /> CONVERT_TO_RECEIVABLE
          </Button>

          {(invoiceStatus === "APPROVED" ||
            invoiceStatus === "SYNCED_TO_ERP" ||
            invoiceStatus === "PARTIAL") && (
            <Button
              variant="outline"
              className="bg-terminal-green text-black border-terminal-green hover:bg-terminal-green/80 gap-2 text-xs font-black shadow-[0_0_15px_rgba(0,255,136,0.3)]"
              onClick={() => handleAction("OPEN_PAYMENT")}
            >
              <DollarSign size={16} /> RECORD PAYMENT
            </Button>
          )}
        </div>
      </header>

      {/* Split Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: PDF Preview Pane */}
        <div className="w-1/2 border-r-2 border-terminal-green bg-terminal-bg p-6 overflow-y-auto flex flex-col pt-10 items-center relative">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-2 border-terminal-green rounded-none"
              title="Invoice PDF Preview"
            />
          ) : (
            <div className="w-full max-w-[600px] aspect-[1/1.4] bg-terminal-panel border-2 border-dashed border-terminal-green flex flex-col items-center justify-center text-terminal-green/50">
              <FileText
                size={64}
                className="mb-4 opacity-50 text-terminal-green"
              />
              <h2 className="font-bold text-xl uppercase tracking-widest text-terminal-green text-center px-4">
                [ No PDF Attached ]<br />
              </h2>
            </div>
          )}
        </div>

        {/* RIGHT: Extracted Data / Verification Pane */}
        <div className="w-1/2 bg-terminal-panel overflow-y-auto flex flex-col relative text-terminal-green">
          {/* Dynamic Intelligence Layer Alert Zone */}
          <div className="sticky top-0 z-10 w-full border-b border-[#333]">
            {errors.length > 0 && (
              <div className="bg-terminal-red/10 border-b-2 border-terminal-red p-4 flex gap-4 text-terminal-red">
                <AlertCircle className="flex-shrink-0 text-terminal-red mt-1" />
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-sm mb-1">
                    Critical Validation Errors ({errors.length})
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 font-medium text-sm">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {warnings.length > 0 && errors.length === 0 && (
              <div className="bg-terminal-amber/10 border-b-2 border-terminal-amber p-4 flex gap-4 text-terminal-amber">
                <AlertTriangle className="flex-shrink-0 text-terminal-amber mt-1" />
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-sm mb-1">
                    AI Validation Notes
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 font-medium text-sm">
                    {warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {errors.length === 0 && warnings.length === 0 && (
              <div className="bg-terminal-green/10 border-b-2 border-terminal-green p-3 flex gap-4 text-terminal-green items-center">
                <Check
                  className="flex-shrink-0 text-terminal-green"
                  size={20}
                />
                <h4 className="font-bold uppercase tracking-wider text-sm">
                  Data valid. Discrepancies resolved.
                </h4>
              </div>
            )}
          </div>

          {/* Editable Form */}
          <div className="p-8 space-y-8 flex-1">
            <div>
              <h3 className="text-lg font-bold uppercase border-b-2 border-terminal-green pb-2 mb-6 text-terminal-green">
                Header Data
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-terminal-green/70 tracking-wider">
                    Vendor Name
                  </label>
                  <Input
                    value={formData.vendor_name}
                    onChange={(e) =>
                      setFormData({ ...formData, vendor_name: e.target.value })
                    }
                    className="font-bold text-lg h-12 bg-transparent text-terminal-green border-terminal-green rounded-none focus-visible:ring-terminal-amber focus-visible:ring-1 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-terminal-green/70 tracking-wider">
                    Invoice Number
                  </label>
                  <Input
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice_number: e.target.value,
                      })
                    }
                    className={`font-mono font-bold text-lg h-12 rounded-none focus-visible:ring-1 focus-visible:ring-offset-0 ${errors.some((e) => e.includes("Duplicate") || e.includes("Invoice number")) ? "border-terminal-red bg-terminal-red/10 text-terminal-red focus-visible:ring-terminal-red" : "bg-transparent text-terminal-green border-terminal-green focus-visible:ring-terminal-amber"}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-terminal-green/70 tracking-wider">
                    Invoice Date
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className={`font-mono font-bold text-lg h-12 rounded-none focus-visible:ring-1 focus-visible:ring-offset-0 style-color-scheme-dark ${errors.some((e) => e.includes("date") || e.includes("Date")) ? "border-terminal-red bg-terminal-red/10 text-terminal-red focus-visible:ring-terminal-red" : "bg-transparent text-terminal-green border-terminal-green focus-visible:ring-terminal-amber"}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-terminal-green/70 tracking-wider">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    className={`font-mono font-bold text-lg h-12 rounded-none focus-visible:ring-1 focus-visible:ring-offset-0 style-color-scheme-dark bg-transparent text-terminal-amber border-terminal-amber focus-visible:ring-terminal-green`}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold uppercase border-b-2 border-terminal-green pb-2 mb-6 flex justify-between items-end text-terminal-green">
                Line Items
                <span className="text-xs text-terminal-green/50">
                  All amounts in {currency}
                </span>
              </h3>

              <div className="border-2 border-terminal-green bg-transparent">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#111] border-b-2 border-terminal-green text-xs uppercase font-bold text-terminal-green/70">
                    <tr>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 w-20 text-right">Qty</th>
                      <th className="px-4 py-3 w-32 text-right">Unit Price</th>
                      <th className="px-4 py-3 w-32 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono font-bold text-terminal-green">
                    {formData.line_items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-terminal-green/50 uppercase"
                        >
                          [ No Line Items Detected ]
                        </td>
                      </tr>
                    ) : (
                      formData.line_items.map((li, idx) => (
                        <tr key={idx} className="border-b border-[#333]">
                          <td className="px-4 py-3 font-mono">
                            {li.description}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {li.quantity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {li.unit_price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {li.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <div
                className={`w-72 bg-terminal-bg border-2 p-4 space-y-3 font-mono transition-colors duration-300 ${errors.some((e) => e.includes("Math Error")) ? "border-terminal-red bg-terminal-red/10" : "border-terminal-green"}`}
              >
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-terminal-green/70 font-mono uppercase">
                    Subtotal
                  </span>
                  <span>
                    {getCurrencySymbol(currency)}
                    <input
                      type="number"
                      step="0.01"
                      value={formData.subtotal}
                      onChange={(e) =>
                        setFormData({ ...formData, subtotal: e.target.value })
                      }
                      className="w-24 text-right border-b border-terminal-green outline-none bg-transparent focus:border-terminal-amber text-terminal-green"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-terminal-green/70 font-mono uppercase">
                    Discount
                  </span>
                  <span>
                    {getCurrencySymbol(currency)}
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount}
                      onChange={(e) =>
                        setFormData({ ...formData, discount: e.target.value })
                      }
                      className="w-24 text-right border-b border-terminal-green outline-none bg-transparent focus:border-terminal-amber text-terminal-green"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-terminal-green/70 font-mono uppercase">
                    Tax
                  </span>
                  <span>
                    {getCurrencySymbol(currency)}
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax}
                      onChange={(e) =>
                        setFormData({ ...formData, tax: e.target.value })
                      }
                      className="w-24 text-right border-b border-terminal-green outline-none bg-transparent focus:border-terminal-amber text-terminal-green"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold border-b border-[#333] pb-2 mb-2">
                  <span className="text-terminal-green/70 font-mono uppercase">
                    Shipping
                  </span>
                  <span>
                    {getCurrencySymbol(currency)}
                    <input
                      type="number"
                      step="0.01"
                      value={formData.shipping}
                      onChange={(e) =>
                        setFormData({ ...formData, shipping: e.target.value })
                      }
                      className="w-24 text-right border-b border-terminal-green outline-none bg-transparent focus:border-terminal-amber text-terminal-green"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-xl font-black pt-2 border-t-2 border-terminal-green mt-2">
                  <span className="uppercase tracking-tighter">Total</span>
                  <span
                    className={`${errors.some((e) => e.includes("Math Error")) ? "text-terminal-red" : "text-terminal-cyan"}`}
                  >
                    {getCurrencySymbol(currency)}
                    {formData.total}
                  </span>
                </div>
                {/* Payment Tracking Display */}
                {paidAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm font-bold pt-2 border-t-2 border-[#333] mt-2">
                      <span className="text-terminal-cyan/80 font-mono uppercase">
                        Amount Paid
                      </span>
                      <span className="text-terminal-cyan/80">
                        -{getCurrencySymbol(currency)}
                        {paidAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-black pt-2 border-t-2 border-terminal-cyan mt-2">
                      <span className="uppercase tracking-tighter text-terminal-cyan">
                        Balance Due
                      </span>
                      <span className="text-terminal-cyan">
                        {getCurrencySymbol(currency)}
                        {Math.max(
                          0,
                          parseFloat(formData.total) - paidAmount,
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-terminal-bg border-2 border-terminal-green p-6 w-[400px] shadow-[0_0_30px_rgba(0,255,136,0.2)]">
            <div className="flex justify-between items-center mb-6 pb-2 border-b-2 border-terminal-green">
              <h2 className="text-xl font-bold text-terminal-green flex items-center gap-2">
                <DollarSign size={24} /> RECORD AP PAYMENT
              </h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-terminal-green hover:text-terminal-amber"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 font-mono">
              <div className="flex justify-between text-sm">
                <span className="text-terminal-green/70">Total Invoice:</span>
                <span className="font-bold text-terminal-green">
                  {getCurrencySymbol(currency)}
                  {formData.total}
                </span>
              </div>
              <div className="flex justify-between text-sm border-b border-[#333] pb-2">
                <span className="text-terminal-cyan/70">Previously Paid:</span>
                <span className="font-bold text-terminal-cyan">
                  {getCurrencySymbol(currency)}
                  {paidAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-black pt-2">
                <span className="text-terminal-amber">Remaining Balance:</span>
                <span className="text-terminal-amber">
                  {getCurrencySymbol(currency)}
                  {Math.max(0, parseFloat(formData.total) - paidAmount).toFixed(
                    2,
                  )}
                </span>
              </div>

              <div className="pt-6">
                <label className="text-xs font-bold uppercase tracking-wider text-terminal-green/70 mb-2 block">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-green font-bold text-xl">
                    {getCurrencySymbol(currency)}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(parseFloat(formData.total) - paidAmount).toFixed(2)}
                    value={paymentAmountStr}
                    onChange={(e) => setPaymentAmountStr(e.target.value)}
                    className="pl-8 font-mono text-xl h-14 bg-black/50 border-2 border-terminal-green text-terminal-green focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan transition-all placeholder:text-terminal-green/20"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t-2 border-terminal-green">
              <Button
                variant="outline"
                className="bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green hover:text-black"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                CANCEL
              </Button>
              <Button
                className="bg-terminal-green text-black hover:bg-terminal-green/80 font-bold"
                onClick={() => handleAction("SUBMIT_PAYMENT")}
                disabled={
                  !paymentAmountStr ||
                  parseFloat(paymentAmountStr) <= 0 ||
                  parseFloat(paymentAmountStr) >
                    parseFloat(formData.total) - paidAmount + 0.01
                }
              >
                SUBMIT PAYMENT
              </Button>
            </div>
          </div>
        </div>
      )}      {/* Conversion Modal */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-terminal-bg border-2 border-terminal-cyan p-6 w-[400px] shadow-[0_0_30px_rgba(0,255,136,0.2)]">
            <div className="flex justify-between items-center mb-6 pb-2 border-b-2 border-terminal-cyan">
              <h2 className="text-xl font-bold text-terminal-cyan flex items-center gap-2">
                <RefreshCw size={24} /> CONVERT TO RECEIVABLE
              </h2>
              <button
                onClick={() => setIsConvertModalOpen(false)}
                className="text-terminal-cyan hover:text-terminal-amber"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-xs text-terminal-cyan/60 mb-6 font-mono leading-relaxed">
              WARNING: This will re-classify this document as an Account Receivable. 
              The current vendor invoice record will be deleted and replaced with a sales invoice.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-terminal-cyan/70 mb-2 block">
                  Assign to Customer
                </label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-12 bg-black border-2 border-terminal-cyan text-terminal-cyan font-bold p-2 outline-none"
                >
                  <option value="">SELECT_CUSTOMER...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t-2 border-terminal-cyan">
              <Button
                variant="outline"
                className="bg-transparent text-terminal-cyan border-terminal-cyan hover:bg-terminal-cyan hover:text-black"
                onClick={() => setIsConvertModalOpen(false)}
              >
                CANCEL
              </Button>
              <Button
                className="bg-terminal-cyan text-black hover:bg-terminal-cyan/80 font-bold"
                onClick={() => handleAction("CONVERT_RECEIVABLE")}
                disabled={!selectedCustomerId || isConverting}
              >
                {isConverting ? "CONVERTING..." : "CONFIRM CONVERSION"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Converter — appears after invoice is reviewed */}
      <div className="px-8 py-6 border-t-2 border-terminal-green bg-terminal-panel mx-0">
        <CurrencyConverter
          amount={parseFloat(formData.total) || 0}
          fromCurrency={currency}
        />
      </div>
    </div>
  );
}
// ─── Helpers ───────────────────────────────────────────────────────────────

function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    GBP: "£",
    EUR: "€",
    AED: "AED ",
    INR: "₹",
    CAD: "CA$",
    AUD: "A$",
    JPY: "¥",
    CHF: "CHF ",
  };
  return symbols[code?.toUpperCase()] ?? code + " ";
}

// ─── Currency Converter ─────────────────────────────────────────────────────

function CurrencyConverter({
  amount,
  fromCurrency,
}: {
  amount: number;
  fromCurrency: string;
}) {
  const TARGET_CURRENCIES = ["USD", "GBP", "AED"];
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fromCurrency) return;
    setLoading(true);
    setError("");
    fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.result === "success") {
          setRates(data.rates);
        } else {
          setError("Could not fetch live rates.");
        }
      })
      .catch(() => setError("Network error fetching exchange rates."))
      .finally(() => setLoading(false));
  }, [fromCurrency]);

  const displayCurrencies = TARGET_CURRENCIES.filter(
    (c) => c.toUpperCase() !== fromCurrency?.toUpperCase(),
  );

  return (
    <div>
      <h3 className="text-lg font-bold uppercase border-b-2 border-terminal-green pb-2 mb-4 flex items-center gap-2 text-terminal-green">
        <span>💱</span> Currency Converter
        <span className="text-xs text-terminal-green/50 font-normal normal-case ml-auto">
          Live rates · open.er-api.com
        </span>
      </h3>
      <p className="text-sm text-terminal-green/70 mb-4 font-medium">
        Invoice amount:{" "}
        <span className="font-black text-terminal-cyan">
          {getCurrencySymbol(fromCurrency)}
          {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
          {fromCurrency}
        </span>
      </p>

      {loading && (
        <p className="text-sm text-terminal-amber animate-pulse">
          Fetching live exchange rates…
        </p>
      )}
      {error && <p className="text-sm text-terminal-red font-bold">{error}</p>}

      {rates && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayCurrencies.map((toCurrency) => {
            const rate = rates[toCurrency];
            if (!rate) return null;
            const converted = amount * rate;
            return (
              <div
                key={toCurrency}
                className="border-2 border-terminal-green p-4 bg-transparent flex flex-col gap-1 rounded-none text-terminal-green"
              >
                <div className="text-xs font-bold uppercase text-terminal-green/70 tracking-widest">
                  {toCurrency}
                </div>
                <div className="text-2xl font-black text-terminal-cyan">
                  {getCurrencySymbol(toCurrency)}
                  {converted.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-terminal-green/50 font-mono">
                  1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
