"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Save, X, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        employee_id: "",
        role: "",
        salary_monthly: 0,
        currency: "USD",
    });

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/payroll/employees");
            setEmployees(res.data || []);
        } catch (err) {
            console.error("Failed to fetch employees:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/payroll/employees", formData);
            showToast("Employee Added: Worker profile created successfully.", "success");
            setIsAdding(false);
            setFormData({
                first_name: "",
                last_name: "",
                email: "",
                employee_id: "",
                role: "",
                salary_monthly: 0,
                currency: "USD",
            });
            fetchEmployees();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Failed to add employee", "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-terminal-green/30 pb-4">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-green">
                        WORKFORCE_DATABASE
                    </h1>
                    <p className="text-[10px] text-terminal-amber font-bold uppercase mt-1">
                        Registry of active personnel and compensation structures
                    </p>
                </div>
                {!isAdding && (
                    <Button
                        onClick={() => setIsAdding(true)}
                        className="bg-terminal-cyan text-black hover:bg-terminal-cyan/80 font-bold"
                    >
                        <Plus size={18} className="mr-2" /> ADD_NEW_EMPLOYEE
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel text-terminal-cyan mb-8">
                    <CardHeader className="border-b border-terminal-cyan/30">
                        <CardTitle className="text-sm font-bold uppercase flex justify-between items-center">
                            <span>CREATE_worker_PROFILE</span>
                            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="text-terminal-cyan hover:bg-terminal-cyan/10">
                                <X size={18} />
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Legal First Name</label>
                                <Input
                                    required
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Legal Last Name</label>
                                <Input
                                    required
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Corporate Email</label>
                                <Input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Employee ID / SKU</label>
                                <Input
                                    required
                                    placeholder="EMP-001"
                                    value={formData.employee_id}
                                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Job Role / title</label>
                                <Input
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase opacity-50">Monthly Net Salary (USD)</label>
                                <Input
                                    type="number"
                                    required
                                    value={formData.salary_monthly}
                                    onChange={(e) => setFormData({ ...formData, salary_monthly: parseFloat(e.target.value) })}
                                    className="bg-black border-terminal-cyan/30 text-terminal-cyan focus:border-terminal-cyan font-mono"
                                />
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-terminal-cyan/10">
                                <Button type="button" variant="outline" onClick={() => setIsAdding(false)} className="border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/5">
                                    CANCEL_ABORT
                                </Button>
                                <Button type="submit" className="bg-terminal-cyan text-black hover:bg-terminal-cyan/80 font-bold px-8">
                                    <Save size={18} className="mr-2" /> EXECUTE_SAVE
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card className="rounded-none border-2 border-terminal-green bg-terminal-panel text-terminal-green">
                <CardHeader className="border-b-2 border-terminal-green bg-black/20">
                    <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                        <Users size={18} /> ACTIVE_PERSONNEL_INDEX
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] uppercase border-b border-terminal-green font-bold text-terminal-green/50">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-right">Base Salary</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-terminal-amber font-mono text-xs">
                                            {isLoading ? "[LOADING_DATABASE_SHARDS...]" : "[ERROR: NO_RECORDS_FOUND]"}
                                        </td>
                                    </tr>
                                ) : (
                                    employees.map((emp) => (
                                        <tr key={emp.id} className="border-b border-terminal-green/10 hover:bg-terminal-green/5 transition-colors font-mono">
                                            <td className="px-6 py-4 text-terminal-cyan font-bold">{emp.employee_id}</td>
                                            <td className="px-6 py-4 uppercase font-bold">{emp.first_name} {emp.last_name}</td>
                                            <td className="px-6 py-4 text-terminal-green/60">{emp.email}</td>
                                            <td className="px-6 py-4 truncate max-w-[150px]">{emp.role}</td>
                                            <td className="px-6 py-4 text-right text-terminal-amber font-bold">
                                                {emp.salary_monthly.toLocaleString()} {emp.currency}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] text-terminal-green border border-terminal-green px-2 py-0.5">
                                                    ACTIVE
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" className="text-terminal-red hover:bg-terminal-red/10">
                                                    <Trash2 size={16} />
                                                </Button>
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
    );
}
