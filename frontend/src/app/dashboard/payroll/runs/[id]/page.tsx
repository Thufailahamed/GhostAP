"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, TrendingUp, DollarSign, Wallet, ArrowLeft, Terminal } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function PayrollRunDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { showToast } = useToast();
    const [run, setRun] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchRunDetails = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/payroll/runs`);
            // Find the specific run from the list (backend doesn't have a single GET run_id yet, but I can add it if needed)
            const data = res.data.find((r: any) => r.id === parseInt(id as string));
            setRun(data);
        } catch (err) {
            console.error("Failed to fetch run details:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRunDetails();
    }, [id]);

    const handleProcess = async () => {
        setIsProcessing(true);
        try {
            await api.post(`/payroll/runs/${id}/process`);
            showToast("Payroll Processed: Journal entries posted to General Ledger.", "success");
            fetchRunDetails();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Could not process payroll", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="text-terminal-green font-mono p-8 text-center animate-pulse">DISK_READ_IN_PROGRESS...</div>;
    if (!run) return <div className="text-terminal-red font-mono p-8 text-center">ERROR: RUN_NOT_FOUND</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" onClick={() => router.push("/dashboard/payroll")} className="text-terminal-green hover:bg-terminal-green/10">
                        <ArrowLeft size={18} />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
                            PAYROLL_BATCH: {run.run_number}
                        </h1>
                        <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
                            Sequence Status: <span className="text-terminal-green">[{run.status}]</span> // Cycle: {new Date(run.period_start).toLocaleDateString()} - {new Date(run.period_end).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                {run.status === 'DRAFT' && (
                    <Button
                        onClick={handleProcess}
                        disabled={isProcessing}
                        className="bg-terminal-cyan text-black hover:bg-terminal-cyan-dark font-black px-8"
                    >
                        {isProcessing ? "[POSTING_TO_LEDGER...]" : "POST_TO_LEDGER + EXECUTE"}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="border border-terminal-green/30 bg-terminal-panel p-4 flex flex-col">
                    <span className="text-[10px] font-bold text-terminal-green/40 mb-1 uppercase tracking-widest">Total Gross Pay</span>
                    <span className="text-2xl font-bold text-terminal-green"><CurrencyDisplay amount={run.total_gross} /></span>
                </div>
                <div className="border border-terminal-red/30 bg-terminal-panel p-4 flex flex-col">
                    <span className="text-[10px] font-bold text-terminal-red/40 mb-1 uppercase tracking-widest">Tax Deductions</span>
                    <span className="text-2xl font-bold text-terminal-red"><CurrencyDisplay amount={run.total_tax} /></span>
                </div>
                <div className="border border-terminal-cyan/30 bg-terminal-panel p-4 flex flex-col">
                    <span className="text-[10px] font-bold text-terminal-cyan/40 mb-1 uppercase tracking-widest">Total Net Disbursement</span>
                    <span className="text-2xl font-bold text-terminal-cyan"><CurrencyDisplay amount={run.total_net} /></span>
                </div>
                <div className="border border-terminal-amber/30 bg-terminal-panel p-4 flex flex-col">
                    <span className="text-[10px] font-bold text-terminal-amber/40 mb-1 uppercase tracking-widest">Ledger Entries</span>
                    <span className="text-sm font-bold text-terminal-amber mt-2 uppercase tracking-tighter">
                        {run.journal_id ? `Synced: JE-${run.journal_id}` : "Pending Sync"}
                    </span>
                </div>
            </div>

            <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
                <CardHeader className="border-b-2 border-terminal-green bg-black/40">
                    <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                        <TrendingUp size={16} /> BATCH_PAY_SLIPS_MANIFEST
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase border-b border-terminal-green font-bold text-terminal-green/40">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4 text-right">Gross Pay</th>
                                <th className="px-6 py-4 text-right">Income Tax</th>
                                <th className="px-6 py-4 text-right">Net Pay</th>
                                <th className="px-6 py-4 text-center">Payment Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {run.pay_slips.map((slip: any) => (
                                <tr key={slip.id} className="border-b border-terminal-green/10 hover:bg-terminal-green/5 transition-colors font-mono font-bold">
                                    <td className="px-6 py-4 uppercase">{slip.employee?.first_name} {slip.employee?.last_name}</td>
                                    <td className="px-6 py-4 text-right"><CurrencyDisplay amount={slip.gross_pay} /></td>
                                    <td className="px-6 py-4 text-right text-terminal-red/80"><CurrencyDisplay amount={slip.tax_deductions} /></td>
                                    <td className="px-6 py-4 text-right text-terminal-cyan"><CurrencyDisplay amount={slip.net_pay} /></td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 border text-[10px] ${slip.is_paid ? 'border-terminal-green text-terminal-green' : 'border-terminal-amber text-terminal-amber'}`}>
                                            {slip.is_paid ? 'PAID' : 'PENDING'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <div className="border border-terminal-cyan/20 bg-black/40 p-6 flex gap-6 items-start">
                <Terminal size={40} className="text-terminal-cyan opacity-50 shrink-0" />
                <div className="space-y-4 flex-1">
                    <h3 className="text-xs font-bold text-terminal-cyan uppercase tracking-widest border-b border-terminal-cyan/20 pb-2">Ledger_Journal_Projection</h3>
                    <div className="grid grid-cols-2 gap-8 text-[11px] font-mono">
                        <div className="space-y-2">
                            <span className="text-terminal-cyan/60"># DEBIT_ACCOUNT</span>
                            <div className="flex justify-between border-b border-terminal-green/10 pb-1">
                                <span>Wages & Salaries Expense</span>
                                <span className="text-terminal-green tracking-widest"><CurrencyDisplay amount={run.total_gross} /></span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <span className="text-terminal-cyan/60"># CREDIT_ACCOUNT</span>
                            <div className="flex justify-between border-b border-terminal-red/10 pb-1">
                                <span>Wages Payable</span>
                                <span className="text-terminal-red tracking-widest"><CurrencyDisplay amount={run.total_net} /></span>
                            </div>
                            <div className="flex justify-between border-b border-terminal-red/10 pb-1">
                                <span>Payroll Tax Payable</span>
                                <span className="text-terminal-red tracking-widest"><CurrencyDisplay amount={run.total_tax} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
