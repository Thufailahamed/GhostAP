"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Calendar,
  Download,
  TrendingUp,
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  Cpu,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import Link from "next/link";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

const COLORS = ["#00ff88", "#00ffff", "#ffb000", "#ff3333", "#9966ff"];

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/analytics/reports");
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportToPDF = async () => {
    const element = document.getElementById("reports-content");
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#000000"
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ghost_AP_System_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-terminal-green animate-pulse font-mono uppercase tracking-[0.3em] text-xl">
          Initializing_Ledger_Audit...
        </div>
      </div>
    );
  }

  const categoryVolume = data.category_volume || [];
  const vendorVolume = data.vendor_volume || [];

  return (
    <div className="space-y-8 pb-12" id="reports-content">
      <div className="flex justify-between items-center border-b-2 border-terminal-green pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-terminal-green">
            SYSTEM_ANALYTICS_CORE
          </h1>
          <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1 tracking-widest">
            Ghost AP // AI Throughput & Integrity Telemetry
          </p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline"
            className="font-bold text-xs tracking-widest bg-black border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black h-10 px-6 rounded-none"
          >
            <Calendar size={16} className="mr-2" /> PERIOD: LAST_180D
          </Button>
          <Button 
            onClick={exportToPDF}
            className="font-bold text-xs tracking-widest bg-terminal-green text-black hover:bg-terminal-green/80 h-10 px-6 rounded-none border-none"
          >
            <Download size={16} className="mr-2" /> GENERATE_EXPORT
          </Button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="MEAN_PROCESSING_TIME"
          value="1.2m"
          sub="Extraction Speed Alpha"
          icon={<Clock size={20} />}
          color="text-terminal-cyan"
        />
        <KpiCard
          title="STP_STRAIGHT_THROUGH_RATE"
          value={`${data.stp_rate}%`}
          sub="Zero Intervention Extraction"
          icon={<TrendingUp size={20} />}
          color="text-terminal-green"
        />
        <KpiCard
          title="VENDOR_EXCEPTION_RATE"
          value={`${data.exception_rate}%`}
          sub="Requires Manual Audit"
          icon={<AlertTriangle size={20} />}
          color="text-terminal-red"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-none border-2 border-terminal-green bg-black text-terminal-green">
          <CardHeader className="border-b border-terminal-green/20 bg-terminal-green/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={14} /> CATEGORY_DISTRIBUTION_MATRIX
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryVolume}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="#000"
                    strokeWidth={2}
                  >
                    {categoryVolume.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000",
                      border: "1px solid #00ff88",
                      borderRadius: "0",
                      color: "#00ff88",
                      fontSize: "12px",
                      fontFamily: "monospace"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-terminal-green/10 pt-6">
              {categoryVolume.map((c: any, i: number) => (
                <div
                  key={c.name}
                  className="flex items-center gap-3 text-[10px] font-bold"
                >
                  <div
                    className="w-2 h-2"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  ></div>
                  <span className="uppercase tracking-widest opacity-70">{c.name}</span>
                  <span className="ml-auto font-mono text-terminal-cyan">{c.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-terminal-green bg-black text-terminal-green">
          <CardHeader className="border-b border-terminal-green/20 bg-terminal-green/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Terminal size={14} /> VENDOR_THROUGHPUT_EFFICIENCY
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 px-2">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={vendorVolume} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="#222"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="vendor"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={120}
                    tick={{ fontSize: 10, fill: "#00ff88", fontWeight: "bold" }}
                    className="uppercase"
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0, 255, 136, 0.05)" }}
                    contentStyle={{
                      backgroundColor: "#000",
                      border: "1px solid #00ff88",
                      borderRadius: "0",
                      color: "#00ff88",
                      fontSize: "12px",
                      fontFamily: "monospace"
                    }}
                  />
                  <Bar dataKey="count" fill="#00ffff" radius={0} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Actionable Insights Table */}
        <div className="lg:col-span-2">
          <Card className="rounded-none border-2 border-terminal-amber bg-black text-terminal-amber overflow-hidden">
            <CardHeader className="bg-terminal-amber/10 border-b-2 border-terminal-amber flex flex-row items-center gap-3">
              <ShieldCheck className="text-terminal-amber" size={20} />
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em]">
                AI_INTEGRITY_AUDIT_QUEUE // LOWEST_CONFIDENCE_VENDORS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs text-left">
                <thead className="bg-black text-terminal-amber/60 uppercase font-black border-b border-terminal-amber/20">
                  <tr>
                    <th className="px-8 py-5">VENDOR_ENTITY</th>
                    <th className="px-8 py-5 text-center">TOTAL_PROCESSED</th>
                    <th className="px-8 py-5 text-center">EXCEPTION_RATE</th>
                    <th className="px-8 py-5 text-right">SYSTEM_ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-amber/10">
                  {vendorVolume.map((v: any, idx: number) => (
                    <tr
                      key={v.id || idx}
                      className="hover:bg-terminal-amber/5 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-bold text-lg uppercase tracking-tighter text-terminal-amber">{v.vendor}</div>
                        <div className="text-[9px] opacity-40">ERP_ID: {v.id || 'N/A'}</div>
                      </td>
                      <td className="px-8 py-6 text-center font-mono text-lg">{v.count}</td>
                      <td className="px-8 py-6 text-center">
                        <div className={`font-black text-lg ${v.failure_rate > 20 ? 'text-terminal-red' : 'text-terminal-amber'}`}>
                          {v.failure_rate}%
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link href={`/dashboard/vendors/${v.id || ''}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="font-black border-terminal-amber bg-black text-terminal-amber hover:bg-terminal-amber hover:text-black text-[10px] uppercase h-8 px-4"
                          >
                            RE-MAP_OCR <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {vendorVolume.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-8 py-12 text-center text-terminal-amber/20 italic font-mono uppercase tracking-widest"
                      >
                        No exception telemetry detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
  value: string;
  sub: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="rounded-none border-2 border-terminal-green bg-black shadow-[4px_4px_0px_0px_rgba(0,255,136,0.1)]">
      <CardHeader className="border-b border-terminal-green/10 pb-2">
        <CardTitle className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between ${color} opacity-60`}>
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className={`text-5xl font-black tracking-tighter ${color}`}>
          {value}
        </div>
        <div className="text-[10px] font-bold uppercase mt-2 text-terminal-amber/60 tracking-widest">
          {sub}
        </div>
      </CardContent>
    </Card>
  );
}
