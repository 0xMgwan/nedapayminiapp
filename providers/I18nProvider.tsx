'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeI18n = async () => {
      if (!i18n.isInitialized) {
        try {
          // Import translation files dynamically
          const [enTranslations, swTranslations] = await Promise.all([
            import('../locales/en.json'),
            import('../locales/sw.json')
          ]);

          const savedLanguage = localStorage.getItem('nedapay-language') || 'en';
          
          await i18n
            .use(initReactI18next)
            .init({
              resources: {
                en: {
                  translation: enTranslations.default
                },
                sw: {
                  translation: swTranslations.default
                }
              },
              lng: savedLanguage,
              fallbackLng: 'en',
              interpolation: {
                escapeValue: false
              },
              debug: process.env.NODE_ENV === 'development'
            });
          
          setIsInitialized(true);
        } catch (error) {
          console.error('Failed to initialize i18n:', error);
          setIsInitialized(true); // Still render children even if i18n fails
        }
      } else {
        setIsInitialized(true);
      }
    };

    initializeI18n();
  }, []);

  if (!isInitialized) {
    return <div>{children}</div>; // Render children without i18n while loading
  }

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
