'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from '../locales/en.json';
import sw from '../locales/sw.json';

const resources = {
  en: {
    translation: en
  },
  sw: {
    translation: sw
  }
};

if (typeof window !== 'undefined') {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en', // default language
      fallbackLng: 'en',
      
      interpolation: {
        escapeValue: false // react already does escaping
      },
      
      // Enable debug mode for development
      debug: process.env.NODE_ENV === 'development'
    });
}

export default i18n;
