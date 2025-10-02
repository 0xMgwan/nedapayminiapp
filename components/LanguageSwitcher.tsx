'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const languages = [
  { code: 'en', name: 'English', initials: 'EN', flag: '🇺🇸' },
  { code: 'sw', name: 'Kiswahili', initials: 'SW', flag: '🇹🇿🇰🇪' }
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
    
    // Store language preference in localStorage
    localStorage.setItem('nedapay-language', languageCode);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-0.5 px-0.5 py-0.5 rounded hover:bg-white/10 transition-all duration-300"
        aria-label={t('common.language')}
      >
        <span className="text-xs">{currentLanguage.flag}</span>
        <span className="text-xs font-bold text-white">
          {currentLanguage.initials}
        </span>
        <ChevronDownIcon className={`w-2.5 h-2.5 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="py-1">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors duration-150 flex items-center space-x-2 ${
                    currentLanguage.code === language.code 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-slate-700 hover:text-blue-600'
                  }`}
                >
                  <span className="text-sm">{language.flag}</span>
                  <span className="font-medium">{language.initials}</span>
                  <span className="text-xs text-slate-500 ml-auto">{language.name}</span>
                  {currentLanguage.code === language.code && (
                    <span className="text-blue-500 text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
