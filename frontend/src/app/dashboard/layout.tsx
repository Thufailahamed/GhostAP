"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Settings,
  LogOut,
  Mail,
  Users,
  ShieldAlert,
  TrendingUp,
  BrainCircuit,
  Lock as LockIcon,
  FolderTree,
  DollarSign,
  Wallet,
  FileBarChart,
  CheckSquare,
  BookDashed,
  Package,
  Box,
  Search,
  TrendingDown,
  Repeat,
  CreditCard,
  Target,
  ClipboardList
} from "lucide-react";
import { ToastProvider } from "@/components/ui/toast";
import CommandPalette from "@/components/CommandPalette";
import { SettingsProvider } from "@/hooks/use-settings";

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setDate(
        now
          .toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
          .toUpperCase(),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4 font-mono text-sm">
      <span className="text-terminal-green/50">{date}</span>
      <span className="text-terminal-green font-bold tracking-widest">
        {time}
      </span>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Helper to format path for terminal prompt
  const currentPath =
    pathname === "/dashboard"
      ? "dashboard"
      : pathname.split("/").filter(Boolean).pop() || "dashboard";

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-terminal-green">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-terminal-green border-t-transparent animate-spin" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
            Booting_Finance_OS...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ToastProvider>
      <SettingsProvider>
      <div className="min-h-screen flex bg-terminal-bg text-terminal-green">
        {/* Sidebar */}
        <aside className="w-64 h-screen border-r-2 border-terminal-green bg-terminal-panel flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 space-y-2">
            <div className="h-16 border-b-2 border-terminal-green flex items-center justify-center sticky top-0 bg-terminal-panel z-10">
              <h1 className="text-xl font-bold uppercase tracking-wider text-terminal-green">
                Ghost AP
              </h1>
            </div>
            <nav className="p-4 space-y-2">
              <div className="text-xs font-bold text-terminal-amber mb-2 mt-4 uppercase tracking-widest px-4">
                Workspace
              </div>
              <NavLink
                href="/dashboard"
                icon={<LayoutDashboard size={20} />}
                label="Dashboard"
              />
              <NavLink
                href="/dashboard/invoices"
                icon={<FileText size={20} />}
                label="All Invoices"
              />
              <NavLink
                href="/dashboard/receivables"
                icon={<DollarSign size={20} />}
                label="Receivables"
              />
              <NavLink
                href="/dashboard/customers"
                icon={<Users size={20} />}
                label="Customers"
              />
              <NavLink
                href="/dashboard/vendors"
                icon={<Users size={20} />}
                label="Vendors"
              />
              <NavLink
                href="/dashboard/purchase-orders"
                icon={<ClipboardList size={20} />}
                label="Purchase Orders"
              />
              <NavLink
                href="/dashboard/products"
                icon={<Package size={20} />}
                label="Product Catalog"
              />
              <NavLink
                href="/dashboard/inventory"
                icon={<Box size={20} />}
                label="Inventory"
              />
              <NavLink
                href="/dashboard/upload"
                icon={<Upload size={20} />}
                label="Upload"
              />

              <div className="text-xs font-bold text-terminal-amber mb-2 mt-6 uppercase tracking-widest px-4">
                Finance Core
              </div>
              <NavLink
                href="/dashboard/receivables"
                icon={<DollarSign size={20} />}
                label="Accounts Rec."
              />
              <NavLink
                href="/dashboard/funds"
                icon={<Wallet size={20} />}
                label="Funds Management"
              />
              <NavLink
                href="/dashboard/aging"
                icon={<TrendingDown size={20} />}
                label="AR Aging Report"
              />
              <NavLink
                href="/dashboard/categories"
                icon={<FolderTree size={20} />}
                label="Chart of Accounts"
              />
              <NavLink
                href="/dashboard/budgets"
                icon={<Target size={20} />}
                label="Budgeting"
              />
              <NavLink
                href="/dashboard/ledger"
                icon={<BookDashed size={20} />}
                label="General Ledger"
              />
              <NavLink
                href="/dashboard/reconciliation"
                icon={<CheckSquare size={20} />}
                label="Reconciliation"
              />
              <NavLink
                href="/dashboard/products"
                icon={<Package size={20} />}
                label="Products Catalog"
              />
              <NavLink
                href="/dashboard/recurring"
                icon={<Repeat size={20} />}
                label="Recurring Invoices"
              />
              <NavLink
                href="/dashboard/subscriptions"
                icon={<CreditCard size={20} />}
                label="Subscriptions"
              />

              <div className="text-xs font-bold text-terminal-amber mb-2 mt-6 uppercase tracking-widest px-4">
                Analytics
              </div>
              <NavLink
                href="/dashboard/reports"
                icon={<TrendingUp size={20} />}
                label="System Reports"
              />
              <NavLink
                href="/dashboard/ai-learning"
                icon={<BrainCircuit size={20} />}
                label="AI Diagnostics"
              />
              <NavLink
                href="/dashboard/cashflow"
                icon={<TrendingUp size={20} />}
                label="Cash Flow Forecast"
              />

              <div className="text-xs font-bold text-terminal-amber mb-2 mt-6 uppercase tracking-widest px-4">
                System
              </div>
              <NavLink
                href="/dashboard/email-intake"
                icon={<Mail size={20} />}
                label="Email Intake"
              />
              <NavLink
                href="/dashboard/users"
                icon={<Users size={20} />}
                label="Team & Roles"
              />
              <NavLink
                href="/dashboard/audit"
                icon={<ShieldAlert size={20} />}
                label="Audit Logs"
              />
              <NavLink
                href="/dashboard/security"
                icon={<LockIcon size={20} />}
                label="Security"
              />
              <NavLink
                href="/dashboard/settings"
                icon={<Settings size={20} />}
                label="Settings"
              />
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 border-b-2 border-terminal-green flex items-center justify-between px-8 bg-terminal-bg shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold uppercase text-terminal-green/60">
                Finance OS v1.0
              </h2>
              <span className="text-terminal-green/30">|</span>
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="text-terminal-amber">
                  {user?.email?.split("@")[0] || "guest"}@payable-ghost
                </span>
                <span className="text-terminal-green">:</span>
                <span className="text-terminal-cyan">~</span>
                <span className="text-terminal-green">$</span>
                <span className="text-terminal-green terminal-cursor ml-1 lowercase">
                  {currentPath}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setCmdPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-terminal-green/30 text-terminal-green/50 hover:text-terminal-green hover:border-terminal-green text-xs font-mono uppercase transition-colors"
              >
                <Search size={12} />
                <span>Search</span>
                <span className="text-[10px] border border-terminal-green/30 px-1 ml-1">
                  Ctrl+K
                </span>
              </button>
              <LiveClock />
              <div className="text-xs font-bold text-terminal-amber border border-terminal-amber px-2 py-1">
                LIFECYCLE: DEV
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto bg-terminal-bg p-8 custom-scrollbar">
            {children}
          </div>
          {/* Command Input Tray */}
          <div className="border-t-2 border-terminal-green bg-terminal-panel p-2 px-8 flex items-center gap-3">
            <span className="text-terminal-green font-bold text-sm select-none">
              {"->"}
            </span>
            <input
              type="text"
              placeholder="TYPE COMMAND (e.g. approve 31061)..."
              className="flex-1 bg-transparent border-none outline-none text-terminal-green font-mono text-sm placeholder:text-terminal-green/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement;
                  console.log("Executing command:", target.value);
                  target.value = "";
                }
              }}
            />
          </div>
          {/* Bottom Status Bar */}
          <footer className="h-8 border-t border-terminal-green/30 bg-terminal-panel flex items-center justify-between px-8 text-[10px] font-bold uppercase tracking-wider text-terminal-green/40 flex-shrink-0">
            <div className="flex gap-6">
              <span>SYS: ONLINE</span>
              <span>OCR: GHOST-AP-v2.1</span>
              <span>DB: SQLITE</span>
            </div>
            <div className="flex gap-6">
              <span>CONN: SECURE</span>
              <span>MODE: PRODUCTION</span>
              <span className="text-terminal-green/60 font-black">■ READY</span>
            </div>
          </footer>
        </main>
        <CommandPalette
          open={cmdPaletteOpen}
          onClose={() => setCmdPaletteOpen(false)}
        />
      </div>
      </SettingsProvider>
    </ToastProvider>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 border-2 border-transparent font-bold hover:bg-terminal-green hover:text-black transition-colors uppercase text-sm"
    >
      {icon}
      {label}
    </Link>
  );
}
