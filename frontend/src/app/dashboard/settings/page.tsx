"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Building, Globe, Save, LogOut } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { CurrencySelector } from "@/components/ui/currency-selector";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { refreshSettings } = useSettings();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: "",
    base_currency: "USD",
    fiscal_year_start_month: 1
  });
  const { showToast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings/");
        setSettings(res.data);
      } catch (err) {
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/settings/", settings);
      await refreshSettings();
      showToast("Settings updated successfully", "success");
    } catch (err) {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 animate-pulse text-terminal-cyan font-mono uppercase tracking-widest">Loading_Configuration...</div>;
  }

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan">
            ORGANIZATION_SETTINGS
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // Core System Parameters
          </p>
        </div>
        <Button 
          onClick={() => signOut()}
          variant="outline"
          className="rounded-none border-terminal-red text-terminal-red hover:bg-terminal-red/10 uppercase font-bold text-[10px] tracking-widest"
        >
          <LogOut size={14} className="mr-2" /> EXIT_SESSION
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel">
          <CardHeader className="border-b border-terminal-cyan/20">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Building size={16} /> Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Company Name</label>
              <Input 
                value={settings.company_name} 
                onChange={(e) => setSettings({...settings, company_name: e.target.value})}
                className="bg-black border-terminal-cyan/50 text-terminal-cyan rounded-none"
                placeholder="Ex. ACME CORP"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel">
          <CardHeader className="border-b border-terminal-cyan/20">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} /> Financial Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <CurrencySelector 
                  value={settings.base_currency} 
                  onChange={(val) => setSettings({...settings, base_currency: val})}
                  label="Functional (Base) Currency"
                />
                <p className="text-[9px] text-terminal-cyan/40 mt-2 uppercase">This is the currency all reports (P&L, Balance Sheet) will be displayed in.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">Fiscal Year Start Month</label>
                <select 
                  value={settings.fiscal_year_start_month}
                  onChange={(e) => setSettings({...settings, fiscal_year_start_month: parseInt(e.target.value)})}
                  className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan uppercase font-bold text-sm"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={saving}
            className="bg-terminal-cyan text-black hover:bg-cyan-200 px-8 py-6 font-black uppercase tracking-[0.2em]"
          >
            {saving ? "SAVING..." : "COMMIT_CHANGES"} <Save size={18} className="ml-2" />
          </Button>
        </div>
      </form>
    </div>
  );
}
