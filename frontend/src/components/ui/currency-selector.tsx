"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";

interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ 
  value, 
  onChange, 
  label = "Currency", 
  className = "" 
}) => {
  const [currencies, setCurrencies] = useState<string[]>(["USD", "EUR", "GBP", "INR", "CAD", "AED"]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const res = await api.get("/settings/exchange-rates");
        if (res.data?.popular) {
          setCurrencies(res.data.popular);
        }
      } catch (err) {
        console.error("Failed to fetch currencies", err);
      }
    };
    fetchCurrencies();
  }, []);

  return (
    <div className={className}>
      {label && <label className="block text-[10px] font-bold text-terminal-cyan uppercase mb-1">{label}</label>}
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-terminal-cyan p-2 text-terminal-cyan font-bold text-sm outline-none focus:border-white transition-colors uppercase cursor-pointer"
      >
        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
};
