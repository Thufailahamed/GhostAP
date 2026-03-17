"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Calendar, Hash, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export default function NewPayrollRunPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        run_number: `PR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        period_start: "",
        period_end: "",
        payment_date: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post("/payroll/runs", formData);
            showToast("Run Initialized: Draft payroll run created.", "success");
            router.push(`/dashboard/payroll/runs/${res.data.id}`);
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Could not start payroll run", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-terminal-green flex items-center justify-center gap-4">
                    <Play size={28} /> INIT_PAYROLL_SEQUENCE
                </h1>
                <p className="text-xs text-terminal-amber font-bold uppercase tracking-widest">
                    Finance OS // Sequence Initialization Protocol
                </p>
            </div>

            <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
                <CardHeader className="border-b-2 border-terminal-green bg-black/40">
                    <CardTitle className="text-sm font-bold uppercase">Configuration_Parameters</CardTitle>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
                                <Hash size={12} /> Sequence_Identifier (Run Number)
                            </label>
                            <Input
                                required
                                value={formData.run_number}
                                onChange={(e) => setFormData({ ...formData, run_number: e.target.value })}
                                className="bg-black border-terminal-green/30 text-terminal-green focus:border-terminal-green font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
                                    <Calendar size={12} /> Cycle_Start
                                </label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.period_start}
                                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                                    className="bg-black border-terminal-green/30 text-terminal-green focus:border-terminal-green font-mono invert-colors-scheme"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
                                    <Calendar size={12} /> Cycle_End
                                </label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.period_end}
                                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                                    className="bg-black border-terminal-green/30 text-terminal-green focus:border-terminal-green font-mono invert-colors-scheme"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
                                <Calendar size={12} /> Disbursement_Date (Optional)
                            </label>
                            <Input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                className="bg-black border-terminal-green/30 text-terminal-green focus:border-terminal-green font-mono invert-colors-scheme"
                            />
                        </div>

                        <div className="pt-6 border-t border-terminal-green/10 flex flex-col gap-4">
                            <div className="p-4 bg-terminal-amber/5 border border-terminal-amber/20 text-terminal-amber text-[10px] leading-relaxed">
                                <span className="font-bold">SYSTEM_NOTE:</span> INITIALIZING THIS SEQUENCE WILL AUTOMATICALLY GENERATE DRAFT PAY SLIPS FOR ALL ACTIVE PERSONNEL REGISTERED IN THE WORKFORCE_DATABASE. YOU WILL BE ABLE TO REVIEW AND ADJUST BEFORE POSTING TO LEDGER.
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-terminal-green text-black hover:bg-terminal-green-dark font-black tracking-[0.2em] h-14"
                            >
                                {isLoading ? "[EXECUTING...]" : "INITIALIZE_CYCLE >>"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
