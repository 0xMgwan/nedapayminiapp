"use client";

import { useEffect } from "react";
import {
  Settings,
  HelpCircle,
  X,
  Globe,
  History,
  User,
} from "lucide-react";
import LanguageSwitcher from "../../components/LanguageSwitcher";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  authenticated: boolean;
  onOpenFAQ?: () => void;
  onOpenProfile?: () => void;
  onOpenTransactions?: () => void;
}

export default function Sidebar({ isOpen, onClose, authenticated, onOpenFAQ, onOpenProfile, onOpenTransactions }: SidebarProps) {
  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-indigo-900/60 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 bg-white rounded-l-2xl
        shadow-xl z-50 w-72 transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-blue-100">
          <h2 className="text-xl font-bold text-indigo-900">Menu</h2>
          <button
            onClick={onClose}
            className="text-blue-500 hover:text-indigo-600 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-2 h-[calc(100vh-80px)] overflow-y-auto pb-24">
          {/* Language Selector */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-slate-700 font-semibold">Language</span>
            </div>
            <LanguageSwitcher />
          </div>
          
          {/* Profile Section - When authenticated */}
          {authenticated && (
            <>
              <p className="text-xs text-slate-400 uppercase tracking-wider px-3 pt-2 font-semibold">Account</p>
              
              <button
                onClick={() => { onClose(); onOpenProfile?.(); }}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-all font-medium group w-full text-left"
              >
                <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 rounded-lg transition-colors">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <span className="block">My Profile</span>
                  <span className="text-xs text-slate-400">Volume & Stats</span>
                </div>
              </button>
              
              <button
                onClick={() => { onClose(); onOpenTransactions?.(); }}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-all font-medium group w-full text-left"
              >
                <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                  <History className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                </div>
                <div className="flex-1">
                  <span className="block">Transaction History</span>
                  <span className="text-xs text-slate-400">All transactions</span>
                </div>
              </button>
              
              <div className="border-t border-slate-200 my-4"></div>
            </>
          )}
          
          <p className="text-xs text-slate-400 uppercase tracking-wider px-3 pt-2 font-semibold">Support</p>
          
          {/* FAQ */}
          <button
            onClick={() => { onClose(); onOpenFAQ?.(); }}
            className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-all font-medium group w-full text-left"
          >
            <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-lg transition-colors">
              <HelpCircle className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
            </div>
            <span>FAQ</span>
          </button>
          
          {/* Settings - Always visible when authenticated */}
          {authenticated && (
            <>
              <div className="border-t border-slate-200 my-4"></div>
              
              <p className="text-xs text-slate-400 uppercase tracking-wider px-3 pt-2 font-semibold">Settings</p>
              
              <button
                onClick={() => { onClose(); /* Settings can stay as page or modal */ }}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-all font-medium group w-full text-left"
              >
                <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                </div>
                <span>App Settings</span>
              </button>
            </>
          )}
          
          {/* Version Info */}
          <div className="absolute bottom-6 left-0 right-0 p-4 text-center">
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-400 font-medium">NEDApay v1.0.0</p>
              <p className="text-xs text-slate-300">© 2024 NEDApay</p>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}