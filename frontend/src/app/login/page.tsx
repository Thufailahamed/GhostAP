"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LogIn, UserPlus, ShieldAlert, Monitor } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Google authentication failed.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("✅ Activation email sent! Please check your inbox.");
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-mono select-none">
      {/* Terminal Container */}
      <div className="w-full max-w-md border-2 border-terminal-green bg-black p-1 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
        {/* Header Bar */}
        <div className="flex items-center justify-between bg-terminal-green px-4 py-1 mb-6">
          <div className="flex items-center gap-2 text-black font-black uppercase text-xs">
            <Monitor size={14} />
            <span>Auth_Kernel_v1.0</span>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-black opacity-30" />
            <div className="w-2 h-2 bg-black opacity-30" />
            <div className="w-2 h-2 bg-black" />
          </div>
        </div>

        <div className="px-6 pb-8 pt-2">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black text-terminal-green uppercase tracking-tighter mb-2">
              Payable Ghost
            </h1>
            <p className="text-[10px] text-terminal-green/50 uppercase tracking-widest font-bold">
              Secure Terminal Access // Finance OS
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-terminal-green/70 uppercase tracking-widest mb-1.5 block">
                  User_Identity
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-terminal-green">{"->"}</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ENTER_EMAIL_ADDR..."
                    className="w-full bg-black border border-terminal-green/30 px-10 py-3 text-terminal-green outline-none focus:border-terminal-green placeholder:text-terminal-green/20 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-terminal-green/70 uppercase tracking-widest mb-1.5 block">
                  Access_Key
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-terminal-green">{"->"}</span>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ENTER_TOKEN..."
                    className="w-full bg-black border border-terminal-green/30 px-10 py-3 text-terminal-green outline-none focus:border-terminal-green placeholder:text-terminal-green/20 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-terminal-red/10 border border-terminal-red p-3 flex items-start gap-3 animate-pulse">
                <ShieldAlert
                  size={16}
                  className="text-terminal-red shrink-0 mt-0.5"
                />
                <p className="text-[10px] font-bold text-terminal-red uppercase leading-tight">
                  Error_Code: {error}
                </p>
              </div>
            )}

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-terminal-green text-black font-black py-3 uppercase tracking-widest text-sm hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <span className="animate-pulse">AUTHENTICATING...</span>
                ) : (
                  <>
                    {mode === "login" ? (
                      <LogIn size={18} />
                    ) : (
                      <UserPlus size={18} />
                    )}
                    {mode === "login"
                      ? "INITIALIZE_SESSION"
                      : "REGISTER_IDENTITY"}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-black border-2 border-terminal-green text-terminal-green font-black py-3 uppercase tracking-widest text-sm hover:bg-terminal-green hover:text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Monitor size={18} />
                <span>CONTINUE_WITH_GOOGLE</span>
              </button>
            </div>
          </form>

          <div className="mt-8 flex items-center justify-between border-t border-terminal-green/10 pt-4">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-[10px] font-bold text-terminal-green/40 hover:text-terminal-green uppercase tracking-widest transition-colors"
            >
              {mode === "login"
                ? "New_Access_Required?"
                : "Already_Registered?"}
            </button>
            <div className="text-[9px] text-terminal-green/20 font-bold uppercase select-none">
              Encryption_Active: AES_256
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-[10px] text-terminal-green/20 font-bold uppercase tracking-[0.3em]">
        © 2026 Antigravity // Finance_Operating_System
      </div>
    </div>
  );
}
