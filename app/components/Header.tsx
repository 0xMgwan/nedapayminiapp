"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import {
  Settings,
  Sun,
  Moon,
  Zap,
  HelpCircle,
  Menu,
  X,
  Repeat,
  Wallet,
  Banknote,
  Coins,
  Link as LinkIcon,
  Receipt
} from "lucide-react";
import StablecoinBalanceTracker from "./StablecoinBalanceTracker";
import Sidebar from "./Sidebar";
import Image from "next/image";

// Import your actual components
import WalletSelector from "./WalletSelector";
import NotificationTab from "./NotificationTab";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { FaGear } from "react-icons/fa6";
import { usePrivy } from "@privy-io/react-auth";

interface HeaderProps {
  themeColors?: {
    gradient: string;
  };
}

export default function Header({ themeColors }: HeaderProps = {}) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const { authenticated } = usePrivy();
  
  // Default theme colors if not provided
  const gradientClass = themeColors?.gradient || 'from-blue-500 to-purple-500';

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle FAQ navigation
  const handleFAQClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (pathname === "/") {
      const faqSection = document.getElementById("faq");
      if (faqSection) {
        faqSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      router.push("/?scrollTo=faq");
    }
  };

  if (!mounted) return null;

  return (
    <header
      className={`
        sticky top-0 z-50 
        backdrop-blur-md bg-white/80
        border-b border-slate-200/50
        transition-all duration-300
        ${scrolled 
          ? "shadow-lg bg-white/90" 
          : "shadow-sm"
        }
      `}
    >
      {/* Simple top border - Dynamic theme */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientClass}`}></div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 overflow-visible">
        <div className="flex justify-between items-center h-16 overflow-visible">
          
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center space-x-3">
              {/* Simplified Logo */}
              <div className="relative flex">
                <div className="flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
                  <Image src="/NEDApayLogo.png" alt="Logo" width={20} height={20} />
                </div>
                <div className="flex justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
                  <span className="text-sm relative z-10 text-slate-800 font-extrabold drop-shadow-lg p-1 hidden md:!flex">
                    NEDAPay
                  </span>
                </div>
                <span className="text-[0.6rem] z-10 text-slate-800 font-bold flex items-center justify-center">
                    BETA
                  </span>
              </div>
            </Link>
          </div>

          {/* Navigation and Actions */}
          <div className="flex items-center space-x-3 sm:space-x-4 overflow-visible">
            
            {/* Navigation Links */}
            {pathname === "/" && (
              <nav className="flex items-center space-x-2">
                <a
                  href="#how-it-works"
                  className="relative overflow-hidden px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg text-slate-700 dark:text-slate-200 font-medium bg-slate-200 shadow-sm group hidden md:!flex"
                >
                  <span className="relative z-10 flex items-center">
                    <svg
                      className="w-3.5 h-3.5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      ></path>
                    </svg>
                    How It Works
                  </span>
                </a>
                <a
                  href="#faq"
                  onClick={handleFAQClick}
                  className="relative overflow-hidden px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg text-slate-700 dark:text-slate-200 font-medium bg-slate-200 shadow-sm group hidden md:!flex"
                >
                  <span className="relative z-10 flex items-center">
                    <svg
                      className="w-3.5 h-3.5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    FAQ
                  </span>
                </a>
              </nav>
            )}

              {/* Action Buttons Container */}
              <div className="flex items-center space-x-1 sm:space-x-2 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl shadow-md overflow-visible">
                {/* Language Switcher */}
                <LanguageSwitcher />
                
                {/* Stablecoin Balance Modal Toggle */}
                <button
                  onClick={() => setIsBalanceModalOpen(true)}
                  className="rounded-lg hover:!bg-slate-100 transition-colors"
                  title="View Stablecoin Balances"
                >
                  <Coins className="w-5 h-5 hover:text-blue-500" />
                </button>
                <NotificationTab />
                
                
                
                {/* Theme Toggle */}
                {/* <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={`p-2 rounded-full transition-all duration-300 ${
                  theme === "dark"
                    ? "bg-slate-700 text-amber-300 hover:bg-slate-600 hover:text-amber-200"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                  </svg>
                )}
              </button> */}
              <WalletSelector />
              {/* Side Menu Button */}
              
                <button
                onClick={() => setIsSideMenuOpen(!isSideMenuOpen)}
                className="p-2 rounded-xl transition-all duration-300 !bg-gradient-to-r from-blue-400 to-indigo-400 hover:from-blue-500 hover:to-indigo-500"
                aria-label="Open menu"
              >
                <Menu size={16} className="text-slate-800 hover:text-slate-700 transition-colors duration-300" />
              </button>
              
            </div>
          </div>
        </div>
      </div>
    
    {/* Stablecoin Balance Tracker Modal */}
    {isBalanceModalOpen && (
    <StablecoinBalanceTracker isOpen={isBalanceModalOpen} onClose={() => setIsBalanceModalOpen(false)} />
    )}
    
    {/* Side Bar Modal */}
    <Sidebar isOpen={isSideMenuOpen} onClose={() => setIsSideMenuOpen(false)} authenticated={authenticated} />
    </header>

    

  );
}
