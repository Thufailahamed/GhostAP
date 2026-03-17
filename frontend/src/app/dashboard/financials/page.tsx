"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { FileBarChart, RefreshCw, Calendar, Download } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function FinancialsPage() {
  const [activeTab, setActiveTab] = useState<"PNL" | "BAL" | "CASH">("PNL");
  const [pnlData, setPnlData] = useState<any>(null);
  const [balData, setBalData] = useState<any>(null);
  const [cashData, setCashData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "PNL") {
        const res = await api.get("/financials/pnl");
        setPnlData(res.data);
      } else if (activeTab === "BAL") {
        const res = await api.get("/financials/balance-sheet");
        setBalData(res.data);
      } else {
        const res = await api.get("/financials/cash-flow");
        setCashData(res.data);
      }
    } catch (err) {
      console.error(`Failed to fetch ${activeTab}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [activeTab]);

  const { settings } = useSettings();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings?.base_currency || "USD",
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-8 pb-12 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)] border-4 border-black">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <FileBarChart size={28} className="text-terminal-green" />
            Standard Financial Reports
          </h1>
          <p className="text-gray-300 font-bold mt-1 text-sm uppercase tracking-widest">
            Unalterable Ledger Aggregations.
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => fetchFinancials()}
            disabled={isLoading}
            className="font-bold text-xs tracking-widest bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black flex gap-2 uppercase"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Sync_Ledger
          </Button>
          <Button className="font-bold text-xs tracking-widest bg-white text-black hover:bg-gray-200 border-2 border-white flex gap-2 uppercase">
            <Download size={16} /> Export_CSV
          </Button>
        </div>
      </div>

      {/* Report Controls */}
      <div className="flex items-center gap-6 border-b-2 border-terminal-green pb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveTab("PNL")}
            className={`px-4 lg:px-6 py-2 font-bold uppercase tracking-widest border-2 transition-all text-xs lg:text-base ${
              activeTab === "PNL"
                ? "bg-terminal-green text-black border-terminal-green"
                : "bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green/20"
            }`}
          >
            [ Profit & Loss ]
          </button>
          <button
            onClick={() => setActiveTab("BAL")}
            className={`px-4 lg:px-6 py-2 font-bold uppercase tracking-widest border-2 transition-all text-xs lg:text-base ${
              activeTab === "BAL"
                ? "bg-terminal-green text-black border-terminal-green"
                : "bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green/20"
            }`}
          >
            [ Balance Sheet ]
          </button>
          <button
            onClick={() => setActiveTab("CASH")}
            className={`px-4 lg:px-6 py-2 font-bold uppercase tracking-widest border-2 transition-all text-xs lg:text-base ${
              activeTab === "CASH"
                ? "bg-terminal-green text-black border-terminal-green"
                : "bg-transparent text-terminal-green border-terminal-green hover:bg-terminal-green/20"
            }`}
          >
            [ Cash Flow ]
          </button>
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center gap-2 border-2 border-terminal-green p-2 text-terminal-green font-bold text-xs uppercase tracking-widest whitespace-nowrap">
          <Calendar size={14} />
          <span>PERIOD:</span>
          <select className="bg-transparent text-terminal-green outline-none border-b border-terminal-green border-dashed pb-1 cursor-pointer font-bold">
            <option className="bg-black text-terminal-green" value="ytd">
              Year to Date (YTD)
            </option>
            <option className="bg-black text-terminal-green" value="last_month">
              Last Month
            </option>
            <option className="bg-black text-terminal-green" value="all_time">
              All Time
            </option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-terminal-green animate-pulse font-bold text-lg uppercase tracking-widest border-2 border-terminal-green p-4 inline-block">
            {"> "}Compiling Ledger Data...
          </div>
        </div>
      ) : activeTab === "PNL" && pnlData ? (
        <ProfitAndLossReport data={pnlData} formatFn={formatCurrency} />
      ) : activeTab === "BAL" && balData ? (
        <BalanceSheetReport data={balData} formatFn={formatCurrency} />
      ) : activeTab === "CASH" && cashData ? (
        <CashFlowReport data={cashData} formatFn={formatCurrency} />
      ) : (
        <div className="text-center text-terminal-amber font-bold p-8 border-2 border-dashed border-terminal-amber">
          NO DATA FOUND FOR CURRENT PERIOD
        </div>
      )}
    </div>
  );
}

function ProfitAndLossReport({
  data,
  formatFn,
}: {
  data: any;
  formatFn: (v: number) => string;
}) {
  return (
    <Card className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
      <CardHeader className="bg-gray-100 border-b-4 border-black pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-widest flex justify-between items-center">
          <span>Statement of Profit & Loss</span>
          <span className="text-sm font-bold text-gray-500">ACCRUAL BASIS</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-8 py-6 space-y-6">
          {/* REVENUES */}
          <div>
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 border-b-2 border-dashed border-gray-300 pb-1">
              Ordinary Income / Revenue
            </h3>
            <div className="space-y-1 pl-4">
              {data.revenues?.map((r: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                >
                  <span>{r.name}</span>
                  <CurrencyDisplay amount={r.balance} />
                </div>
              ))}
              {data.revenues?.length === 0 && (
                <div className="text-sm text-gray-400 font-bold italic py-1">
                  No revenue recorded
                </div>
              )}
            </div>
            <div className="flex justify-between font-black text-lg border-t-2 border-black mt-2 pt-2">
              <span className="uppercase">Total Revenue</span>
              <CurrencyDisplay amount={data.total_revenue} />
            </div>
          </div>

          {/* EXPENSES */}
          <div>
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 border-b-2 border-dashed border-gray-300 pb-1">
              Expenses
            </h3>
            <div className="space-y-1 pl-4">
              {data.expenses?.map((e: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                >
                  <span>{e.name}</span>
                  <CurrencyDisplay amount={e.balance} />
                </div>
              ))}
              {data.expenses?.length === 0 && (
                <div className="text-sm text-gray-400 font-bold italic py-1">
                  No expenses recorded
                </div>
              )}
            </div>
            <div className="flex justify-between font-black text-lg border-t-2 border-black mt-2 pt-2">
              <span className="uppercase">Total Expenses</span>
              <CurrencyDisplay amount={data.total_expense} />
            </div>
          </div>

          {/* NET INCOME */}
          <div className="mt-8 pt-4 border-t-4 border-black bg-gray-50 p-4">
            <div className="flex justify-between font-black text-2xl uppercase">
              <span>Net Income</span>
              <span
                className={
                  data.net_income >= 0 ? "text-green-700" : "text-red-700"
                }
              >
                <CurrencyDisplay amount={data.net_income} />
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceSheetReport({
  data,
  formatFn,
}: {
  data: any;
  formatFn: (v: number) => string;
}) {
  return (
    <Card className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
      <CardHeader className="bg-gray-100 border-b-4 border-black pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-widest flex justify-between items-center">
          <span>Statement of Financial Position (Balance Sheet)</span>
          <span className="text-sm font-bold text-gray-500">ACCRUAL BASIS</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-8 py-6 space-y-8">
          {/* ASSETS */}
          <div>
            <h3 className="text-base font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1">
              Assets
            </h3>
            <div className="space-y-1 pl-4">
              {data.assets?.map((a: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                >
                  <span>{a.name}</span>
                  <CurrencyDisplay amount={a.balance} />
                </div>
              ))}
              {data.assets?.length === 0 && (
                <div className="text-sm text-gray-400 font-bold italic py-1">
                  No assets recorded
                </div>
              )}
            </div>
            <div className="flex justify-between font-black text-lg border-t-2 border-black mt-2 pt-2">
              <span className="uppercase">Total Assets</span>
              <CurrencyDisplay amount={data.total_assets} />
            </div>
          </div>

          {/* LIABILITIES AND EQUITY SECTION */}
          <div>
            <h3 className="text-base font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1">
              Liabilities & Equity
            </h3>

            {/* Liabilities */}
            <div className="pl-4 mb-4">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                Liabilities
              </h4>
              <div className="space-y-1 pl-4">
                {data.liabilities?.map((l: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                  >
                    <span>{l.name}</span>
                    <CurrencyDisplay amount={l.balance} />
                  </div>
                ))}
                {data.liabilities?.length === 0 && (
                  <div className="text-sm text-gray-400 font-bold italic py-1">
                    No liabilities recorded
                  </div>
                )}
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-gray-300 mt-2 pt-1 pl-4">
                <span className="uppercase text-gray-600">
                  Total Liabilities
                </span>
                <CurrencyDisplay amount={data.total_liabilities} />
              </div>
            </div>

            {/* Equity */}
            <div className="pl-4">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                Equity
              </h4>
              <div className="space-y-1 pl-4">
                {data.equity?.map((e: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                  >
                    <span>{e.name}</span>
                    <CurrencyDisplay amount={e.balance} />
                  </div>
                ))}
                {data.equity?.length === 0 && (
                  <div className="text-sm text-gray-400 font-bold italic py-1">
                    No equity recorded
                  </div>
                )}
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-gray-300 mt-2 pt-1 pl-4">
                <span className="uppercase text-gray-600">Total Equity</span>
                <CurrencyDisplay amount={data.total_equity} />
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="flex justify-between font-black text-lg border-t-2 border-black mt-6 pt-2">
              <span className="uppercase">Total Liabilities & Equity</span>
              <CurrencyDisplay amount={data.total_liabilities_and_equity} />
            </div>
          </div>

          {/* BALANCING CHECK */}
          <div className="mt-4 flex items-center justify-between text-xs font-bold font-mono tracking-widest px-4 border-2 border-dashed border-gray-300 py-2 bg-gray-50">
            <span className="text-gray-500">LEDGER BALANCE CHECK</span>
            {Math.abs(data.total_assets - data.total_liabilities_and_equity) <
            0.01 ? (
              <span className="text-green-600">OK [ MATCH ]</span>
            ) : (
              <span className="text-red-600 animate-pulse">
                ERR [ MISMATCH:{" "}
                {formatFn(
                  data.total_assets - data.total_liabilities_and_equity,
                )}{" "}
                ]
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CashFlowReport({
  data,
  formatFn,
}: {
  data: any;
  formatFn: (v: number) => string;
}) {
  return (
    <Card className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
      <CardHeader className="bg-gray-100 border-b-4 border-black pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-widest flex justify-between items-center">
          <span>Statement of Cash Flows</span>
          <span className="text-sm font-bold text-gray-500">INDIRECT METHOD</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-8 py-6 space-y-8">
          {/* OPERATING ACTIVITIES */}
          <div>
            <h3 className="text-base font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1">
              Cash flows from operating activities
            </h3>
            <div className="space-y-1 pl-4">
              <div className="flex justify-between text-sm font-bold items-center py-1">
                <span>Net Income</span>
                <CurrencyDisplay amount={data.operating_activities.net_income} />
              </div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 mb-1">
                Adjustments to reconcile net income to net cash:
              </div>
              <div className="pl-4 space-y-1">
                {data.operating_activities.adjustments?.map((adj: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                  >
                    <span>{adj.name}</span>
                    <CurrencyDisplay amount={adj.amount} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between font-black text-sm border-t border-gray-300 mt-2 pt-1">
              <span className="uppercase">Net cash provided by operating activities</span>
              <CurrencyDisplay amount={data.operating_activities.total} />
            </div>
          </div>

          {/* INVESTING ACTIVITIES */}
          <div>
            <h3 className="text-base font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1">
              Cash flows from investing activities
            </h3>
            <div className="space-y-1 pl-4">
              {data.investing_activities.items?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                >
                  <span>{item.name}</span>
                  <CurrencyDisplay amount={item.amount} />
                </div>
              ))}
              {data.investing_activities.items?.length === 0 && (
                <div className="text-sm text-gray-400 font-bold italic py-1">
                  No investing activities recorded
                </div>
              )}
            </div>
            <div className="flex justify-between font-black text-sm border-t border-gray-300 mt-2 pt-1">
              <span className="uppercase">Net cash provided by (used in) investing activities</span>
              <CurrencyDisplay amount={data.investing_activities.total} />
            </div>
          </div>

          {/* FINANCING ACTIVITIES */}
          <div>
            <h3 className="text-base font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1">
              Cash flows from financing activities
            </h3>
            <div className="space-y-1 pl-4">
              {data.financing_activities.items?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm font-bold items-center py-1 hover:bg-gray-50"
                >
                  <span>{item.name}</span>
                  <CurrencyDisplay amount={item.amount} />
                </div>
              ))}
              {data.financing_activities.items?.length === 0 && (
                <div className="text-sm text-gray-400 font-bold italic py-1">
                  No financing activities recorded
                </div>
              )}
            </div>
            <div className="flex justify-between font-black text-sm border-t border-gray-300 mt-2 pt-1">
              <span className="uppercase">Net cash provided by (used in) financing activities</span>
              <CurrencyDisplay amount={data.financing_activities.total} />
            </div>
          </div>

          {/* SUMMARY SECTION */}
          <div className="mt-8 border-t-4 border-black pt-4 space-y-2">
            <div className="flex justify-between font-black text-lg border-b border-gray-200 pb-2">
              <span className="uppercase">Net increase in cash</span>
              <CurrencyDisplay amount={data.net_cash_increase} />
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span className="uppercase">Cash at beginning of period</span>
              <CurrencyDisplay amount={data.beginning_cash} />
            </div>
            <div className="flex justify-between font-black text-xl uppercase bg-black text-white p-4 mt-4">
              <span>Cash at end of period</span>
              <CurrencyDisplay amount={data.ending_cash} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
