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
} from "recharts";
import {
  Calendar,
  Download,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";

const COLORS = ["#00ff88", "#00ffff", "#ffb000", "#ff3333", "#9CA3AF"];

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

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-terminal-green animate-pulse font-mono uppercase tracking-widest">
          Scanning Ledger Analytics...
        </div>
      </div>
    );
  }

  const categoryVolume = data.category_volume || [];
  const vendorVolume = data.vendor_volume || [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">
            System Analytics
          </h1>
          <p className="text-gray-300 font-medium">
            Evaluate AP throughput, AI performance, and human intervention
            rates.
          </p>
        </div>
        <div className="flex gap-4">
          <Button className="font-bold text-md tracking-wider bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black flex gap-2">
            <Calendar size={20} /> LAST 6 MONTHS
          </Button>
          <Button className="font-bold text-md tracking-wider bg-terminal-green text-black hover:bg-terminal-green/80 border-2 border-terminal-green flex gap-2 font-mono">
            <Download size={20} /> EXPORT_DATA
          </Button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="Avg Processing Time"
          value="1.2m"
          sub="-4.5m vs last quarter"
          icon={<Clock size={16} />}
          trend="up"
        />
        <KpiCard
          title="STP Rate"
          value={`${data.stp_rate}%`}
          sub="Zero human touch extraction"
          icon={<TrendingUp size={16} />}
          variant="green"
        />
        <KpiCard
          title="Vendor Exception Rate"
          value={`${data.exception_rate}%`}
          sub="Flagged for critical audit"
          icon={<AlertTriangle size={16} />}
          variant="red"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="border-b-4 border-black bg-gray-50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">
              Volume by Business Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
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
                      border: "4px solid black",
                      borderRadius: "0",
                      fontWeight: "bold",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categoryVolume.map((c: any, i: number) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-xs font-bold"
                >
                  <div
                    className="w-3 h-3"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  ></div>
                  <span className="uppercase">{c.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="border-b-4 border-black bg-gray-50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">
              Throughput by Vendor
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorVolume} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="vendor"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={100}
                    className="font-bold text-[10px] uppercase"
                  />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    contentStyle={{
                      border: "4px solid black",
                      borderRadius: "0",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar dataKey="count" fill="#000000" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Actionable Insights Table */}
        <div className="lg:col-span-2">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
            <CardHeader className="bg-yellow-50 border-b-4 border-black flex flex-row items-center gap-3">
              <AlertTriangle className="text-yellow-600" size={24} />
              <CardTitle className="text-yellow-900 text-sm font-bold uppercase tracking-widest">
                Lowest AI Performance by Vendor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-black uppercase bg-white border-b-2 border-dashed border-gray-300 font-bold">
                  <tr>
                    <th className="px-6 py-4">Vendor</th>
                    <th className="px-6 py-4">Total Invoices</th>
                    <th className="px-6 py-4">Exception Rate</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorVolume.map((v: any, idx: number) => (
                    <tr
                      key={v.vendor}
                      className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="px-6 py-4 font-bold text-lg">
                        {v.vendor}
                      </td>
                      <td className="px-6 py-4 font-mono">{v.count}</td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        {v.failure_rate}%
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-bold border-2 border-terminal-green bg-transparent text-terminal-green hover:bg-terminal-green hover:text-black text-xs uppercase"
                        >
                          Review_Vendor
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {vendorVolume.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-400 font-bold uppercase"
                      >
                        No exception data available
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
  variant = "default",
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  variant?: "default" | "green" | "red";
  trend?: "up" | "down";
}) {
  const bgMap = {
    default: "bg-white",
    green: "bg-green-50",
    red: "bg-red-50",
  };
  const borderMap = {
    default: "bg-gray-100",
    green: "bg-green-100",
    red: "bg-red-100",
  };
  const textMap = {
    default: "text-gray-500",
    green: "text-green-900",
    red: "text-red-700",
  };

  return (
    <Card
      className={`shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black ${bgMap[variant]}`}
    >
      <CardHeader
        className={`${borderMap[variant]} border-b-4 border-black pb-2`}
      >
        <CardTitle
          className={`text-xs font-bold uppercase tracking-widest flex items-center justify-between ${textMap[variant]}`}
        >
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div
          className={`text-5xl font-black tracking-tighter ${variant === "red" ? "text-red-700" : "text-black"}`}
        >
          {value}
        </div>
        <div
          className={`text-xs font-bold mt-2 ${variant === "green" ? "text-green-800" : "text-gray-500"}`}
        >
          {sub}
        </div>
      </CardContent>
    </Card>
  );
}
