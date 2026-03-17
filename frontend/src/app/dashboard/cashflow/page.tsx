"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  CheckCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  AlertTriangle,
  Lightbulb,
  Info,
  Calendar,
  Download,
  Share2,
  FileText,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useSettings } from "@/hooks/use-settings";

interface ForecastData {
  current_balance: number;
  forecast_30d: {
    projected_balance: number;
    inflows: number;
    outflows: number;
  };
  forecast_60d: {
    projected_balance: number;
    inflows: number;
    outflows: number;
  };
  forecast_90d: {
    projected_balance: number;
    inflows: number;
    outflows: number;
  };
  ai_insights: string;
  smart_alerts: { type: string; message: string }[];
  confidence_score: number;
  chart_data: {
    date: string;
    balance: number;
    best_case: number;
    worst_case: number;
    type: string;
    inflows: number;
    outflows: number;
    net_change: number;
  }[];
  waterfall_data: {
    label: string;
    amount: number;
    type: "total" | "inflow" | "outflow";
  }[];
  upcoming_payables: any[];
  upcoming_receivables: {
    id: number;
    customer: string;
    invoice_number: string;
    amount: number;
    expected_amount: number;
    probability: number;
    due_date: string;
    customer_id: number;
  }[];
  recurring_monthly_obligation: number;
  subscription_monthly: number;
  analytics: {
    monthly_burn_rate: number;
    prev_burn_rate: number;
    burn_trend_pct: number;
    burn_trend_direction: string;
    runway_months: number;
    total_outstanding_ar: number;
    total_outstanding_ap: number;
    overdue_ar: number;
    ar_aging_risk_pct: number;
    net_cash_flow_30d: number;
    net_cash_flow_60d: number;
    net_cash_flow_90d: number;
    working_capital_ratio: number;
    fixed_cost_coverage_months: number;
    subscription_monthly: number;
    active_subscriptions: number;
    total_fixed_monthly: number;
    top_customer_name: string;
    top_customer_pct: number;
    customer_concentration: { name: string; amount: number; percentage: number }[];
    hist_top_inflow_name: string;
    hist_top_inflow_pct: number;
    actual_inflow_concentration: { name: string; amount: number; percentage: number }[];
    category_breakdown: { label: string; amount: number; percentage: number }[];
    vendor_trend_pct: number;
    forecast_accuracy: {
      score: number;
      forecasted_total: number;
      actual_total: number;
      drivers: {
        category: string;
        impact: string;
        amount: number;
        message: string;
      }[];
    };
    health_score: number;
    risk_flags: { severity: string; message: string }[];
    working_capital: {
      dso: number;
      dpo: number;
      ccc: number;
      dso_trend: string;
      dpo_trend: string;
      ccc_trend: string;
    };
  };
  recent_transactions: {
    id: number;
    date: string;
    amount: number;
    description: string;
    type: string;
    reference: string;
  }[];
  variance_amount: number;
  variance_pct: number;
  sparkline_data: number[];
  bank_balance: number;
  ledger_balance: number;
  reconciliation_variance: number;
}

function Sparkline({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasRef.current;
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={40}
      className="w-[120px] h-[40px] opacity-80"
    />
  );
}

