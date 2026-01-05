import React, { createContext, useContext, useState, ReactNode } from 'react';

type Currency = 'VND' | 'USD';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (amount: number) => string;
}

interface CurrencyProviderProps {
  children: ReactNode;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  // Default is VND as requested
  const [currency, setCurrency] = useState<Currency>('VND');

  const formatPrice = (amount: number) => {
    if (currency === 'VND') {
       // Values in DB are now real VND (e.g., 25000, 40000)
       return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }
    // Convert VND to USD (approx 25000 VND = 1 USD)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 25000);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};