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
        className="flex items-center space-x-0.5 px-1 py-0.5 rounded bg-slate-800/60 backdrop-blur-sm hover:bg-slate-700/60 transition-all duration-300"
        aria-label={t('common.language')}
      >
        <span className="text-[10px]">{currentLanguage.flag}</span>
        <span className="text-[10px] font-bold text-white">
          {currentLanguage.initials}
        </span>
        <ChevronDownIcon className={`w-2 h-2 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-1 w-20 bg-slate-900/95 backdrop-blur-xl rounded shadow-xl border border-slate-600/40 z-20">
            <div className="py-0.5">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full text-left px-1.5 py-1 text-[10px] hover:bg-slate-700/60 transition-colors duration-150 flex items-center space-x-1 ${
                    currentLanguage.code === language.code 
                      ? 'bg-blue-500/20 text-blue-300 font-semibold' 
                      : 'text-white hover:text-blue-300'
                  }`}
                >
                  <span className="text-[10px]">{language.flag}</span>
                  <span className="font-bold">{language.initials}</span>
                  {currentLanguage.code === language.code && (
                    <span className="text-blue-400 ml-auto text-[8px]">✓</span>
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
