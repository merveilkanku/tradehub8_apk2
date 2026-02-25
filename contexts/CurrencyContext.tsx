
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Currency } from '../types';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (price: number) => string;
  convertPrice: (priceInUSD: number) => number;
  cdfRate: number;
  setCdfRate: (rate: number) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Taux de change approximatifs par rapport au USD (Février 2026)
const EXCHANGE_RATES: Record<Currency, number> = {
  [Currency.USD]: 1,
  [Currency.EUR]: 0.92,
  [Currency.XAF]: 605,
  [Currency.XOF]: 605,
  [Currency.CDF]: 2800, // Valeur par défaut, sera surchargée par l'état
  [Currency.NGN]: 1500,
  [Currency.KES]: 145
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.XAF]: 'FCFA',
  [Currency.XOF]: 'FCFA',
  [Currency.CDF]: 'FC',
  [Currency.NGN]: '₦',
  [Currency.KES]: 'KSh'
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('tradehub_currency');
    return (saved as Currency) || Currency.USD;
  });

  const [cdfRate, setCdfRateState] = useState<number>(() => {
    const saved = localStorage.getItem('tradehub_cdf_rate');
    return saved ? Number(saved) : 2350;
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('tradehub_currency', c);
  };

  const setCdfRate = (rate: number) => {
    setCdfRateState(rate);
    localStorage.setItem('tradehub_cdf_rate', String(rate));
  };

  const convertPrice = (priceInUSD: number) => {
    if (currency === Currency.CDF) {
        return priceInUSD * cdfRate;
    }
    return priceInUSD * EXCHANGE_RATES[currency];
  };

  const formatPrice = (priceInUSD: number) => {
    const converted = convertPrice(priceInUSD);
    const symbol = CURRENCY_SYMBOLS[currency];
    
    // Formatage selon la monnaie
    if (currency === Currency.USD || currency === Currency.EUR) {
        return `${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
    }
    
    return `${Math.round(converted).toLocaleString()} ${symbol}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, convertPrice, cdfRate, setCdfRate }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};
