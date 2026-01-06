import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { SupportedLocale } from './index';
import { initLocale, setLocale as persistLocale } from './index';

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, _setLocale] = useState<SupportedLocale>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const initial = await initLocale();
      _setLocale(initial);
      setReady(true);
    })();
  }, []);

  const value = useMemo(
      () => ({
        locale,
        setLocale: async (l: SupportedLocale) => {
          await persistLocale(l);
          _setLocale(l);
        },
      }),
      [locale]
  );

  if (!ready) return null;
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('LocaleProvider missing');
  return ctx;
}
