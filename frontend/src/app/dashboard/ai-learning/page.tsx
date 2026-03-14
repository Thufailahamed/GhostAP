"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BrainCircuit,
  Cpu,
  Zap,
  Search,
  Target,
  TrendingDown,
} from "lucide-react";

import { useState, useEffect } from "react";
import api from "@/lib/api";

export default function AILearningPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAIMetrics = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/analytics/ai-metrics");
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch AI metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAIMetrics();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-terminal-cyan animate-pulse font-mono uppercase tracking-widest">
          Scanning Neural Ghost Networks...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">
            AI Core Diagnostics
          </h1>
          <p className="text-gray-300 font-medium">
            Deep dive into OCR extraction accuracy, common failure fields, and
            training feedback loops.
          </p>
        </div>
        <Button className="font-bold text-md tracking-wider bg-blue-600 border-2 border-blue-600 hover:bg-transparent hover:border-white flex gap-2 text-white font-mono">
          <Zap size={20} /> FORCE_RETRAIN_MODEL
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Model Status & Accuracy */}
        <div className="space-y-8">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-blue-50 border-4 border-blue-900">
            <CardHeader className="bg-blue-100 border-b-4 border-blue-900 pb-2 flex flex-row items-center gap-3">
              <BrainCircuit size={24} className="text-blue-900" />
              <CardTitle className="text-blue-900">
                Model: Ghost-AP-v2.1
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 text-blue-900">
              <div className="mb-6">
                <div className="text-sm font-bold uppercase tracking-widest mb-1">
                  Global Confidence Score
                </div>
                <div className="text-6xl font-black tracking-tighter">
                  {data.global_confidence}%
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase mb-1">
                    <span>English Contexts</span>
                    <span>98%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 border border-blue-900">
                    <div className="bg-blue-900 h-full w-[98%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase mb-1">
                    <span>Multi-Currency Parsing</span>
                    <span>{Math.round(data.global_confidence * 0.9)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 border border-blue-900">
                    <div className="bg-blue-900 h-full w-[88%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase mb-1">
                    <span>Handwritten Fields</span>
                    <span>{Math.round(data.global_confidence * 0.45)}%</span>
                  </div>
                  <div className="w-full bg-red-200 h-2 border border-red-900">
                    <div className="bg-red-600 h-full w-[42%]"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
            <CardHeader className="bg-gray-50 border-b-4 border-black pb-2 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase">
                <Cpu size={16} /> Latest Training Weights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-sm">
              <div className="flex justify-between border-b-2 border-dashed border-gray-200 pb-2">
                <span className="font-bold text-gray-500">Last Retrained</span>
                <span className="font-bold text-black">
                  {data.last_trained} 08:00 UTC
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-200 pb-2">
                <span className="font-bold text-gray-500">Model Version</span>
                <span className="font-bold text-blue-600">
                  {data.model_version}
                </span>
              </div>
              <div className="flex justify-between border-gray-200 pb-1">
                <span className="font-bold text-gray-500">Status</span>
                <span className="font-bold text-green-600 uppercase tracking-widest">
                  Active_Standby
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Error Contexts */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
            <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
              <TrendingDown size={24} />
              <CardTitle>Frequent Extraction Failures</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-black uppercase bg-gray-100 border-b-2 border-black font-bold">
                  <tr>
                    <th className="px-6 py-4">Database Field</th>
                    <th className="px-6 py-4">Human Correction Rate</th>
                    <th className="px-6 py-4">AI Diagnostic Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fields.map((f: any) => (
                    <tr
                      key={f.field}
                      className="border-b border-gray-200 bg-white"
                    >
                      <td className="px-6 py-4 font-bold font-mono">
                        {f.field}
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        {f.correction_rate}%
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {f.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black bg-purple-50">
            <CardHeader className="bg-purple-100 border-b-4 border-purple-900 border-black flex flex-row items-center gap-3">
              <Target size={24} className="text-purple-900" />
              <CardTitle className="text-purple-900">
                Suggested Feedback Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 text-purple-900 space-y-4">
              <p className="text-sm font-medium mb-2 text-purple-800">
                Based on recent accountant edits, the Assistant suggests
                implementing these hardcoded pre-processing rules before AI
                extraction:
              </p>
              <div className="bg-white border-2 border-purple-900 p-4 font-mono text-sm flex justify-between items-center group">
                <span>
                  Rule: ALWAYS SET `Tax=0` IF `Vendor=Cloud Services LLC`
                </span>
                <Button
                  size="sm"
                  className="bg-purple-900 font-bold tracking-widest text-xs hover:bg-purple-800"
                >
                  ENACT
                </Button>
              </div>
              <div className="bg-white border-2 border-purple-900 p-4 font-mono text-sm flex justify-between items-center group">
                <span>Rule: STRIP_SPACES() FROM `Tax_Registration_ID`</span>
                <Button
                  size="sm"
                  className="bg-purple-900 font-bold tracking-widest text-xs hover:bg-purple-800"
                >
                  ENACT
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
