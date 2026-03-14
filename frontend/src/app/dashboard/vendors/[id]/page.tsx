"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Zap, Landmark, CheckCircle, Percent } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function VendorProfilePage() {
  const params = useParams();
  const id = params.id as string;

  // Mock Vendor Data
  const vendorName = id === "VND-001" ? "Acme Corp" : `Vendor ${id}`;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white border-b-4 border-black pb-6 -mt-2">
        <Link href="/dashboard/vendors">
          <Button
            variant="ghost"
            size="sm"
            className="border-2 border-black hover:bg-gray-100 p-2 h-auto text-black"
          >
            <ChevronLeft size={24} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            {vendorName}
          </h1>
          <p className="text-gray-500 font-mono text-sm tracking-wider">
            ID: {id} • Standing: Good
          </p>
        </div>
      </div>

      {/* AI Behavioral Alert */}
      <div className="bg-yellow-50 border-4 border-yellow-500 p-6 flex gap-4 text-yellow-900 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)]">
        <Zap className="flex-shrink-0 text-yellow-600 mt-1" size={32} />
        <div className="flex-1">
          <h4 className="font-bold uppercase tracking-wider text-lg mb-2">
            Ghost AI Discovery
          </h4>
          <p className="font-medium text-base mb-4">
            Based on the previous 14 invoices from {vendorName}, the system has
            learned that they consistently apply an <b>18% Tax Rate</b> for
            "Software" category items, not the default 0%.
          </p>
          <div className="flex gap-4">
            <Button className="font-bold bg-yellow-600 hover:bg-yellow-700 text-white flex gap-2 border-yellow-800">
              <CheckCircle size={18} /> ACCEPT AI SUGGESTION
            </Button>
            <Button
              variant="outline"
              className="font-bold border-yellow-800 text-yellow-900 hover:bg-yellow-100"
            >
              DISMISS
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Settings */}
        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
          <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
            <Landmark size={24} />
            <CardTitle>Master File Configuration</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  Default Category
                </label>
                <Input
                  defaultValue="Software"
                  className="font-bold h-12 border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  Default Tax Rate (%)
                </label>
                <Input
                  defaultValue="0"
                  type="number"
                  className="font-bold font-mono text-blue-700 h-12 border-2 border-black bg-blue-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                Tax Registration Number
              </label>
              <Input
                defaultValue="US-123456789"
                className="font-bold font-mono h-12 border-2 border-black"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                Payment Terms (Days)
              </label>
              <Input
                defaultValue="Net 30"
                className="font-bold h-12 border-2 border-black"
              />
            </div>

            <div className="pt-4 border-t-2 border-dashed border-gray-300">
              <Button className="w-full font-bold uppercase tracking-widest bg-black text-white hover:bg-gray-800">
                SAVE MASTER FILE
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Ledger Data */}
        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-t-8 border-blue-600">
          <CardHeader className="bg-gray-50 border-b-4 border-black">
            <CardTitle>Recent Ledger History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-black uppercase bg-gray-100 border-b-2 border-black font-bold">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                <tr className="border-b border-gray-200 bg-white">
                  <td className="px-6 py-4 font-bold">
                    <Link
                      href="/dashboard/invoices/INV-10042"
                      className="text-blue-600 hover:underline"
                    >
                      INV-10042
                    </Link>
                  </td>
                  <td className="px-6 py-4">2023-10-25</td>
                  <td className="px-6 py-4 font-bold text-terminal-cyan">
                    <CurrencyDisplay amount={1650} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] uppercase font-bold text-yellow-600 tracking-wider border border-yellow-600 px-1 py-0.5 bg-yellow-50">
                      Pending
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="px-6 py-4 font-bold">
                    <Link
                      href="/dashboard/invoices/INV-09881"
                      className="text-blue-600 hover:underline"
                    >
                      INV-09881
                    </Link>
                  </td>
                  <td className="px-6 py-4">2023-09-25</td>
                  <td className="px-6 py-4 font-bold text-terminal-cyan">
                    <CurrencyDisplay amount={1650} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">
                      Paid via ERP
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 bg-white">
                  <td className="px-6 py-4 font-bold">
                    <Link
                      href="/dashboard/invoices/INV-08422"
                      className="text-blue-600 hover:underline"
                    >
                      INV-08422
                    </Link>
                  </td>
                  <td className="px-6 py-4">2023-08-25</td>
                  <td className="px-6 py-4 font-bold text-terminal-cyan">
                    <CurrencyDisplay amount={1650} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">
                      Paid via ERP
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
