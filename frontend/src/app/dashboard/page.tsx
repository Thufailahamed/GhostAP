"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import {
  AlertCircle,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Activity,
  DollarSign, TrendingUp, TrendingDown, Cpu, Terminal, Zap, RefreshCw, Send, Download,
  BarChart2, PieChart as PieChartIcon
} from "lucide-react";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useSettings } from "@/hooks/use-settings";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    avgConfidence: 0,
  });
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [processingTimeData, setProcessingTimeData] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [aiMetrics, setAiMetrics] = useState<any>(null);
  const [cashflow, setCashflow] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useSettings();

  const fetchDashboardData = async () => {
    // 1. Fetch "Instant" Data (Core Telemetry)
    const fetchCoreData = async () => {
      try {
        const [invRes, statsRes, cashflowRes] = await Promise.all([
          api.get("/invoices"),
          api.get("/analytics/dashboard-stats"),
          api.get("/cashflow/forecast"),
        ]);
  
        setInvoices(invRes.data);
        const analytics = statsRes.data;
  
        setStats({
          total: analytics.stats.total,
          approved: analytics.stats.approved,
          pending: analytics.stats.pending,
          rejected: analytics.stats.rejected,
          avgConfidence: analytics.stats.avgConfidence,
        });
  
        setVolumeData(analytics.throughput);
        setProcessingTimeData(analytics.processingTime);
        setCashflow(cashflowRes.data);
        
        // After forecast, trigger advisor
        api.get("/cashflow/strategic-advice").then(adviceRes => {
            setCashflow((prev: any) => ({
                ...prev,
                ai_insights: adviceRes.data.advice
            }));
        }).catch(err => console.error("AI Advice fetch failed:", err));

      } catch (err) {
        console.error("Core dashboard fetch failed:", err);
      }
    };

    // 2. Fetch "AI/Deep" Data (Engine Metrics)
    const fetchAIData = async () => {
      try {
        const [reportsRes, aiMetricsRes] = await Promise.all([
          api.get("/analytics/reports"),
          api.get("/analytics/ai-metrics"),
        ]);
        setReports(reportsRes.data);
        setAiMetrics(aiMetricsRes.data);
      } catch (err) {
        console.error("AI data fetch failed:", err);
      }
    };

    setIsLoading(true);
    // Fire both, but don't await them combined
    await fetchCoreData();
    setIsLoading(false);
    
    // AI data can finish later
    fetchAIData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const exportToPDF = async () => {
    const element = document.getElementById("dashboard-content");
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Finance_OS_Dashboard_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <div className="space-y-8 pb-12" id="dashboard-content">
      <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
            FINANCE_CONTROL_CENTER
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
            Finance OS // Real-time Telemetry & Queue Management
          </p>
        </div>
        <Link href="/dashboard/upload">
          <Button className="tracking-widest bg-terminal-green text-black hover:bg-terminal-green-dark border-none px-6">
            + NEW_DATA_INPUT
          </Button>
        </Link>
      </div>

      {/* Quick Actions Command Center */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-2 border-b border-terminal-green/30">
        <Link href="/dashboard/upload" className="w-full">
          <Button variant="outline" className="w-full bg-terminal-panel text-terminal-green border-terminal-green hover:bg-terminal-green hover:text-black flex gap-2 h-12">
             <Zap size={16} /> <span className="tracking-widest text-xs font-bold">SCAN_DOCUMENT</span>
          </Button>
        </Link>
        <Link href="/dashboard/receivables" className="w-full">
          <Button variant="outline" className="w-full bg-terminal-panel text-terminal-cyan border-terminal-cyan hover:bg-terminal-cyan hover:text-black flex gap-2 h-12">
             <Send size={16} /> <span className="tracking-widest text-xs font-bold">RUN_PAYMENT_BATCH</span>
          </Button>
        </Link>
        <Link href="/dashboard/ledger" className="w-full">
          <Button variant="outline" className="w-full bg-terminal-panel text-terminal-amber border-terminal-amber hover:bg-terminal-amber hover:text-black flex gap-2 h-12">
             <RefreshCw size={16} /> <span className="tracking-widest text-xs font-bold">SYNC_LEDGER</span>
          </Button>
        </Link>
        <Button onClick={exportToPDF} variant="outline" className="bg-terminal-panel text-terminal-green border-terminal-green/50 hover:bg-terminal-green hover:text-black flex gap-2 h-12">
           <Download size={16} /> <span className="tracking-widest text-xs font-bold">GENERATE_REPORT</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Section (Spans 2 columns) */}
        <div className="lg:col-span-2 border-2 border-terminal-red bg-terminal-panel p-4 flex items-start gap-4 h-full">
          <AlertCircle
            className="text-terminal-red mt-1 flex-shrink-0"
            size={24}
          />
          <div>
            <h3 className="font-bold uppercase text-terminal-red text-lg">
              System Alerts ({stats.pending > 0 ? stats.pending : 0})
            </h3>
            <ul className="mt-2 space-y-1 text-sm font-medium text-terminal-red">
              {stats.pending > 0 && (
                <li className="flex gap-2 items-center">
                  <Activity size={14} /> {stats.pending} invoices awaiting review
                </li>
              )}
              <li className="flex gap-2 items-center">
                <Activity size={14} /> System operating via Ghost-AP-v2.1 OCR
              </li>
            </ul>
          </div>
        </div>

        {/* Integration Health Matrix */}
        <div className="border-2 border-terminal-green bg-terminal-panel p-4 flex flex-col justify-center h-full">
          <h3 className="font-bold uppercase text-terminal-green/50 text-[10px] tracking-widest mb-3 flex items-center gap-2">
            <Activity size={14} /> Integration Health
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-terminal-green/20 pb-2">
              <span className="text-terminal-green font-bold">Bank Feeds</span>
              <span className="text-terminal-cyan bg-terminal-cyan/10 px-2 py-0.5 whitespace-nowrap">CONNECTED (2m)</span>
            </div>
            <div className="flex justify-between items-center border-b border-terminal-green/20 pb-2">
              <span className="text-terminal-green font-bold">ERP Sync</span>
              <span className="text-terminal-cyan bg-terminal-cyan/10 px-2 py-0.5 whitespace-nowrap">ACTIVE (1h)</span>
            </div>
            <div className="flex justify-between items-center border-b border-terminal-green/20 pb-2">
              <span className="text-terminal-green font-bold">Email Intake</span>
              <span className="text-terminal-cyan bg-terminal-cyan/10 px-2 py-0.5 whitespace-nowrap">LISTENING (2)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Snapshot */}
      {cashflow && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-2">
          <KpiCard
            title="CASH_ON_HAND"
            value={<CurrencyDisplay amount={cashflow.ledger_balance} />}
            icon={<DollarSign size={18} />}
            sub={
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className="text-[9px] opacity-70">LEDGER (SOURCE OF TRUTH)</span>
                {cashflow.bank_balance !== undefined && (
                  <div className="flex items-center gap-1.5 border-t border-terminal-cyan/20 pt-1 mt-1">
                    <span className="text-[10px] font-bold text-white/90">
                      BANK: <CurrencyDisplay amount={cashflow.bank_balance} />
                    </span>
                    {Math.abs(cashflow.reconciliation_variance) > 0.01 && (
                      <span className="text-[8px] px-1 bg-terminal-amber/20 text-terminal-amber animate-pulse border border-terminal-amber/30">
                        UNCLEARED
                      </span>
                    )}
                  </div>
                )}
              </div>
            }
            color="text-terminal-cyan"
          />
          <KpiCard
            title="30D_EXPECTED_INFLOWS"
            value={<CurrencyDisplay amount={cashflow.forecast_30d?.inflows} />}
            icon={<TrendingUp size={18} />}
            sub="Receivables Pipeline"
            color="text-terminal-green"
          />
          <KpiCard
            title="30D_EXPECTED_OUTFLOWS"
            value={<CurrencyDisplay amount={-cashflow.forecast_30d?.outflows} />}
            icon={<TrendingDown size={18} />}
            sub="Payables Pipeline"
            color="text-terminal-red"
          />
          <div className="border border-terminal-cyan/40 bg-terminal-panel p-4 flex flex-col justify-between h-full">
            <h3 className="font-bold uppercase text-[10px] tracking-widest text-terminal-cyan/50 mb-2">
              14-Day Cash Flow Trend
            </h3>
            <div className="h-16 w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow.forecast_30d?.chart_data?.slice(0, 14)}>
                  <defs>
                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00ffff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip
                    formatter={(value: any) => [
                      settings?.base_currency === "USD" ? `$${value.toLocaleString()}` : `${value.toLocaleString()} ${settings?.base_currency || "USD"}`,
                      "Balance"
                    ]}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#00ffff" fillOpacity={1} fill="url(#colorBal)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* AI Engine Status */}
      {(!aiMetrics || !reports) ? (
        <div className="border border-terminal-cyan/30 bg-terminal-cyan/5 p-6 mt-2 animate-pulse min-h-[150px] flex flex-col justify-center">
           <div className="flex justify-between border-b border-terminal-cyan/10 pb-2 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan/40 flex items-center gap-2">
                <Cpu size={16} /> AI Engine Status // INITIALIZING...
              </h2>
           </div>
           <div className="flex items-center gap-3 text-terminal-cyan/30 font-mono text-xs tracking-widest uppercase">
              <RefreshCw className="animate-spin" size={14} /> 
              Synchronizing with Neural Processing Unit... [CALCULATING_METRICS]
           </div>
        </div>
      ) : (
        <div className="border border-terminal-cyan/30 bg-terminal-cyan/5 p-6 mt-2">
          <div className="flex justify-between border-b border-terminal-cyan/20 pb-2 mb-4">
             <h2 className="text-sm font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-2">
               <Cpu size={16} /> AI Engine Status // {aiMetrics.model_version}
             </h2>
             <div className="text-[10px] text-terminal-cyan/60 uppercase">Last trained: {aiMetrics.last_trained}</div>
          </div>
          <div className="grid grid-cols-3 gap-8">
            <div>
               <div className="text-[10px] text-terminal-cyan/50 uppercase mb-1">Global Confidence</div>
               <div className="text-3xl font-black text-terminal-cyan">{aiMetrics.global_confidence}%</div>
            </div>
            <div>
               <div className="text-[10px] text-terminal-cyan/50 uppercase mb-1">STP Rate</div>
               <div className="text-3xl font-black text-terminal-green">{reports.stp_rate}%</div>
               <div className="text-[9px] text-terminal-green/50 uppercase mt-1">Straight Through Processing</div>
            </div>
            <div>
               <div className="text-[10px] text-terminal-cyan/50 uppercase mb-1">Exception Rate</div>
               <div className="text-3xl font-black text-terminal-red">{reports.exception_rate}%</div>
               <div className="text-[9px] text-terminal-red/50 uppercase mt-1">Manual Intervention Required</div>
            </div>
          </div>
          <div className="mt-6 border-t border-terminal-cyan/10 pt-4">
             <div className="text-[10px] text-terminal-cyan/60 uppercase mb-3 text-center">Field Error Rates</div>
             <div className="flex gap-4 justify-between">
                {aiMetrics.fields.map((f: any, i: number) => (
                   <div key={i} className="flex-1 border border-terminal-cyan/10 p-2 text-center bg-black">
                      <div className="text-xs font-bold text-terminal-amber">{f.correction_rate}%</div>
                      <div className="text-[9px] text-terminal-cyan/50 uppercase">{f.field}</div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <KpiCard
          title="TOTAL_DOCS"
          value={stats.total.toString()}
          icon={<FileText size={18} />}
          sub="Indexed"
        />
        <KpiCard
          title="APPROVED"
          value={stats.approved.toString()}
          icon={<CheckCircle size={18} />}
          sub="Verified"
          color="text-terminal-cyan"
        />
        <KpiCard
          title="PENDING"
          value={stats.pending.toString()}
          icon={<Clock size={18} />}
          sub="Audit required"
          color="text-terminal-amber"
        />
        <KpiCard
          title="REJECTED"
          value={stats.rejected.toString()}
          icon={<XCircle size={18} />}
          sub="Flagged"
          color="text-terminal-red"
        />
        <KpiCard
          title="AVG_PRECISION"
          value={`${stats.avgConfidence}%`}
          icon={<Activity size={18} />}
          sub="AI Score"
          color="text-terminal-cyan"
        />
        <KpiCard
          title="EST_ROI"
          value={<CurrencyDisplay amount={stats.total * 5} />}
          icon={<Clock size={18} />}
          sub="Automation Value"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
          <CardHeader className="border-b border-terminal-green/30">
            <CardTitle className="text-xs tracking-widest uppercase opacity-60">
              System Throughput (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volumeData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#222"
                />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: "#444" }}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fontWeight: "bold",
                    fill: "#00ff88",
                  }}
                />
                <YAxis
                  axisLine={{ stroke: "#444" }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#00ff88" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0, 255, 136, 0.05)" }}
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #00ff88",
                    backgroundColor: "#000",
                    fontSize: "12px",
                    color: "#00ff88",
                  }}
                />
                <Bar dataKey="count" fill="#00ff88" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
          <CardHeader className="border-b border-terminal-green/30">
            <CardTitle className="text-xs tracking-widest uppercase opacity-60">
              Mean Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={processingTimeData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#222"
                />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: "#444" }}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fontWeight: "bold",
                    fill: "#00ff88",
                  }}
                />
                <YAxis
                  axisLine={{ stroke: "#444" }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#00ff88" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid #00ff88",
                    backgroundColor: "#000",
                    fontSize: "12px",
                    color: "#00ff88",
                  }}
                />
                <Line
                  type="stepAfter"
                  dataKey="time"
                  stroke="#00ffff"
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    strokeWidth: 1,
                    fill: "#000",
                    stroke: "#00ffff",
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {!reports ? (
          <div className="rounded-none border-2 border-terminal-green/30 bg-terminal-panel/50 p-6 flex flex-col justify-center items-center h-80 animate-pulse">
            <BarChart2 className="text-terminal-green/20" size={40} />
            <span className="text-[10px] text-terminal-green/40 uppercase mt-4 tracking-widest">Compiling Vendor Analytics...</span>
          </div>
        ) : (
          <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
            <CardHeader className="border-b border-terminal-green/30">
              <CardTitle className="text-xs tracking-widest uppercase opacity-60">
                Vendor Processing Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reports.vendor_volume}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#222" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#00ff88" }} axisLine={{ stroke: "#444" }} tickLine={false} />
                  <YAxis type="category" dataKey="vendor" tick={{ fontSize: 10, fill: "#00ff88" }} axisLine={{ stroke: "#444" }} tickLine={false} width={80} />
                  <Tooltip
                    cursor={{ fill: "rgba(0, 255, 136, 0.05)" }}
                    contentStyle={{ borderRadius: 0, border: "1px solid #00ff88", backgroundColor: "#000", fontSize: "12px", color: "#00ff88" }}
                  />
                  <Bar dataKey="count" fill="#00ccff" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {!reports ? (
          <div className="rounded-none border-2 border-terminal-green/30 bg-terminal-panel/50 p-6 flex flex-col justify-center items-center h-80 animate-pulse">
            <PieChartIcon className="text-terminal-green/20" size={40} />
            <span className="text-[10px] text-terminal-green/40 uppercase mt-4 tracking-widest">Aggregating Category Splits...</span>
          </div>
        ) : (
          <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
            <CardHeader className="border-b border-terminal-green/30">
              <CardTitle className="text-xs tracking-widest uppercase opacity-60">
                Expense Category Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reports.category_volume}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#00ff88"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {reports.category_volume?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={["#00ff88", "#00ccff", "#ff3366", "#ffcc00", "#9966ff"][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 0,
                      border: "1px solid #00ff88",
                      backgroundColor: "#000",
                      fontSize: "12px",
                      color: "#00ff88",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Needs Review Table AND Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green h-full">
            <CardHeader className="flex flex-row justify-between items-center border-b-2 border-terminal-green">
              <CardTitle>Priority Action Queue</CardTitle>
              <Link href="/dashboard/invoices">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-terminal-panel text-terminal-green border-terminal-green hover:bg-terminal-green hover:text-black"
                >
                  VIEW ALL
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0 mt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b-2 border-terminal-green font-bold text-terminal-green">
                <tr>
                  <th scope="col" className="px-6 py-4">
                    Invoice ID
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Vendor
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Conf.
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Total Amount
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
                {invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-terminal-amber font-bold uppercase"
                    >
                      No invoices in queue
                    </td>
                  </tr>
                ) : (
                  invoices.slice(0, 5).map((inv: any, idx: number) => (
                    <tr
                      key={inv.id}
                      className="border-b border-[#333] hover:bg-[#111] transition-colors bg-transparent"
                    >
                      <td className="px-6 py-4 font-bold font-mono">
                        {inv.invoice_number}
                      </td>
                      <td className="px-6 py-4 font-bold">{inv.vendor_name}</td>
                      <td className="px-6 py-4 font-mono font-bold text-terminal-cyan">
                        {inv.ai_confidence_score}%
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-right">
                        <CurrencyDisplay amount={inv.amount} />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[11px] font-bold tracking-tighter uppercase whitespace-nowrap ${
                            inv.status === "APPROVED" ||
                            inv.status === "SYNCED_TO_ERP"
                              ? "text-terminal-green"
                              : inv.status === "REJECTED" ||
                                  inv.status === "FAILED"
                                ? "text-terminal-red"
                                : "text-terminal-amber"
                          }`}
                        >
                          [{inv.status}]
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/invoices/${inv.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-terminal-panel text-terminal-green border border-terminal-green hover:bg-terminal-green hover:text-black px-4"
                          >
                            REVIEW
                          </Button>
                        </Link>
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
      
      <div className="lg:col-span-1">
        <Card className="rounded-none border-2 border-terminal-cyan bg-black text-terminal-cyan h-full flex flex-col">
          <CardHeader className="border-b border-terminal-cyan/30 flex-none pb-3">
            <CardTitle className="text-sm tracking-widest uppercase flex items-center gap-2">
              <Terminal size={16} /> Live Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 font-mono text-xs overflow-hidden relative min-h-[300px]">
            <div data-html2canvas-ignore="true" className="absolute inset-0 bg-[url('/scanline.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
            <div className="space-y-3">
              {cashflow?.recent_transactions?.slice(0, 5).map((txn: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-terminal-cyan/50">[{new Date(txn.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                  <span className={txn.amount >= 0 ? "text-terminal-green" : "text-terminal-red"}>
                    {txn.amount >= 0 ? "IN" : "OUT"}
                  </span>
                  <span className="truncate flex-1 text-terminal-cyan/80">
                    {txn.description}
                  </span>
                  <span>
                    <CurrencyDisplay amount={Math.abs(txn.amount)} />
                  </span>
                </div>
              ))}
              {invoices.slice(0, 3).map((inv: any, i: number) => (
                <div key={`inv-${i}`} className="flex gap-2">
                  <span className="text-terminal-cyan/50">[SYS]</span>
                  <span className="text-terminal-amber">OCR</span>
                  <span className="truncate flex-1 text-terminal-cyan/80">
                    Indexed {inv.invoice_number} ({inv.vendor_name})
                  </span>
                </div>
              ))}
              <div className="flex gap-2 text-terminal-cyan mt-4 animate-pulse">
                <span>{">"}</span>
                <span>AWAITING_INPUT_</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon,
  color = "text-terminal-green",
}: {
  title: string;
  value: string | React.ReactNode;
  sub: string | React.ReactNode;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="border border-terminal-green/40 bg-terminal-panel p-4 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold uppercase text-[10px] tracking-widest text-terminal-green/50">
          {title}
        </h3>
        <div className={`${color} opacity-40`}>{icon}</div>
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-widest ${color}`}>
          {value}
        </div>
        <div className="text-[10px] font-bold uppercase text-terminal-green/30 mt-1">
          {sub}
        </div>
      </div>
    </div>
  );
}
