"use client";

import { useSettings } from "@/hooks/use-settings";

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showCode?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ 
  amount, 
  currency, 
  className = "", 
  showCode = false 
}) => {
  const { settings } = useSettings();
  const activeCurrency = currency || settings?.base_currency || "USD";

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: activeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <span className={className}>
      {formatted} {showCode && <span className="text-[0.8em] opacity-60 ml-1">{currency}</span>}
    </span>
  );
};
