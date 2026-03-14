"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Plus,
  Trash2,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface MonitoredEmail {
  id: number;
  email_address: string;
  description: string;
  is_active: boolean;
}

export default function EmailIntakePage() {
  const [emails, setEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const { showToast, showConfirm } = useToast();

  const fetchEmails = async () => {
    try {
      const res = await api.get("/email-intake/monitored-emails");
      setEmails(res.data);
    } catch (err) {
      console.error("Failed to fetch monitored emails", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleAddEmail = async () => {
    if (!newEmail.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    try {
      await api.post("/email-intake/monitored-emails", {
        email_address: newEmail,
        description: newDesc,
      });
      showToast(`${newEmail} added to monitoring list.`, "success");
      setNewEmail("");
      setNewDesc("");
      setIsAdding(false);
      fetchEmails();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to add email", "error");
    }
  };

  const handleRemoveEmail = async (id: number, email_address: string) => {
    const confirmed = await showConfirm(
      `Stop monitoring ${email_address}? System will no longer process forwarded invoices from this address.`,
    );
    if (!confirmed) return;
    try {
      await api.delete(`/email-intake/monitored-emails/${id}`);
      showToast(`Removed ${email_address} from monitoring.`, "info");
      fetchEmails();
    } catch (err) {
      showToast("Failed to remove email", "error");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    showToast("Starting manual email sync...", "info");
    try {
      const res = await api.post("/email-intake/sync");
      showToast(res.data.message || "Email sync completed.", "success");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Email sync failed.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center border-b border-terminal-cyan/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-terminal-cyan flex items-center gap-3">
            <Mail size={24} /> INTAKE_ROUTING
          </h1>
          <p className="text-[10px] text-terminal-cyan/60 font-bold uppercase mt-1 tracking-widest">
            Finance OS // System Email Intake Configuration
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            className="border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 px-6 font-bold tracking-widest uppercase flex items-center gap-2"
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "SYNCING..." : "SYNC_NOW"}
          </Button>
          <Button
            onClick={() => setIsAdding(true)}
            className="bg-terminal-cyan text-black hover:bg-cyan-200 border-none px-6 font-bold tracking-widest uppercase flex items-center gap-2"
          >
            <Plus size={18} /> REGISTER_INBOX
          </Button>
        </div>
      </div>

      {/* Setup Instructions Card */}
      <div className="border-2 border-terminal-cyan bg-terminal-cyan/5 p-6 font-mono text-terminal-cyan">
        <h3 className="font-bold flex items-center gap-2 mb-3 text-lg uppercase tracking-wider">
          <HelpCircle size={20} /> How Intake Routing Works
        </h3>
        <p className="text-sm mb-4 text-terminal-cyan/80">
          The Finance OS watches ONE centralized master inbox securely. To
          process invoices sent to other addresses (like{" "}
          <code>billing@yourcompany.com</code>), configure them to{" "}
          <strong>auto-forward</strong> to the master inbox.
        </p>
        <div className="grid grid-cols-3 gap-4 text-xs font-bold uppercase tracking-widest mt-6">
          <div className="border border-terminal-cyan/30 p-4 bg-black">
            <span className="text-terminal-amber mr-2">STEP 1</span>
            Register the source email below
          </div>
          <div className="border border-terminal-cyan/30 p-4 bg-black">
            <span className="text-terminal-amber mr-2">STEP 2</span>
            Log into the source email provider
          </div>
          <div className="border border-terminal-cyan/30 p-4 bg-black">
            <span className="text-terminal-amber mr-2">STEP 3</span>
            Setup auto-forwarding to Master Inbox
          </div>
        </div>
      </div>

      {/* Main List */}
      <Card className="rounded-none border-2 border-terminal-cyan bg-terminal-panel text-terminal-cyan">
        <CardContent className="p-0 mt-0 bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-[#111] text-xs uppercase border-b-2 border-terminal-cyan font-bold text-terminal-cyan/70">
                <tr>
                  <th className="px-6 py-4">Source Address</th>
                  <th className="px-6 py-4">Description / Alias</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-terminal-cyan/50 tracking-widest animate-pulse"
                    >
                      Loading Registered Inboxes...
                    </td>
                  </tr>
                ) : emails.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-terminal-cyan/50 tracking-widest"
                    >
                      No inboxes registered yet.
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr
                      key={email.id}
                      className="border-b border-[#333] hover:bg-terminal-cyan/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-terminal-cyan flex items-center gap-2">
                        <Mail size={16} className="text-terminal-cyan/50" />
                        {email.email_address}
                      </td>
                      <td className="px-6 py-4 text-terminal-cyan/80">
                        {email.description || (
                          <span className="text-terminal-cyan/30 italic">
                            No description
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase border border-terminal-green text-terminal-green bg-terminal-green/10">
                          <ShieldCheck size={12} /> LISTENING
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveEmail(email.id, email.email_address)
                          }
                          className="hover:bg-terminal-red/20 text-terminal-red hover:text-terminal-red"
                          title="Remove from monitoring list"
                        >
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

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-terminal-bg border-2 border-terminal-cyan p-6 w-[500px] shadow-[0_0_30px_rgba(0,255,255,0.2)] font-mono text-terminal-cyan">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 uppercase tracking-widest border-b-2 border-terminal-cyan pb-2">
              <Plus size={24} /> Register Source Inbox
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1 block">
                  Email Address to Monitor
                </label>
                <input
                  autoFocus
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. accounts-payable@yourcompany.com"
                  className="w-full h-12 bg-black border border-terminal-cyan px-4 text-terminal-cyan outline-none focus:border-white placeholder:text-terminal-cyan/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1 block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Main global billing inbox"
                  className="w-full h-12 bg-black border border-terminal-cyan px-4 text-terminal-cyan outline-none focus:border-white placeholder:text-terminal-cyan/30"
                />
              </div>

              <div className="p-4 mt-6 border border-terminal-amber/50 bg-terminal-amber/5 text-terminal-amber text-xs leading-relaxed">
                <strong>CRITICAL:</strong> After adding this address, you must
                log into its mail client and configure it to automatically
                forward emails with attachments to the Finance OS Master Inbox.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button
                onClick={() => setIsAdding(false)}
                variant="outline"
                className="border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan hover:text-black rounded-none h-10 px-6 font-bold tracking-widest"
              >
                CANCEL
              </Button>
              <Button
                onClick={handleAddEmail}
                className="bg-terminal-cyan text-black hover:bg-cyan-200 rounded-none h-10 px-6 font-bold tracking-widest"
              >
                SAVE_INBOX
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
