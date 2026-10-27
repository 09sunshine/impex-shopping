import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  translations,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  STORAGE_KEY,
  getTranslation,
} from '../i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch {
      // LocalStorage access issues fallback to DEFAULT_LANGUAGE
    }
    return DEFAULT_LANGUAGE;
  });

  // Keep html lang attribute in sync
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // No-op in non-browser env
    }
  }, [language]);

  const setLanguage = useCallback((code) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key, params = {}) => {
      let text = getTranslation(language, key);
      if (typeof text !== 'string') return text ?? key;

      // Handle variable interpolation: {name}
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return text;
    },
    [language]
  );

  const currentLanguageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: SUPPORTED_LANGUAGES,
      currentLanguageInfo,
    }),
    [language, setLanguage, t, currentLanguageInfo]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

export function useTranslation() {
  const { t, language, setLanguage, languages, currentLanguageInfo } = useLanguage();
  return { t, language, setLanguage, languages, currentLanguageInfo };
}
