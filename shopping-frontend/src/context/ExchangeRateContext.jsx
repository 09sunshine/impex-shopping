import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const ExchangeRateContext = createContext(null);

export function ExchangeRateProvider({ children }) {
  const [rate, setRate] = useState(130.98); // Initial sensible live rate
  const [rateDetails, setRateDetails] = useState({
    rate_usd_htg: 130.98,
    provider: 'live',
    is_live: true,
    last_updated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRate = useCallback(async (refresh = false) => {
    try {
      setLoading(true);
      const data = await api.getExchangeRate(refresh);
      if (data && data.rate_usd_htg && typeof data.rate_usd_htg === 'number') {
        setRate(data.rate_usd_htg);
        setRateDetails(data);
        setError(null);
      }
    } catch (err) {
      console.warn('[ExchangeRate] Failed to fetch live rate from backend, using fallback:', err?.message || err);
      setError(err?.message || 'Failed to fetch rate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRate();
    // Periodically refresh every 15 minutes to stay accurate
    const interval = setInterval(() => {
      fetchRate(true);
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRate]);

  const toHtg = useCallback((usdAmount) => {
    const num = Number(usdAmount || 0);
    return Math.round(num * rate);
  }, [rate]);

  const formatHtg = useCallback((usdAmount) => {
    const htg = toHtg(usdAmount);
    return `${htg.toLocaleString()} HTG`;
  }, [toHtg]);

  const formatUsdWithHtg = useCallback((usdAmount) => {
    const num = Number(usdAmount || 0);
    return `$${num.toFixed(2)} USD (~${formatHtg(num)})`;
  }, [formatHtg]);

  const rateText = `1 USD ≈ ${rate.toFixed(2)} HTG`;

  const value = {
    rate,
    rateDetails,
    loading,
    error,
    toHtg,
    formatHtg,
    formatUsdWithHtg,
    rateText,
    refreshRate: () => fetchRate(true),
  };

  return (
    <ExchangeRateContext.Provider value={value}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRate() {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    const fallbackRate = 130.98;
    return {
      rate: fallbackRate,
      rateDetails: { rate_usd_htg: fallbackRate, is_live: true },
      loading: false,
      error: null,
      toHtg: (usd) => Math.round(Number(usd || 0) * fallbackRate),
      formatHtg: (usd) => `${Math.round(Number(usd || 0) * fallbackRate).toLocaleString()} HTG`,
      formatUsdWithHtg: (usd) => `$${Number(usd || 0).toFixed(2)} USD (~${Math.round(Number(usd || 0) * fallbackRate).toLocaleString()} HTG)`,
      rateText: `1 USD ≈ ${fallbackRate.toFixed(2)} HTG`,
      refreshRate: () => {},
    };
  }
  return context;
}
