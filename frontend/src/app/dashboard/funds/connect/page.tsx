"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  Link2, 
  RefreshCw, 
  AlertTriangle, 
  Building2, 
  ChevronRight, 
  CloudLightning,
  X,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface BankConnection {
  id: number;
  institution_name: string;
  status: string;
  last_sync: string | null;
  created_at: string;
}

export default function BankConnectPage() {
  const { showToast } = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") {
      showToast("Institution linked successfully via Salt Edge!", "success");
      fetchConnections();
    }
  }, [status]);

  const handleLaunchSaltEdge = async () => {
    setIsLinking(true);
    try {
      const { data } = await api.post("/bank-sync/create-connect-session");
      if (data.connect_url) {
        window.location.href = data.connect_url;
      }
    } catch (error) {
      showToast("Failed to initialize Salt Edge session.", "error");
    } finally {
      setIsLinking(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const { data } = await api.get("/bank-sync/connections");
      setConnections(data);
    } catch (error) {
      console.error("Failed to fetch connections", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/bank-sync/sync-all");
      showToast(`Sync complete! Fetched ${data.new_transactions} new transactions.`, "success");
      fetchConnections();
    } catch (error) {
      showToast("Sync failed. Check connection health.", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 font-mono max-w-5xl mx-auto">
      {/* Breadcrumb / Navigation */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-terminal-green/40">
        <Link href="/dashboard/funds" className="hover:text-terminal-green transition-colors">Funds_Management</Link>
        <ChevronRight size={10} />
        <span className="text-terminal-green">Connectivity_Center</span>
      </div>

      {/* Header Section */}
      <div className="bg-terminal-panel border-2 border-terminal-green p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Link2 size={120} />
        </div>
        
        <div className="relative z-10 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-bold uppercase tracking-[0.2em] text-terminal-green flex items-center gap-4">
                    <CloudLightning size={32} className="text-terminal-amber" />
                    Bank_Link_Core
                </h1>
                <p className="text-terminal-green/60 uppercase tracking-widest text-xs mt-4 max-w-md leading-relaxed">
                    Secure encrypted bridge to 12,000+ financial institutions. 
                    Real-time transaction intake and balance verification.
                </p>
            </div>
            <div className="flex flex-col gap-3">
                <Button 
                    onClick={() => setShowLinkModal(true)}
                    className="bg-terminal-green text-black border-2 border-terminal-green hover:bg-green-400 font-bold uppercase tracking-widest text-xs px-8 py-6"
                >
                    <Plus size={16} className="mr-2" /> Link_New_Institution
                </Button>
                <button 
                  onClick={handleSyncAll}
                  disabled={syncing || connections.length === 0}
                  className="bg-transparent border-2 border-terminal-amber text-terminal-amber hover:bg-terminal-amber hover:text-black font-bold uppercase tracking-widest text-xs px-8 py-2 transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Intaking_Data..." : "Intake_New_Transactions"}
                </button>
            </div>
        </div>
      </div>

      {/* Status Hub */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border-2 border-terminal-green p-4 flex items-center gap-4">
            <div className={`p-3 rounded-full ${connections.length > 0 ? 'bg-terminal-green/20' : 'bg-gray-800'}`}>
                <ShieldCheck size={20} className={connections.length > 0 ? "text-terminal-green" : "text-gray-600"} />
            </div>
            <div>
                <div className="text-[10px] text-terminal-green/40 uppercase font-black">Bridge_Status</div>
                <div className="text-sm font-bold text-terminal-green">{connections.length > 0 ? "STABLE" : "DISCONNECTED"}</div>
            </div>
        </div>
        <div className="bg-black border-2 border-terminal-green p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-terminal-cyan/20">
                <RefreshCw size={20} className="text-terminal-cyan" />
            </div>
            <div>
                <div className="text-[10px] text-terminal-green/40 uppercase font-black">Connected_Items</div>
                <div className="text-sm font-bold text-terminal-cyan">{connections.length} Items</div>
            </div>
        </div>
        <div className="bg-black border-2 border-terminal-green p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-terminal-amber/20">
                <AlertTriangle size={20} className="text-terminal-amber" />
            </div>
            <div>
                <div className="text-[10px] text-terminal-green/40 uppercase font-black">Sync_Auth_Health</div>
                <div className="text-sm font-bold text-terminal-amber">{connections.every(c => c.status === 'ACTIVE') ? "100%" : "ATTENTION REQ"}</div>
            </div>
        </div>
      </div>

      {/* Connection List */}
      <div className="bg-black border-2 border-terminal-green min-h-[400px]">
        <div className="bg-terminal-green/10 p-4 border-b-2 border-terminal-green flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-terminal-green">Active_Encryption_Bridges</h2>
        </div>
        
        {loading ? (
             <div className="flex flex-col items-center justify-center p-20 animate-pulse">
                <RefreshCw className="animate-spin text-terminal-green mb-4" size={32} />
                <span className="text-terminal-green/40 font-bold uppercase text-[10px]">Authenticating_Access_Tokens...</span>
             </div>
        ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <Link2 className="text-terminal-green/10 mb-6" size={80} />
                <div className="text-terminal-green/40 font-bold uppercase text-xs mb-2">No_Active_Bridges_Found</div>
                <p className="text-[10px] text-terminal-green/20 max-w-xs uppercase">Link your corporate bank accounts to automate bookkeeping, cash forecasting, and account reconciliation.</p>
                <Button 
                    onClick={() => setShowLinkModal(true)}
                    className="mt-8 border-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black bg-transparent uppercase font-bold text-[10px]"
                >
                    Initialize_Linking_Module
                </Button>
            </div>
        ) : (
            <div className="divide-y-2 divide-terminal-green/10">
                {connections.map((conn) => (
                    <div key={conn.id} className="p-6 flex justify-between items-center group hover:bg-terminal-green/[0.02]">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 border-2 border-terminal-green flex items-center justify-center bg-black">
                                <Building2 size={24} className="text-terminal-green" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-terminal-green uppercase tracking-wider">{conn.institution_name}</h3>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-terminal-green/60 uppercase">
                                        <div className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                                        Bridge_{conn.status}
                                    </span>
                                    <span className="text-[10px] font-bold text-terminal-green/30 uppercase italic">
                                        Last_Sync: {conn.last_sync ? new Date(conn.last_sync).toLocaleString() : "NEVER"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button className="text-[10px] font-bold uppercase tracking-widest text-terminal-green/50 hover:text-terminal-green">Manage_Accounts</button>
                             <button className="text-[10px] font-bold uppercase tracking-widest text-terminal-amber/50 hover:text-terminal-amber underline">Remove_Bridge</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Manual Fallback Warning */}
      <div className="bg-terminal-amber/5 border-2 border-dashed border-terminal-amber/30 p-6 flex items-start gap-4">
        <AlertTriangle className="text-terminal-amber shrink-0" size={20} />
        <div>
            <h4 className="text-xs font-bold text-terminal-amber uppercase tracking-widest mb-1">Manual_Sync_Fallback</h4>
            <p className="text-[10px] text-terminal-amber/60 uppercase leading-relaxed max-w-2xl">
                If your institution does not support real-time bridge connectivity, you can manually upload encrypted CSV or MT940 bank statements.
            </p>
            <button className="mt-4 text-[10px] font-bold text-terminal-amber hover:underline uppercase tracking-tighter">Enter_Import_Terminal_{">"}</button>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md p-6">
            <div className="bg-terminal-bg border-4 border-terminal-green p-8 w-full max-w-xl shadow-[20px_20px_0px_0px_rgba(0,255,136,0.1)] relative">
                {isLinking && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-1 w-full bg-terminal-green/10 mb-8 border border-terminal-green/20 overflow-hidden">
                            <div className="h-full bg-terminal-green animate-[terminal-progress_2s_infinite]" />
                        </div>
                        <h3 className="text-xl font-bold text-terminal-green uppercase tracking-[0.3em] mb-4">Initializing_Secure_Handshake</h3>
                        <p className="text-xs text-terminal-green/60 uppercase tracking-widest animate-pulse leading-loose">
                            Negotiating OAuth scope...<br/>
                            Encrypting Session Keys...<br/>
                            Verifying Bank Certificate Authority...
                        </p>
                    </div>
                )}

                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-terminal-green uppercase tracking-[0.2em] flex items-center gap-3">
                        <Link2 size={24} /> New_Institution_Link
                    </h2>
                    <button 
                        onClick={() => setShowLinkModal(false)}
                        className="text-terminal-green hover:text-white transition-colors"
                    >
                        <X size={32} />
                    </button>
                </div>

                <div className="space-y-6">
                    <p className="text-sm font-bold text-terminal-green/60 uppercase tracking-widest text-center py-4">
                        YOU ARE ABOUT TO INITIALIZE A SECURE BRIDGE VIA SALT EDGE. 
                        YOU WILL BE REDIRECTED TO THEIR SECURE DASHBOARD TO LINK YOUR BANK.
                    </p>
                    
                    <Button 
                        onClick={handleLaunchSaltEdge}
                        disabled={isLinking}
                        className="w-full bg-terminal-green text-black border-2 border-terminal-green hover:bg-green-400 font-bold uppercase tracking-[0.2em] py-8 text-lg"
                    >
                        {isLinking ? "INITIALIZING_SESSION..." : "LAUNCH_SECURE_SALT_EDGE_LINK"}
                    </Button>

                    <div className="mt-8 pt-8 border-t-2 border-terminal-green/10 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] text-terminal-green/40 uppercase font-black">
                             <ShieldCheck size={14} /> SOC2_TYPE_II_COMPLIANT
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-terminal-green/40 uppercase font-black">
                             <Link2 size={14} /> AES_256_ENCRYPTED_TUNNEL
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes terminal-progress {
                        0% { transform: translateX(-100%); width: 30%; }
                        50% { transform: translateX(100%); width: 60%; }
                        100% { transform: translateX(300%); width: 30%; }
                    }
                `}</style>
            </div>
        </div>
      )}
    </div>
  );
}
