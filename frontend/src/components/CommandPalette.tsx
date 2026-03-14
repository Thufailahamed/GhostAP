"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  FileText,
  Upload,
  DollarSign,
  Wallet,
  BookDashed,
  ShieldAlert,
  Settings,
  Users,
  X,
  ArrowRight,
  FileBarChart,
} from "lucide-react";
import api from "@/lib/api";

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
  category: string;
}

const STATIC_COMMANDS: CommandItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={16} />,
    category: "Navigate",
  },
  {
    id: "invoices",
    label: "All Invoices",
    href: "/dashboard/invoices",
    icon: <FileText size={16} />,
    category: "Navigate",
  },
  {
    id: "upload",
    label: "Upload Invoice",
    href: "/dashboard/upload",
    icon: <Upload size={16} />,
    category: "Navigate",
  },
  {
    id: "receivables",
    label: "Receivables",
    href: "/dashboard/receivables",
    icon: <DollarSign size={16} />,
    category: "Navigate",
  },
  {
    id: "funds",
    label: "Funds Management",
    href: "/dashboard/funds",
    icon: <Wallet size={16} />,
    category: "Navigate",
  },
  {
    id: "ledger",
    label: "General Ledger",
    href: "/dashboard/ledger",
    icon: <BookDashed size={16} />,
    category: "Navigate",
  },
  {
    id: "reports",
    label: "Financial Reports",
    href: "/dashboard/financials",
    icon: <FileBarChart size={16} />,
    category: "Navigate",
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/dashboard/vendors",
    icon: <Users size={16} />,
    category: "Navigate",
  },
  {
    id: "audit",
    label: "Audit Logs",
    href: "/dashboard/audit",
    icon: <ShieldAlert size={16} />,
    category: "Navigate",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings size={16} />,
    category: "Navigate",
  },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<CommandItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      // Fetch invoices for dynamic search
      api
        .get("/invoices")
        .then((res) => {
          const items = res.data.slice(0, 50).map((inv: any) => ({
            id: `inv-${inv.id}`,
            label: `Invoice ${inv.invoice_number}`,
            subtitle: `${inv.vendor_name} · $${(inv.amount || 0).toFixed(2)} · ${inv.status}`,
            href: `/dashboard/invoices/${inv.id}`,
            icon: <FileText size={16} />,
            category: "Invoices",
          }));
          setInvoiceItems(items);
        })
        .catch(() => {});
    }
  }, [open]);

  const allItems = [...STATIC_COMMANDS, ...invoiceItems];

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase()),
      )
    : STATIC_COMMANDS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        navigate(filtered[selectedIndex].href);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {},
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-terminal-bg border-2 border-terminal-green shadow-[8px_8px_0px_0px_rgba(0,255,0,0.1)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-terminal-green/40">
          <Search size={18} className="text-terminal-green/50 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, invoices, vendors..."
            className="flex-1 bg-transparent outline-none text-terminal-green font-mono text-sm placeholder:text-terminal-green/30 uppercase"
          />
          <button
            onClick={onClose}
            className="text-terminal-green/40 hover:text-terminal-green"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-terminal-green/40 text-sm font-mono uppercase tracking-widest">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-terminal-amber/70 border-b border-terminal-green/10">
                  {category}
                </div>
                {items.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-terminal-green/10 ${
                        globalIdx === selectedIndex
                          ? "bg-terminal-green text-black"
                          : "text-terminal-green hover:bg-terminal-green/10"
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wider truncate">
                          {item.label}
                        </div>
                        {item.subtitle && (
                          <div
                            className={`text-[10px] font-mono truncate ${globalIdx === selectedIndex ? "text-black/60" : "text-terminal-green/50"}`}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      <ArrowRight
                        size={14}
                        className="flex-shrink-0 opacity-50"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-terminal-green/20 flex gap-4 text-[10px] font-mono text-terminal-green/30 uppercase tracking-widest">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
