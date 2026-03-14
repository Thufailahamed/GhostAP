"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, History, Eye, ShieldAlert, Cpu } from "lucide-react";

const mockAuditTrail: any[] = [];

export default function AuditLogsPage() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">
            Financial Audit Logs
          </h1>
          <p className="text-gray-300 font-medium">
            Immutable ledger of AI decisions, human corrections, and system
            changes.
          </p>
        </div>
        <Button className="font-bold text-md tracking-wider bg-terminal-green text-black hover:bg-terminal-green/80 border-2 border-terminal-green flex gap-2">
          EXPORT CSV
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 flex items-center border-4 border-black bg-white px-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-y-0 hover:translate-y-[4px] hover:translate-x-[4px] transition-all">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH LOGS (INV #, USER, ACTION)..."
            className="w-full h-12 bg-transparent outline-none px-4 font-bold uppercase text-sm placeholder:text-gray-400"
          />
        </div>
        <Button className="h-[56px] border-2 border-terminal-green bg-terminal-panel text-terminal-green hover:bg-terminal-green hover:text-black transition-colors flex items-center gap-2">
          <Filter size={20} />
          ACTOR TYPE
        </Button>
      </div>

      <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
        <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
          <History size={24} />
          <CardTitle>System Activity Ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-black uppercase bg-gray-100 border-b-2 border-black font-bold">
                <tr>
                  <th scope="col" className="px-6 py-4">
                    Timestamp (UTC)
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Actor
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Action Event
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Target Context
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Detailed Payload
                  </th>
                  <th scope="col" className="px-6 py-4 text-center">
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockAuditTrail.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-200 hover:bg-gray-50 bg-white"
                  >
                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-6 py-4 font-bold flex items-center gap-2">
                      {log.type === "AI" && (
                        <Cpu size={16} className="text-blue-600" />
                      )}
                      {log.type === "SYSTEM" && (
                        <ShieldAlert size={16} className="text-purple-600" />
                      )}
                      {log.type === "HUMAN" && (
                        <Eye size={16} className="text-green-600" />
                      )}
                      {log.user}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border ${
                          log.type === "AI"
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : log.type === "SYSTEM"
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : "bg-green-50 border-green-200 text-green-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-black">
                      {log.target}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {log.details}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-bold border-2 border-terminal-green h-8 text-xs bg-transparent text-terminal-green hover:bg-terminal-green hover:text-black"
                      >
                        DIFF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
