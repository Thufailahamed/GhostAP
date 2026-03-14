"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

export interface CompanySettings {
  company_name: string;
  base_currency: string;
  fiscal_year_start_month: number;
}

interface SettingsContextType {
  settings: CompanySettings | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get("/settings/");
      setSettings(res.data);
      setError(null);
    } catch (err) {
      setError("Failed to load settings");
      console.error("Settings fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return React.createElement(
    SettingsContext.Provider,
    { value: { settings, loading, error, refreshSettings: fetchSettings } },
    children
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // Note: In a real app we might want to throw an error, 
    // but for this hybrid refactor we'll return a stable object
    return { settings: null, loading: true, error: null, refreshSettings: async () => {} };
  }
  return context;
}
