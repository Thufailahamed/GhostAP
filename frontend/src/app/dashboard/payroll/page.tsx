"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, CreditCard, Plus, Play, CheckCircle, Clock } from "lucide-react";
import api from "@/lib/api";
import { CurrencyDisplay } from "@/components/ui/currency-display";

export default function PayrollDashboard() {
    const [runs, setRuns] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [runsRes, empRes] = await Promise.all([
                    api.get("/payroll/runs"),
                    api.get("/payroll/employees")
                ]);
                setRuns(runsRes.data || []);
                setEmployees(empRes.data || []);
            } catch (err) {
                console.error("Failed to fetch payroll data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
                        STAFF_PAYROLL_CONTROL
                    </h1>
                    <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
                        Finance OS // Workforce Compensation & Ledger Sync
                    </p>
                </div>
                <div className="flex gap-4">
                    <Link href="/dashboard/payroll/employees">
                        <Button variant="outline" className="border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan hover:text-black">
                            MANAGE_EMPLOYEES
                        </Button>
                    </Link>
                    <Link href="/dashboard/payroll/runs/new">
                        <Button className="bg-terminal-green text-black hover:bg-terminal-green-dark">
                            + NEW_PAYROLL_RUN
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-terminal-green/40 bg-terminal-panel p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold uppercase text-[10px] tracking-widest text-terminal-green/50">
                            TOTAL_EMPLOYEES
                        </h3>
                        <Users size={18} className="text-terminal-green opacity-40" />
                    </div>
                    <div className="text-2xl font-bold tracking-widest text-terminal-green">
                        {employees.length}
                    </div>
                    <p className="text-[10px] text-terminal-green/30 mt-1 uppercase">Active Workforce</p>
                </div>

                <div className="border border-terminal-cyan/40 bg-terminal-panel p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold uppercase text-[10px] tracking-widest text-terminal-cyan/50">
                            NEXT_PAY_DATE
                        </h3>
                        <Clock size={18} className="text-terminal-cyan opacity-40" />
                    </div>
                    <div className="text-2xl font-bold tracking-widest text-terminal-cyan">
                        {runs[0]?.period_end ? new Date(runs[0].period_end).toLocaleDateString() : "TBD"}
                    </div>
                    <p className="text-[10px] text-terminal-cyan/30 mt-1 uppercase">Upcoming Run</p>
                </div>

                <div className="border border-terminal-amber/40 bg-terminal-panel p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold uppercase text-[10px] tracking-widest text-terminal-amber/50">
                            YEAR_TO_DATE_GIVING
                        </h3>
                        <CreditCard size={18} className="text-terminal-amber opacity-40" />
                    </div>
                    <div className="text-2xl font-bold tracking-widest text-terminal-amber">
                        <CurrencyDisplay amount={runs.reduce((acc, run) => acc + (run.status === 'PAID' ? run.total_gross : 0), 0)} />
                    </div>
                    <p className="text-[10px] text-terminal-amber/30 mt-1 uppercase">Total Disbursed</p>
                </div>
            </div>

            <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
                <CardHeader className="border-b-2 border-terminal-green">
                    <CardTitle className="flex items-center gap-2">
                        <Play size={18} /> RECENT_PAYROLL_RUNS
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase border-b border-terminal-green font-bold text-terminal-green/60 bg-black/20">
                            <tr>
                                <th className="px-6 py-3">Run ID</th>
                                <th className="px-6 py-3">Period</th>
                                <th className="px-6 py-3 text-right">Gross Pay</th>
                                <th className="px-6 py-3 text-right">Net Pay</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Ledger Sync</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-terminal-amber font-bold uppercase">
                                        No payroll data found. Start a new run to begin.
                                    </td>
                                </tr>
                            ) : (
                                runs.map((run) => (
                                    <tr key={run.id} className="border-b border-terminal-green/10 hover:bg-terminal-green/5 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold">{run.run_number}</td>
                                        <td className="px-6 py-4">
                                            {new Date(run.period_start).toLocaleDateString()} - {new Date(run.period_end).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <CurrencyDisplay amount={run.total_gross} />
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <CurrencyDisplay amount={run.total_net} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold border ${run.status === 'PAID' ? 'border-terminal-green text-terminal-green' :
                                                    run.status === 'PROCESSED' ? 'border-terminal-cyan text-terminal-cyan' :
                                                        'border-terminal-amber text-terminal-amber'
                                                }`}>
                                                {run.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {run.journal_id ? (
                                                <CheckCircle size={16} className="text-terminal-green mx-auto" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border border-terminal-green/30 mx-auto" />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/dashboard/payroll/runs/${run.id}`}>
                                                <Button variant="outline" size="sm" className="border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black text-xs">
                                                    VIEW
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