export default function CashFlowPage() {
  const { settings } = useSettings();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [hoverState, setHoverState] = useState<{
    idx: number;
    x: number;
    y: number;
  } | null>(null);

  // Scenario & Range State
  const [revenueMultiplier, setRevenueMultiplier] = useState(1.0);
  const [paymentDelay, setPaymentDelay] = useState(0);
  const [cashCushion, setCashCushion] = useState(50000);
  const [dateRange, setDateRange] = useState<"2W" | "1M" | "Q" | "Custom">("Q");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = async () => {
    try {
      if (!data) setLoading(true);
      
      let endDate = "";
      const now = new Date();
      if (dateRange === "2W") {
        const d = new Date();
        d.setDate(now.getDate() + 14);
        endDate = d.toISOString();
      } else if (dateRange === "1M") {
        const d = new Date();
        d.setMonth(now.getMonth() + 1);
        endDate = d.toISOString();
      } else if (dateRange === "Q") {
        const d = new Date();
        d.setMonth(now.getMonth() + 3);
        endDate = d.toISOString();
      } else if (dateRange === "Custom" && customEndDate) {
        endDate = new Date(customEndDate).toISOString();
      }

      const response = await api.get(
        `/cashflow/forecast${endDate ? `?end_date=${endDate}` : ""}`,
      );
      setData(response.data);
      setLoading(false);

      // Fetch Slow AI Advice separately without blocking
      api.get("/cashflow/strategic-advice").then(adviceRes => {
          setData((prev: any) => ({
              ...prev,
              ai_insights: adviceRes.data.advice
          }));
      }).catch(err => console.error("AI Advice fetch failed:", err));

    } catch (error) {
      showToast("Failed to fetch forecast data", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, customEndDate]);

  // Computed Scenario Data
  const scenarioData = useMemo(() => {
    if (!data) return [];

    const base = data.chart_data.map((d) => ({
      ...d,
      scenario_balance: d.balance,
    }));
    if (revenueMultiplier === 1.0 && paymentDelay === 0) return base;

    // Backend provides CUMULATIVE inflows/outflows per point.
    // We must calculate deltas (per-step changes) to apply modifiers correctly.
    const inDeltas = data.chart_data.map((d, i) =>
      i === 0 ? d.inflows : d.inflows - data.chart_data[i - 1].inflows,
    );
    const outDeltas = data.chart_data.map((d, i) =>
      i === 0 ? d.outflows : d.outflows - data.chart_data[i - 1].outflows,
    );

    const shiftedOutDeltas = new Array(outDeltas.length).fill(0);
    const shiftSteps = Math.floor(paymentDelay / 3); // 3 days per data point

    outDeltas.forEach((val, i) => {
      if (i + shiftSteps < outDeltas.length) {
        shiftedOutDeltas[i + shiftSteps] += val;
      }
    });

    let runningIn = 0;
    let runningOut = 0;
    return base.map((d, i) => {
      runningIn += inDeltas[i] * revenueMultiplier;
      runningOut += paymentDelay > 0 ? shiftedOutDeltas[i] : outDeltas[i];
      return {
        ...d,
        scenario_balance: data.current_balance + runningIn - runningOut,
      };
    });
  }, [data, revenueMultiplier, paymentDelay]);

  // Breach & Gap Analysis
  const cushionMetrics = useMemo(() => {
    if (!scenarioData.length) return { breachDays: null, gap: 0 };

    let firstBreachIdx = -1;
    let maxGap = 0;

    scenarioData.forEach((d, i) => {
      const shortfall = cashCushion - d.scenario_balance;
      if (shortfall > 0) {
        if (firstBreachIdx === -1) firstBreachIdx = i;
        if (shortfall > maxGap) maxGap = shortfall;
      }
    });

    return {
      breachDays: firstBreachIdx === -1 ? null : firstBreachIdx * 3, // Each point is 3 days
      gap: maxGap,
    };
  }, [scenarioData, cashCushion]);

  // Drill-down State
  const [expandedPayable, setExpandedPayable] = useState<number | null>(null);
  const [expandedReceivable, setExpandedReceivable] = useState<number | null>(
    null,
  );

  const handleExportPDF = async () => {
    if (!data) return;
    setIsExporting(true);
    // Slight delay to ensure UI updates for export state
    setTimeout(async () => {
      try {
        const element = document.getElementById("dashboard-content");
        if (!element) return;
        const canvas = await html2canvas(element, {
          backgroundColor: "#000000",
          scale: 2,
          logging: false,
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(
          `GHOST_FINANCE_REPORT_${new Date().toISOString().split("T")[0]}.pdf`,
        );
        showToast("Dashboard exported successfully", "success");
      } catch (err) {
        showToast("Export failed", "error");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/cashflow/${Math.random().toString(36).substring(7)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("Public view-only link copied!", "success");
  };

  // Handle canvas hover logic
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || !chartRef.current) return;
    const canvas = chartRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padding = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = rect.width - padding.left - padding.right;

    let rawIdx = ((x - padding.left) / chartW) * (data.chart_data.length - 1);
    let idx = Math.round(rawIdx);

    if (idx < 0) idx = 0;
    if (idx >= data.chart_data.length) idx = data.chart_data.length - 1;

    // Only show hover if cursor is inside the chart area
    if (x >= padding.left - 20 && x <= rect.width - padding.right + 20) {
      setHoverState({ idx, x, y: e.clientY - rect.top });
    } else {
      setHoverState(null);
    }
  };

  // Draw chart on canvas
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const canvas = chartRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    if (data.chart_data.length < 2 || scenarioData.length < 2) return;

    const values = data.chart_data.flatMap((d, i) => [
      d.balance,
      d.best_case,
      d.worst_case,
      scenarioData[i]?.scenario_balance || d.balance,
    ]);
    values.push(cashCushion);

    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 100) * 1.1; // 10% headroom
    const valRange = maxVal - minVal || 1;

    const toX = (i: number) =>
      padding.left + (i / (data.chart_data.length - 1)) * chartW;
    const toY = (v: number) =>
      padding.top + chartH - ((v - minVal) / valRange) * chartH;

    // Grid lines
    ctx.strokeStyle = "rgba(0,255,136,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxVal - (i / 4) * valRange;
      ctx.fillStyle = "rgba(0,255,136,0.4)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      const formattedY = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: settings?.base_currency || "USD",
        maximumFractionDigits: 0,
        notation: val >= 1000 ? "compact" : "standard",
      }).format(val);

      ctx.fillText(formattedY, padding.left - 8, y + 4);
    }

    // X-axis labels
    ctx.fillStyle = "rgba(0,255,136,0.4)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const labelInterval = Math.max(1, Math.floor(data.chart_data.length / 6));
    data.chart_data.forEach((d, i) => {
      if (i % labelInterval === 0 || i === data.chart_data.length - 1) {
        const dateStr = new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        ctx.fillText(dateStr, toX(i), h - padding.bottom + 20);
      }
    });

    // Confidence Band Area fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data.chart_data[0].balance));
    data.chart_data.forEach((d, i) => {
      ctx.lineTo(toX(i), toY(d.best_case));
    });
    for (let i = data.chart_data.length - 1; i >= 0; i--) {
      ctx.lineTo(toX(i), toY(data.chart_data[i].worst_case));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 136, 0.05)";
    ctx.fill();

    // Cushion Line (Amber)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 170, 0, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const cushionY = toY(cashCushion);
    ctx.moveTo(padding.left, cushionY);
    ctx.lineTo(w - padding.right, cushionY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 170, 0, 0.6)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SAFETY THRESHOLD", padding.left + 5, cushionY - 5);
    ctx.setLineDash([]);

    // Line (Baseline)
    ctx.beginPath();
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    const firstProjectedIdx = data.chart_data.findIndex(
      (d) => d.type === "projected",
    );

    data.chart_data.forEach((d, i) => {
      if (i === firstProjectedIdx && firstProjectedIdx > 0) {
        ctx.stroke();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.moveTo(toX(i - 1), toY(data.chart_data[i - 1].balance));
      }
      if (i === 0) {
        ctx.moveTo(toX(i), toY(d.balance));
      } else {
        ctx.lineTo(toX(i), toY(d.balance));
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Scenario Line (Cyan)
    if (revenueMultiplier !== 1.0 || paymentDelay > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#00ffff"; // Cyan for scenario
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      scenarioData.forEach((d, i) => {
        if (i === 0) ctx.moveTo(toX(i), toY(d.scenario_balance));
        else ctx.lineTo(toX(i), toY(d.scenario_balance));
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Breach Marker (only if scenario is active)
      if (cushionMetrics.breachDays !== null) {
        const breachIdx = Math.round(cushionMetrics.breachDays / 3);
        if (breachIdx >= 0 && breachIdx < scenarioData.length) {
          const bx = toX(breachIdx);
          const by = toY(scenarioData[breachIdx].scenario_balance);

          ctx.beginPath();
          ctx.fillStyle = "#ffaa00";
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#ffaa00";
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Current balance dot
    ctx.beginPath();
    ctx.fillStyle = "#00ff88";
    ctx.arc(toX(0), toY(data.chart_data[0].balance), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(toX(0), toY(data.chart_data[0].balance), 2, 0, Math.PI * 2);
    ctx.fill();

    // Hover crosshair and highlight
    if (hoverState !== null && data.chart_data[hoverState.idx]) {
      const idx = hoverState.idx;
      const hx = toX(idx);
      const hy = toY(data.chart_data[idx].balance);

      // Vertical line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(0,255,136,0.4)";
      ctx.lineWidth = 1;
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, h - padding.bottom);
      ctx.stroke();

      // Hover Highlight dot (Baseline)
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.fillStyle = "#0a0a0a";
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 3;
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Whenever scenario sliders change, redraw chart
  }, [
    data,
    hoverState,
    revenueMultiplier,
    paymentDelay,
    scenarioData,
    cashCushion,
    cushionMetrics,
  ]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-terminal-green font-mono font-bold uppercase tracking-widest animate-pulse flex items-center gap-3">
          <Brain size={24} className="animate-spin" />
          Synchronizing Neural Core...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono pb-12" id="dashboard-content">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black p-6 border-2 border-terminal-green gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <Brain size={28} className="text-terminal-cyan animate-pulse" />
            Predictive Liquidity Hub
          </h1>
          <p className="text-terminal-green/60 uppercase tracking-widest text-[10px] mt-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-terminal-green animate-ping rounded-full" />
            Neural Forecasting Engine Active | {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <div className="flex border border-terminal-green/30 bg-black/50 p-1">
              {(["2W", "1M", "Q", "Custom"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${
                    dateRange === r
                      ? "bg-terminal-green text-black"
                      : "text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/10"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {dateRange === "Custom" && (
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-black border border-terminal-green/30 text-terminal-green text-[10px] px-2 py-1 focus:outline-none focus:border-terminal-green"
              />
            )}
          </div>

          <div className="h-8 w-[1px] bg-terminal-green/20 mx-2 hidden md:block" />

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 border-2 border-terminal-cyan px-4 py-2 text-xs font-bold uppercase text-terminal-cyan hover:bg-terminal-cyan hover:text-black transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Download size={14} />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 border-2 border-terminal-amber px-4 py-2 text-xs font-bold uppercase text-terminal-amber hover:bg-terminal-amber hover:text-black transition-all"
          >
            <Share2 size={14} />
            Share View
          </button>
        </div>
      </div>

      {/* Smart Alerts Strip */}
      {data?.smart_alerts && data.smart_alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.smart_alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-4 border-2 ${
                alert.type === "critical"
                  ? "border-terminal-red/50 bg-terminal-red/10 text-terminal-red"
                  : alert.type === "warning"
                    ? "border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber"
                    : "border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan"
              }`}
            >
              <div className="mt-0.5">
                {alert.type === "critical" ? (
                  <AlertTriangle size={16} />
                ) : alert.type === "warning" ? (
                  <AlertTriangle size={16} />
                ) : (
                  <Lightbulb size={16} />
                )}
              </div>
              <div>
                <div className="font-bold uppercase tracking-widest text-xs mb-1">
                  {alert.type} Alert
                </div>
                <div className="text-sm opacity-90">{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Balance + Forecast Cards */}
      {!data ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 h-48 border-2 border-terminal-green/20 bg-black animate-pulse flex items-center justify-center">
            <span className="text-[10px] text-terminal-green/30 uppercase font-mono tracking-widest">Hydrating Liquidity Position...</span>
          </div>
          {[1,2,3].map(i => (
             <div key={i} className="h-48 border-2 border-terminal-green/10 bg-black animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Hero Balance Card */}
        <div className="md:col-span-2 border-2 border-terminal-green bg-black p-8 flex justify-between items-center group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
            <Sparkline data={data.sparkline_data} />
          </div>

          <div className="w-full">
            <div className="text-terminal-green/60 uppercase text-[10px] tracking-[0.3em] mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-terminal-green" />
              Current Liquidity Position
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex items-baseline gap-4">
                <div className="text-6xl font-black text-terminal-green tracking-tighter">
                  <CurrencyDisplay amount={data.ledger_balance} />
                </div>
                <div className="text-[10px] text-terminal-green/60 font-bold uppercase pb-1 flex flex-col">
                    <span>Ledger Balance</span>
                    <span className="text-[8px] opacity-50">SOURCE_OF_TRUTH</span>
                </div>
              </div>

              <div className="flex flex-col mb-1 border-l border-terminal-green/20 pl-6">
                <div className="text-[9px] text-terminal-green/40 uppercase font-black mb-0.5">Bank Statement</div>
                <div className="text-xl font-black text-white/90 tracking-tighter">
                  <CurrencyDisplay amount={data.bank_balance} />
                </div>
                <div className={`text-[10px] font-bold uppercase flex items-center gap-1 mt-1 ${Math.abs(data.reconciliation_variance) < 0.01 ? "text-terminal-green" : "text-terminal-amber animate-pulse"}`}>
                    {Math.abs(data.reconciliation_variance) < 0.01 ? (
                        <CheckCircle size={10} />
                    ) : (
                        <AlertTriangle size={10} />
                    )}
                    {Math.abs(data.reconciliation_variance) < 0.01 ? "RECONCILED" : `FLOAT: ${formatCurrency(Math.abs(data.reconciliation_variance))}`}
                </div>
              </div>

              <div className="hidden lg:flex flex-col mb-2 ml-auto text-right">
                <div
                  className={`text-sm font-bold flex items-center justify-end gap-1 ${data.variance_amount >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
                >
                  {data.variance_amount >= 0 ? (
                    <ArrowUpRight size={18} />
                  ) : (
                    <ArrowDownRight size={18} />
                  )}
                  {formatCurrency(Math.abs(data.variance_amount))}
                </div>
                <div
                  className={`text-[10px] font-bold uppercase tracking-tighter ${data.variance_amount >= 0 ? "text-terminal-green/60" : "text-terminal-red/60"}`}
                >
                  {data.variance_amount >= 0 ? "+" : "-"}
                  {Math.abs(data.variance_pct)}% vs Last 30d
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 30d */}
        <ForecastCard
          label="30-Day Forecast"
          forecast={data.forecast_30d}
          currentBalance={data.current_balance}
          confidenceScore={data.confidence_score}
          varianceAmt={Math.max(
            0,
            (data.chart_data[10]?.best_case || 0) -
              (data.chart_data[10]?.balance || 0),
          )}
        />
        {/* 60d */}
        <ForecastCard
          label="60-Day Forecast"
          forecast={data.forecast_60d}
          currentBalance={data.current_balance}
          confidenceScore={data.confidence_score}
          varianceAmt={Math.max(
            0,
            (data.chart_data[20]?.best_case || 0) -
              (data.chart_data[20]?.balance || 0),
          )}
        />
        {/* 90d */}
        <ForecastCard
          label="90-Day Forecast"
          forecast={data.forecast_90d}
          currentBalance={data.current_balance}
          confidenceScore={data.confidence_score}
          varianceAmt={Math.max(
            0,
            (data.chart_data[30]?.best_case || 0) -
              (data.chart_data[30]?.balance || 0),
          )}
        />
      </div>

      {/* Scenario Planning Controls */}
      {!data ? (
        <div className="h-20 border-2 border-terminal-green/10 bg-black animate-pulse" />
      ) : (
        <div className="border-2 border-terminal-green bg-black p-4 flex gap-8 items-center">
          <div className="flex items-center gap-2 text-terminal-green uppercase tracking-widest text-sm font-bold min-w-[200px]">
            <TrendingUp size={16} /> What-If Scenarios
          </div>

          <div className="flex-1 max-w-sm">
            <label className="flex justify-between text-xs text-terminal-green/70 uppercase tracking-widest mb-2">
              <span>Revenue Impact</span>
              <span>{Math.round((revenueMultiplier - 1) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={revenueMultiplier}
              onChange={(e) => setRevenueMultiplier(parseFloat(e.target.value))}
              className="w-full h-1 bg-terminal-green/30 rounded-lg appearance-none cursor-pointer accent-terminal-cyan"
            />
          </div>

          <div className="flex-1 max-w-sm">
            <label className="flex justify-between text-xs text-terminal-green/70 uppercase tracking-widest mb-2">
              <span>Global Payment Delay</span>
              <span>+{paymentDelay} Days</span>
            </label>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={paymentDelay}
              onChange={(e) => setPaymentDelay(parseInt(e.target.value))}
              className="w-full h-1 bg-terminal-green/30 rounded-lg appearance-none cursor-pointer accent-terminal-amber"
            />
          </div>

          <div className="flex-1 max-w-sm">
            <label className="flex justify-between text-xs text-terminal-green/70 uppercase tracking-widest mb-2">
              <span>Min Safe Balance</span>
              <span>{formatCurrency(cashCushion)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="200000"
              step="5000"
              value={cashCushion}
              onChange={(e) => setCashCushion(parseInt(e.target.value))}
              className="w-full h-1 bg-terminal-green/30 rounded-lg appearance-none cursor-pointer accent-terminal-amber"
            />
          </div>

          {(revenueMultiplier !== 1.0 ||
            paymentDelay > 0 ||
            cashCushion !== 50000) && (
            <button
              onClick={() => {
                setRevenueMultiplier(1.0);
                setPaymentDelay(0);
                setCashCushion(50000);
              }}
              className="px-3 py-1 border border-terminal-red text-terminal-red text-[10px] uppercase font-bold hover:bg-terminal-red hover:text-black transition-colors"
            >
              Reset Scenarios
            </button>
          )}
        </div>
      )}

      {/* Liquidity Guard Banner */}
      {cushionMetrics.breachDays !== null && (
        <div className="bg-terminal-amber/10 border-2 border-terminal-amber p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border-2 border-terminal-amber flex items-center justify-center text-terminal-amber">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-terminal-amber uppercase tracking-widest">
                Liquidity Breach Imminent
              </div>
              <div className="text-xl font-black text-terminal-amber">
                {cushionMetrics.breachDays === 0
                  ? "TODAY"
                  : `${cushionMetrics.breachDays} DAYS UNTIL BREACH`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-terminal-amber/60 uppercase tracking-widest">
              Capital Required to Maintain Cushion
            </div>
            <div className="text-lg font-bold text-terminal-amber">
              NEED {formatCurrency(cushionMetrics.gap)} MORE
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative border-2 border-terminal-green bg-black p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green mb-4 flex items-center gap-2">
          <TrendingUp size={16} /> Balance Trajectory — 90 Day Projection
          <span className="text-terminal-green/40 text-[10px] ml-auto font-normal flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-terminal-green inline-block" />{" "}
              Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-terminal-green inline-block border-dashed border-t border-terminal-green" />{" "}
              Projected
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 border-dashed border-t border-terminal-amber inline-block" />{" "}
              Cushion
            </span>
          </span>
        </h2>

        <canvas
          ref={chartRef}
          className="w-full cursor-crosshair"
          style={{ height: "280px" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverState(null)}
        />

        {/* Dynamic Tooltip */}
        {hoverState !== null && data.chart_data[hoverState.idx] && (
          <div
            className="absolute z-10 bg-black border border-terminal-green p-3 shadow-[0_0_15px_rgba(0,255,136,0.15)] text-xs min-w-[200px]"
            style={{
              left: hoverState.x > 500 ? hoverState.x - 220 : hoverState.x + 80,
              top: Math.max(80, hoverState.y - 60),
              pointerEvents: "none",
            }}
          >
            <div className="text-terminal-green/60 uppercase tracking-widest mb-2 border-b border-terminal-green/30 pb-1">
              {new Date(
                data.chart_data[hoverState.idx].date,
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
              <span className="float-right">
                {data.chart_data[hoverState.idx].type === "actual"
                  ? "ACTUAL"
                  : "PROJ"}
              </span>
            </div>

            <div className="flex justify-between items-center mb-1">
              <span className="text-terminal-green/60 uppercase text-[10px]">
                Proj. Balance
              </span>
              <span className="font-bold text-terminal-green">
                {formatCurrency(data.chart_data[hoverState.idx].balance)}
              </span>
            </div>

            {(revenueMultiplier !== 1.0 || paymentDelay > 0) && (
              <div className="flex justify-between items-center mb-1 border-t border-terminal-cyan/20 pt-1">
                <span className="text-terminal-cyan/60 uppercase text-[10px]">
                  Scenario Bal.
                </span>
                <span className="font-bold text-terminal-cyan">
                  {formatCurrency(
                    scenarioData[hoverState.idx].scenario_balance,
                  )}
                </span>
              </div>
            )}

            {data.chart_data[hoverState.idx].inflows > 0 && (
              <div className="flex justify-between items-center text-terminal-cyan mt-2">
                <span>+ Incoming</span>
                <span>
                  {formatCurrency(data.chart_data[hoverState.idx].inflows)}
                </span>
              </div>
            )}

            {data.chart_data[hoverState.idx].outflows > 0 && (
              <div className="flex justify-between items-center text-terminal-red">
                <span>- Outgoing</span>
                <span>
                  {formatCurrency(data.chart_data[hoverState.idx].outflows)}
                </span>
              </div>
            )}

            {(data.chart_data[hoverState.idx].inflows > 0 ||
              data.chart_data[hoverState.idx].outflows > 0) && (
              <div
                className={`flex justify-between items-center mt-2 pt-1 border-t ${data.chart_data[hoverState.idx].net_change >= 0 ? "border-terminal-cyan/30 text-terminal-cyan" : "border-terminal-red/30 text-terminal-red"}`}
              >
                <span className="uppercase text-[10px]">Net Change</span>
                <span className="font-bold">
                  {data.chart_data[hoverState.idx].net_change >= 0 ? "+" : ""}
                  {formatCurrency(data.chart_data[hoverState.idx].net_change)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Waterfall Chart Section */}
      <div className="border-2 border-terminal-green bg-black p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green mb-6 flex items-center gap-2">
          <TrendingUp size={16} /> 30-Day Cash Flow Bridge (Waterfall)
        </h2>
        {data ? (
          <WaterfallChart data={data.waterfall_data} />
        ) : (
          <div className="h-64 bg-terminal-green/5 animate-pulse" />
        )}
      </div>

      {/* Advanced Analytics */}
      <div className="grid grid-cols-4 gap-4">
        {/* Burn Rate */}
        <div className="border-2 border-terminal-cyan/50 bg-black p-5 relative group">
          <div className="text-terminal-cyan/60 uppercase text-[10px] tracking-widest mb-2 flex justify-between items-center">
            <span>Historical Burn Rate</span>
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-terminal-cyan text-black text-[10px] font-bold z-10">
              Total cash outflows over the last 30 days. Used to estimate how
              much cash the business consumes monthly.
            </div>
          </div>
          <div className="text-terminal-cyan text-2xl font-black">
            {formatCurrency(data.analytics.monthly_burn_rate)}
            <span className="text-xs font-normal text-terminal-cyan/50 ml-1">
              /mo
            </span>
          </div>
        </div>

        {/* Runway */}
        <div className="border-2 border-terminal-cyan/50 bg-black p-5 relative group">
          <div className="text-terminal-cyan/60 uppercase text-[10px] tracking-widest mb-2 flex justify-between items-center">
            <span>Zero-Revenue Runway</span>
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-terminal-cyan text-black text-[10px] font-bold z-10">
              How many months the current cash balance will last at the
              historical burn rate, assuming absolutely no new cash comes in.
            </div>
          </div>
          <div
            className={`text-2xl font-black ${data.analytics.runway_months < 3 ? "text-terminal-red" : data.analytics.runway_months < 6 ? "text-terminal-amber" : "text-terminal-cyan"}`}
          >
            {data.analytics.runway_months > 99
              ? "99+"
              : data.analytics.runway_months.toFixed(1)}
            <span className="text-xs font-normal opacity-50 ml-1">months</span>
          </div>
        </div>

        {/* Total AR */}
        <div className="border-2 border-terminal-cyan/50 bg-black p-5 relative group">
          <div className="text-terminal-cyan/60 uppercase text-[10px] tracking-widest mb-2 flex justify-between items-center">
            <span>Outstanding A/R</span>
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-terminal-cyan text-black text-[10px] font-bold z-10">
              Total value of all unpaid invoices currently awaiting payment from
              customers.
            </div>
          </div>
          <div className="text-terminal-cyan text-2xl font-black">
            {formatCurrency(data.analytics.total_outstanding_ar)}
          </div>
        </div>

        {/* AR Risk */}
        <div className="border-2 border-terminal-cyan/50 bg-black p-5 relative group">
          <div className="text-terminal-cyan/60 uppercase text-[10px] tracking-widest mb-2 flex justify-between items-center">
            <span>A/R Aging Risk</span>
            <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 w-48 p-2 bg-terminal-cyan text-black text-[10px] font-bold z-10">
              Percentage of outstanding Accounts Receivable that is past due.
              Higher percentage means higher risk of non-payment.
            </div>
          </div>
          <div
            className={`text-2xl font-black ${data.analytics.ar_aging_risk_pct > 20 ? "text-terminal-red" : data.analytics.ar_aging_risk_pct > 0 ? "text-terminal-amber" : "text-terminal-cyan"}`}
          >
            {data.analytics.ar_aging_risk_pct}%
          </div>
          <div className="text-[10px] mt-1 text-terminal-cyan/60">
            {formatCurrency(data.analytics.overdue_ar)} overdue
          </div>
        </div>
      </div>

      {/* Health Score + Risk Flags + Computed Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="border-2 border-terminal-green bg-black p-6 flex flex-col items-center justify-center">
          <div className="text-[10px] text-terminal-green/60 uppercase tracking-widest mb-3">
            Cash Flow Health
          </div>
          <div
            className={`text-5xl font-black ${
              data.analytics.health_score >= 70
                ? "text-terminal-green"
                : data.analytics.health_score >= 40
                  ? "text-terminal-amber"
                  : "text-terminal-red"
            }`}
          >
            {data.analytics.health_score}
          </div>
          <div className="text-[10px] text-terminal-green/40 mt-1">/100</div>
          <div
            className={`text-[10px] mt-3 uppercase tracking-widest font-bold ${
              data.analytics.health_score >= 70
                ? "text-terminal-green"
                : data.analytics.health_score >= 40
                  ? "text-terminal-amber"
                  : "text-terminal-red"
            }`}
          >
            {data.analytics.health_score >= 70
              ? "Healthy"
              : data.analytics.health_score >= 40
                ? "Caution"
                : "Critical"}
          </div>
        </div>

        {/* Computed Risk Flags */}
        <div className="border-2 border-terminal-green bg-black p-5">
          <h3 className="text-[10px] text-terminal-green/60 uppercase tracking-widest mb-3">
            System Risk Flags
          </h3>
          <div className="space-y-2">
            {data.analytics.risk_flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`inline-block w-2 h-2 mt-1 flex-shrink-0 ${
                    flag.severity === "CRITICAL"
                      ? "bg-terminal-red"
                      : flag.severity === "HIGH"
                        ? "bg-terminal-red/70"
                        : flag.severity === "WARNING"
                          ? "bg-terminal-amber"
                          : flag.severity === "OK"
                            ? "bg-terminal-green"
                            : "bg-terminal-cyan"
                  }`}
                />
                <span className="text-terminal-green/80">{flag.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Computed Metrics */}
        <div className="border-2 border-terminal-green bg-black p-5">
          <h3 className="text-[10px] text-terminal-green/60 uppercase tracking-widest mb-3">
            Computed Metrics
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-terminal-green/50">Net 30d Cash Flow</span>
              <span
                className={`font-bold ${
                  data.analytics.net_cash_flow_30d >= 0
                    ? "text-terminal-green"
                    : "text-terminal-red"
                }`}
              >
                {formatCurrency(data.analytics.net_cash_flow_30d)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-green/50">
                Working Capital (AR/AP)
              </span>
              <span
                className={`font-bold ${
                  data.analytics.working_capital_ratio >= 1
                    ? "text-terminal-green"
                    : "text-terminal-red"
                }`}
              >
                {data.analytics.working_capital_ratio > 99
                  ? "∞"
                  : `${data.analytics.working_capital_ratio}x`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-green/50">Burn Trend</span>
              <span
                className={`font-bold ${
                  data.analytics.burn_trend_direction === "increasing"
                    ? "text-terminal-red"
                    : data.analytics.burn_trend_direction === "decreasing"
                      ? "text-terminal-green"
                      : "text-terminal-amber"
                }`}
              >
                {data.analytics.burn_trend_direction === "stable"
                  ? "Stable"
                  : `${data.analytics.burn_trend_pct > 0 ? "+" : ""}${data.analytics.burn_trend_pct}%`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-green/50">
                Fixed Cost Coverage
              </span>
              <span className="font-bold text-terminal-green">
                {data.analytics.fixed_cost_coverage_months > 99
                  ? "∞"
                  : `${data.analytics.fixed_cost_coverage_months} mo`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-green/50">Top Client Risk</span>
              <span
                className={`font-bold ${
                  data.analytics.top_customer_pct > 50
                    ? "text-terminal-amber"
                    : "text-terminal-green"
                }`}
              >
                {data.analytics.top_customer_pct > 0
                  ? `${data.analytics.top_customer_pct}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-green/50">
                Monthly Fixed Costs
              </span>
              <span className="font-bold text-terminal-green">
                {formatCurrency(data.analytics.total_fixed_monthly)}
              </span>
            </div>
          </div>
        </div>

        {/* Working Capital Metrics (Operational Efficiency) */}
        <div className="border-2 border-terminal-cyan bg-black p-5">
          <h3 className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest mb-3">
            Operational Efficiency
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] text-terminal-cyan/40 uppercase tracking-tighter">
                  Days Sales Outstanding (DSO)
                </div>
                <div className="text-xl font-black text-terminal-cyan">
                  {data.analytics.working_capital.dso}{" "}
                  <span className="text-[10px] font-normal opacity-50">
                    days
                  </span>
                </div>
              </div>
              <div
                className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                  data.analytics.working_capital.dso_trend === "improving"
                    ? "text-terminal-green"
                    : data.analytics.working_capital.dso_trend === "worsening"
                      ? "text-terminal-red"
                      : "text-terminal-amber"
                }`}
              >
                {data.analytics.working_capital.dso_trend === "improving"
                  ? "↓ Improving"
                  : data.analytics.working_capital.dso_trend === "worsening"
                    ? "↑ Worsening"
                    : "↔ Stable"}
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] text-terminal-cyan/40 uppercase tracking-tighter">
                  Days Payable Outstanding (DPO)
                </div>
                <div className="text-xl font-black text-terminal-cyan">
                  {data.analytics.working_capital.dpo}{" "}
                  <span className="text-[10px] font-normal opacity-50">
                    days
                  </span>
                </div>
              </div>
              <div
                className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                  data.analytics.working_capital.dpo_trend === "improving"
                    ? "text-terminal-green"
                    : data.analytics.working_capital.dpo_trend === "worsening"
                      ? "text-terminal-red"
                      : "text-terminal-amber"
                }`}
              >
                {data.analytics.working_capital.dpo_trend === "improving"
                  ? "↑ Improving"
                  : data.analytics.working_capital.dpo_trend === "worsening"
                    ? "↓ Worsening"
                    : "↔ Stable"}
              </div>
            </div>

            <div className="border-t border-terminal-cyan/20 pt-2 flex justify-between items-end">
              <div>
                <div className="text-[10px] text-terminal-cyan/60 font-bold uppercase tracking-tighter">
                  Cash Conversion Cycle (CCC)
                </div>
                <div
                  className={`text-2xl font-black ${
                    data.analytics.working_capital.ccc <= 30
                      ? "text-terminal-green"
                      : "text-terminal-amber"
                  }`}
                >
                  {data.analytics.working_capital.ccc}{" "}
                  <span className="text-[10px] font-normal opacity-50">
                    days
                  </span>
                </div>
              </div>
              <div
                className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                  data.analytics.working_capital.ccc_trend === "improving"
                    ? "text-terminal-green"
                    : data.analytics.working_capital.ccc_trend === "worsening"
                      ? "text-terminal-red"
                      : "text-terminal-amber"
                }`}
              >
                {data.analytics.working_capital.ccc_trend === "improving"
                  ? "↓ Improving"
                  : data.analytics.working_capital.ccc_trend === "worsening"
                    ? "↑ Worsening"
                    : "↔ Stable"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Strategic Advice + Obligations */}
      <div className="grid grid-cols-2 gap-6">
        {/* AI Strategic Advice */}
        <div className="border-2 border-terminal-amber bg-black p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-amber mb-4 flex items-center gap-2">
            <Brain size={16} /> AI Strategic Advisor
          </h2>
          <div className="text-sm text-terminal-green leading-relaxed whitespace-pre-wrap">
            {data.ai_insights || (
              <div className="flex items-center gap-2 text-terminal-amber/60 italic animate-pulse">
                <RefreshCw size={14} className="animate-spin" />
                Consulting strategic engine...
              </div>
            )}
          </div>
          {(data.recurring_monthly_obligation > 0 ||
            data.subscription_monthly > 0) && (
            <div className="mt-4 border-t border-terminal-amber/30 pt-4 space-y-1">
              {data.recurring_monthly_obligation > 0 && (
                <div className="flex items-center gap-2 text-xs text-terminal-green">
                  <Repeat size={14} />
                  Recurring Revenue:{" "}
                  {formatCurrency(data.recurring_monthly_obligation)}/mo
                </div>
              )}
              {data.subscription_monthly > 0 && (
                <div className="flex items-center gap-2 text-xs text-terminal-cyan">
                  <div className="w-1 h-3 bg-terminal-cyan" />
                  Subscriptions: {formatCurrency(data.subscription_monthly)}/mo
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Obligations */}
        <div className="border-2 border-terminal-green bg-black">
          <div className="border-b border-terminal-green/30 px-6 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green flex items-center gap-2">
              Upcoming Obligations
            </h2>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {data.upcoming_payables.length === 0 &&
            data.upcoming_receivables.length === 0 ? (
              <div className="text-center py-8 text-terminal-green/50 uppercase tracking-widest text-xs">
                No upcoming obligations found
              </div>
            ) : (
              <div className="divide-y divide-terminal-green/10">
                {data.upcoming_payables.map((item, i) => (
                  <div
                    key={`p-${i}`}
                    className="border-b border-terminal-green/10 last:border-0 group"
                  >
                    <div
                      onClick={() =>
                        setExpandedPayable(expandedPayable === i ? null : i)
                      }
                      className="px-6 py-3 flex items-center justify-between text-xs hover:bg-terminal-green/5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-terminal-red flex items-center justify-center flex-shrink-0">
                          <ArrowUpRight
                            size={10}
                            className="text-terminal-red"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-terminal-green uppercase">
                            {item.vendor}
                          </div>
                          <div className="text-terminal-green/50">
                            {item.invoice_number} · Due{" "}
                            {new Date(item.due_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-terminal-red">
                        -{formatCurrency(item.amount)}
                      </span>
                    </div>
                    {expandedPayable === i && (
                      <div className="px-6 py-3 bg-terminal-green/[0.02] text-[10px] text-terminal-green space-y-1 mx-4 mb-3 border border-terminal-green/20">
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Invoice Number:
                          </span>
                          <span className="font-mono">
                            {item.invoice_number}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Internal ID:
                          </span>
                          <span className="font-mono opacity-50">
                            {item.id || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Vendor ID:
                          </span>
                          <span className="font-mono opacity-50">
                            {item.vendor_id || "N/A"}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-terminal-green/10 text-right">
                          <button
                            className="text-terminal-cyan uppercase tracking-widest hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Navigating to Payable ${item.id}`);
                            }}
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {data.upcoming_receivables.map((item, i) => (
                  <div
                    key={`r-${i}`}
                    className="border-b border-terminal-green/10 last:border-0 group"
                  >
                    <div
                      onClick={() =>
                        setExpandedReceivable(
                          expandedReceivable === i ? null : i,
                        )
                      }
                      className="px-6 py-3 flex items-center justify-between text-xs hover:bg-terminal-green/5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-terminal-green flex items-center justify-center flex-shrink-0">
                          <ArrowDownRight
                            size={10}
                            className="text-terminal-green"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-terminal-green uppercase flex items-center gap-2">
                            {item.customer}
                            <span
                              className={`text-[8px] px-1 py-0.5 border ${
                                item.probability >= 90
                                  ? "border-terminal-green text-terminal-green"
                                  : item.probability >= 70
                                    ? "border-terminal-cyan text-terminal-cyan"
                                    : "border-terminal-red text-terminal-red"
                              }`}
                            >
                              {item.probability}% LIKELY
                            </span>
                          </div>
                          <div className="text-terminal-green/50">
                            {item.invoice_number} · Due{" "}
                            {new Date(item.due_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-terminal-green">
                          +{formatCurrency(item.amount)}
                        </div>
                        <div className="text-[9px] text-terminal-green/40 uppercase">
                          Exp: {formatCurrency(item.expected_amount)}
                        </div>
                      </div>
                    </div>
                    {expandedReceivable === i && (
                      <div className="px-6 py-3 bg-terminal-green/[0.02] text-[10px] text-terminal-green space-y-1 mx-4 mb-3 border border-terminal-green/20">
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Invoice Number:
                          </span>
                          <span className="font-mono">
                            {item.invoice_number}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Internal ID:
                          </span>
                          <span className="font-mono opacity-50">
                            {item.id || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Customer ID:
                          </span>
                          <span className="font-mono opacity-50">
                            {item.customer_id || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-terminal-green/10 mt-1 pt-1">
                          <span className="uppercase opacity-50">
                            Collection Likelihood:
                          </span>
                          <span
                            className={`font-bold ${
                              item.probability >= 90
                                ? "text-terminal-green"
                                : item.probability >= 70
                                  ? "text-terminal-cyan"
                                  : "text-terminal-red"
                            }`}
                          >
                            {item.probability}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="uppercase opacity-50">
                            Expected Collection:
                          </span>
                          <span className="font-bold text-terminal-green">
                            {formatCurrency(item.expected_amount)}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-terminal-green/10 text-right">
                          <button
                            className="text-terminal-cyan uppercase tracking-widest hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Navigating to Receivable ${item.id}`);
                            }}
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 30-Day Cash Flow Waterfall */}
      <div className="border-2 border-terminal-cyan bg-black overflow-hidden mb-6 mt-6">
        <div className="bg-terminal-cyan/10 px-6 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-2">
            <DollarSign size={16} /> 30-Day Cash Bridge (Waterfall)
          </h2>
          <div className="text-[10px] text-terminal-cyan/60 uppercase flex items-center gap-4">
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-terminal-green/60" /> Inflows</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-terminal-red/60" /> Outflows</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-terminal-green" /> Balances</span>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="min-w-[800px]">
            <WaterfallChart data={data.waterfall_data} />
          </div>
        </div>
      </div>

      {/* Category Breakdown & Concentration */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border-2 border-terminal-green bg-black p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-green mb-6 flex items-center gap-2">
            <TrendingDown size={16} /> 30-Day Outflow Breakdown
          </h2>
          <CategoryPieChart data={data.analytics.category_breakdown} />
        </div>

        <div className="col-span-2 border-2 border-terminal-cyan bg-black p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan mb-6 flex items-center gap-2">
            <Brain size={16} /> Inflow Concentration & Risk
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Actual Recent Concentration */}
              <div>
                <div className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest mb-3 border-b border-terminal-cyan/20 pb-1">
                  Actual Historical Sources (Last 30d)
                </div>
                <div className="space-y-3">
                  {data.analytics.actual_inflow_concentration?.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-terminal-cyan truncate max-w-[150px]">{item.name}</span>
                        <div className="text-right">
                          <span className="text-xs text-terminal-cyan">{formatCurrency(item.amount)}</span>
                          <span className="text-[10px] font-bold text-terminal-cyan/60 ml-2">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1 bg-black border border-terminal-cyan/20">
                        <div className="h-full bg-terminal-cyan" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Future Projected Concentration */}
              <div>
                <div className="text-[10px] text-terminal-amber/60 uppercase tracking-widest mb-3 border-b border-terminal-amber/20 pb-1 flex items-center gap-2">
                  <AlertTriangle size={12} /> Projected AR Concentration Risk
                </div>
                <div className="space-y-3">
                  {data.analytics.customer_concentration?.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-terminal-amber truncate max-w-[150px]">{item.name}</span>
                        <div className="text-right">
                          <span className="text-xs text-terminal-amber">{formatCurrency(item.amount)}</span>
                          <span className="text-[10px] font-bold text-terminal-amber/60 ml-2">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1 bg-black border border-terminal-amber/20">
                        <div className="h-full bg-terminal-amber" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                  {!data.analytics.customer_concentration?.length && (
                    <div className="text-xs text-terminal-amber/40 uppercase italic">No upcoming AR data found.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-l border-terminal-cyan/20 pl-8 flex flex-col justify-center">
              <div className="text-[10px] text-terminal-cyan/60 uppercase tracking-widest mb-4">
                Strategic Insight
              </div>
              <p className="text-xs text-terminal-green leading-relaxed">
                {data.analytics.hist_top_inflow_pct > 50
                  ? `CRITICAL: ${data.analytics.hist_top_inflow_name} accounts for ${data.analytics.hist_top_inflow_pct}% of your actual cash intake. Any delay from this client will severely impact your ability to cover fixed costs.`
                  : data.analytics.hist_top_inflow_pct > 30
                    ? `MODERATE: Revenue is somewhat concentrated. Consider diversifying your client base to lower dependency on ${data.analytics.hist_top_inflow_name}.`
                    : `HEALTHY: Your revenue sources are well diversified. No single client accounts for more than 30% of your historical cash flow.`}
              </p>
              
              <div className="mt-8 border-t border-terminal-cyan/20 pt-6">
                <div className="text-[10px] text-terminal-cyan/50 uppercase mb-3 text-center">
                  Vendor Outflow Momentum (30d)
                </div>
                <div className="flex justify-center items-center gap-6">
                  <div className={`text-3xl font-black flex items-center gap-2 ${data.analytics.vendor_trend_pct > 10 ? "text-terminal-red" : "text-terminal-green"}`}>
                    {data.analytics.vendor_trend_pct > 0 ? "+" : ""}
                    {data.analytics.vendor_trend_pct}%
                    {data.analytics.vendor_trend_pct > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                </div>
                <p className="text-[9px] text-center text-terminal-cyan/40 uppercase mt-3">
                  Vendor payments {data.analytics.vendor_trend_pct > 0 ? "increased" : "decreased"} vs previous 30-day period.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Accuracy Tracking */}
      <div className="border-2 border-terminal-cyan bg-black overflow-hidden mb-6">
        <div className="bg-terminal-cyan/10 px-6 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-2">
            <Info size={16} /> Forecast Accuracy (Last 30 Days)
          </h2>
          <div className="text-[10px] text-terminal-cyan/60 uppercase">
            Comparison of Scheduled vs. Actual Flows
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-4 gap-8">
            <div className="col-span-1 text-center border-r border-terminal-cyan/10 pr-8">
              <div className="text-[10px] text-terminal-cyan/50 uppercase mb-2">
                Accuracy Score
              </div>
              <div className="text-4xl font-black text-terminal-cyan mb-1">
                {data.analytics.forecast_accuracy.score}%
              </div>
              <div className="text-[9px] text-terminal-cyan/40 uppercase">
                Confidence Level: HIGH
              </div>
            </div>

            <div className="col-span-3">
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="p-4 border border-terminal-green/20 bg-terminal-green/5">
                  <div className="text-[10px] text-terminal-green/50 uppercase mb-2">
                    Forecasted (Expected)
                  </div>
                  <div className="text-xl font-bold text-terminal-green">
                    {formatCurrency(
                      data.analytics.forecast_accuracy.forecasted_total,
                    )}
                  </div>
                  <div className="text-[9px] text-terminal-green/30 uppercase mt-1">
                    Based on Due Dates & Recurring
                  </div>
                </div>
                <div className="p-4 border border-terminal-cyan/20 bg-terminal-cyan/5">
                  <div className="text-[10px] text-terminal-cyan/50 uppercase mb-2">
                    Actual (Bank In/Out)
                  </div>
                  <div className="text-xl font-bold text-terminal-cyan">
                    {formatCurrency(
                      data.analytics.forecast_accuracy.actual_total,
                    )}
                  </div>
                  <div className="text-[9px] text-terminal-cyan/30 uppercase mt-1">
                    Verified Bank Transactions
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-terminal-cyan/60 uppercase mb-3 flex items-center gap-2">
                  <Lightbulb size={12} /> Variance Drivers (Why Forecast
                  Shifted)
                </div>
                <div className="space-y-2">
                  {data.analytics.forecast_accuracy.drivers.length > 0 ? (
                    data.analytics.forecast_accuracy.drivers.map(
                      (driver, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs border-l-2 border-terminal-amber/50 pl-4 py-1"
                        >
                          <span className="font-bold text-terminal-amber min-w-[100px] uppercase">
                            [{driver.category}]
                          </span>
                          <span className="text-terminal-green/80">
                            {driver.message}
                          </span>
                          <span className="ml-auto text-[10px] text-terminal-amber/50 font-bold uppercase">
                            {driver.impact}
                          </span>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="text-xs text-terminal-green/40 uppercase italic">
                      Forecast perfectly aligned with actual payment behaviors.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights & Recent Activity */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 border-2 border-terminal-cyan bg-black overflow-hidden flex flex-col">
          <div className="bg-terminal-cyan/10 px-6 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-2">
              <Brain size={16} /> AI Strategic Advisor
            </h2>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-terminal-amber animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-terminal-amber/50" />
              <div className="w-2 h-2 rounded-full bg-terminal-amber/20" />
            </div>
          </div>
          <div className="p-6 font-mono text-xs text-terminal-green leading-relaxed flex-grow bg-[url('/scanline.png')] bg-repeat">
            <div className="mb-4 whitespace-pre-wrap">
              {'> INITIALIZING STRATEGIC ANALYSIS... OK\n> PROCESSING METRICS... DONE\n\n'}
            </div>
            <MarkdownInsight text={data.ai_insights} />
            <div className="mt-4 whitespace-pre-wrap">
              {'\n\n> AWAITING FURTHER COMMANDS_'}
              <span className="animate-pulse">█</span>
            </div>
          </div>
        </div>

        <div className="col-span-1 border-2 border-terminal-cyan bg-black overflow-hidden flex flex-col">
          <div className="bg-terminal-cyan/10 px-6 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-2">
              <RefreshCw size={16} /> Recent Activity
            </h2>
            <div className="text-[10px] text-terminal-cyan/60 uppercase">
              Last 10 Txns
            </div>
          </div>
          <div className="p-4 flex-grow overflow-y-auto max-h-[300px] space-y-3">
            {data.recent_transactions?.map((txn) => (
              <div key={txn.id} className="flex justify-between items-center border-b border-terminal-cyan/10 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] text-terminal-cyan/50 uppercase mb-0.5">
                    {new Date(txn.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-terminal-green truncate font-bold uppercase max-w-[150px]">
                    {txn.description}
                  </div>
                </div>
                <div className={`text-xs font-bold whitespace-nowrap ${txn.amount >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                </div>
              </div>
            ))}
            {!data.recent_transactions?.length && (
              <div className="text-xs text-terminal-cyan/40 uppercase italic text-center py-4">
                No recent transactions found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryPieChart({
  data,
}: {
  data: { label: string; amount: number; percentage: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const centerX = w / 3; // Shifted left to make room for legend
    const centerY = h / 2;
    const radius = Math.min(centerX, h / 2) * 0.8;

    ctx.clearRect(0, 0, w, h);

    if (!data || data.length === 0) {
      ctx.fillStyle = "rgba(0, 255, 136, 0.2)";
      ctx.textAlign = "center";
      ctx.font = "10px monospace";
      ctx.fillText("NO CATEGORY DATA", centerX, centerY);
      return;
    }

    const colors = [
      "#00ff88", // Green
      "#00ccff", // Cyan
      "#ff3366", // Red
      "#ffcc00", // Amber
      "#9966ff", // Purple
      "#ff9933", // Orange
      "#33ffcc", // Teal
    ];

    let startAngle = -Math.PI / 2;

    data.forEach((segment, i) => {
      const sliceAngle = (segment.percentage / 100) * (Math.PI * 2);
      const color = colors[i % colors.length];

      // Draw Slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fill();

      // subtle border
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Legend
      const legendX = centerX + radius + 30;
      const legendY = 20 + i * 18;

      ctx.globalAlpha = 1.0;
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 8, 8, 8);

      ctx.fillStyle = "#00ff88";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `${segment.label} (${segment.percentage}%)`,
        legendX + 15,
        legendY,
      );

      startAngle += sliceAngle;
    });

    // Inner hole for donut style
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();

    // Center Label
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("EXPENSES", centerX, centerY - 5);
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(0, 255, 136, 0.5)";
    ctx.fillText("BY CAT", centerX, centerY + 8);
  }, [data]);

  return <canvas ref={canvasRef} className="w-full h-[180px]" />;
}

function ForecastCard({
  label,
  forecast,
  currentBalance,
  confidenceScore,
  varianceAmt,
}: {
  label: string;
  forecast: { projected_balance: number; inflows: number; outflows: number };
  currentBalance: number;
  confidenceScore: number;
  varianceAmt: number;
}) {
  const { settings } = useSettings();
  const change = forecast.projected_balance - currentBalance;
  const isPositive = change >= 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="border-2 border-terminal-green/50 bg-black p-5">
      <div className="text-terminal-green/60 uppercase text-[10px] tracking-widest mb-2">
        {label}
      </div>
      <div
        className={`text-2xl font-black ${forecast.projected_balance >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
      >
        {formatCurrency(forecast.projected_balance)}
      </div>
      <div className="text-[10px] text-terminal-green/50 mt-1 uppercase">
        ±{formatCurrency(varianceAmt)} ({confidenceScore}% Confidence)
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px]">
        {isPositive ? (
          <TrendingUp size={12} className="text-terminal-green" />
        ) : (
          <TrendingDown size={12} className="text-terminal-red" />
        )}
        <span
          className={isPositive ? "text-terminal-green" : "text-terminal-red"}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(change)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-terminal-green/50 uppercase">In: </span>
          <span className="text-terminal-green font-bold">
            {formatCurrency(forecast.inflows)}
          </span>
        </div>
        <div>
          <span className="text-terminal-red/50 uppercase">Out: </span>
          <span className="text-terminal-red font-bold">
            {formatCurrency(forecast.outflows)}
          </span>
        </div>
      </div>
    </div>
  );
}
function WaterfallChart({ data }: { data: any[] }) {
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, bottom: 40, left: 60, right: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Calculate scaling
    let runningTotal = 0;
    const points = data.map((d) => {
      const start = runningTotal;
      if (d.type === "total") {
        runningTotal = d.amount;
        return { label: d.label, start: 0, end: d.amount, type: d.type };
      } else {
        runningTotal += d.amount;
        return { label: d.label, start, end: runningTotal, type: d.type };
      }
    });

    const maxVal = Math.max(...points.flatMap((p) => [p.start, p.end])) * 1.1;
    const minVal =
      Math.min(0, ...points.flatMap((p) => [p.start, p.end])) * 1.1;
    const range = maxVal - minVal;

    const toY = (val: number) =>
      padding.top + chartH - ((val - minVal) / range) * chartH;
    const barW = (chartW / points.length) * 0.7;
    const barGap = (chartW / points.length) * 0.3;

    // Draw Grid
    ctx.strokeStyle = "rgba(0, 255, 136, 0.1)";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((p) => {
      const y = padding.top + chartH * (1 - p);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    });

    // Draw Bars
    points.forEach((p, i) => {
      const x = padding.left + i * (barW + barGap) + barGap / 2;
      const yStart = toY(p.start);
      const yEnd = toY(p.end);
      const barH = Math.abs(yStart - yEnd);
      const top = Math.min(yStart, yEnd);

      if (p.type === "total") {
        ctx.fillStyle = "#00ff88";
      } else if (p.type === "inflow") {
        ctx.fillStyle = "rgba(0, 255, 136, 0.6)";
      } else {
        ctx.fillStyle = "rgba(255, 68, 68, 0.6)";
      }

      ctx.fillRect(x, top, barW, Math.max(barH, 2));

      // Connecting lines
      if (i < points.length - 1) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
        ctx.beginPath();
        ctx.moveTo(x + barW, yEnd);
        ctx.lineTo(x + barW + barGap, yEnd);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Labels
      ctx.fillStyle = "rgba(0, 255, 136, 0.5)";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";

      // Compact label: first 8 chars
      const shortLabel =
        p.label.length > 10 ? p.label.substring(0, 8) + ".." : p.label;
      ctx.fillText(shortLabel, x + barW / 2, h - 20);

      // Amount label inside or above
      ctx.fillStyle = "#fff";
      const amtStr = (p.end - p.start).toLocaleString("en-US", {
        style: "currency",
        currency: settings?.base_currency || "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      if (p.type !== "total") {
        ctx.fillText(p.end - p.start >= 0 ? "+" : "", x + barW / 2, top - 5);
      }
    });

    // Y Axis labels
    ctx.fillStyle = "rgba(0, 255, 136, 0.4)";
    ctx.textAlign = "right";
    ctx.font = "10px monospace";
    [minVal, maxVal / 2, maxVal].forEach((v) => {
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: settings?.base_currency || "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v);
      ctx.fillText(formatted, padding.left - 10, toY(v) + 4);
    });
  }, [data]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full" style={{ height: "200px" }} />
    </div>
  );
}

function MarkdownInsight({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n").filter((line) => line.trim() !== "");

  const renderBold = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-terminal-cyan font-black">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmedLine = line.trim();
        const isBullet = trimmedLine.startsWith("*") || trimmedLine.startsWith("-");
        const content = isBullet ? trimmedLine.substring(1).trim() : trimmedLine;

        return (
          <div key={i} className="flex gap-3">
            {isBullet && <span className="text-terminal-amber font-bold">»</span>}
            <div className="flex-grow">{renderBold(content)}</div>
          </div>
        );
      })}
    </div>
  );
}
