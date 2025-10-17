"use client";

import toast from "react-hot-toast";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { base } from "wagmi/chains";
import { Name } from "@coinbase/onchainkit/identity";
import { getBasename } from "../utils/getBaseName";
import { useUserSync } from "../hooks/useUserSync";
import { useLinkAccount } from "@privy-io/react-auth";
import { useFarcasterProfile } from "../hooks/useFarcasterProfile";
import AuthenticationModal from "./AuthenticationModal";
import WalletFundsModal from "./WalletFundsModal";
import { FarcasterProfile } from "./FarcasterProfile";
import { FaWallet, FaSignOutAlt } from "react-icons/fa";

// Type definitions for BasenameDisplay component
interface BasenameDisplayProps {
  address: string | undefined;
  basenameClassName?: string;
  addressClassName?: string;
  isMobile?: boolean;
}

// Reusable BasenameDisplay Component
const BasenameDisplay: React.FC<BasenameDisplayProps> = ({
  address,
  basenameClassName = "",
  addressClassName = "",
  isMobile = false,
}) => {
  const [baseName, setBaseName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Basename fetching with proper error handling
  useEffect(() => {
    if (!address) {
      setBaseName(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchBasename = async () => {
      setIsLoading(true);
      try {
        const toHexAddress = (address: string): `0x${string}` => {
          return (
            address.startsWith("0x") ? address : `0x${address}`
          ) as `0x${string}`;
        };

        const formattedAddress = toHexAddress(address);
        const basename = await getBasename(formattedAddress);

        if (isMounted && !controller.signal.aborted) {
          setBaseName(basename || null);
        }
      } catch (error) {
        console.error("Error fetching basename:", error);
        if (isMounted && !controller.signal.aborted) {
          setBaseName(null);
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchBasename, 300);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(debounceTimer);
    };
  }, [address]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-1 text-white">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-4 w-16 rounded"></div>
      </div>
    );
  }

  if (baseName) {
    return (
      <span
        className={`text-sm font-semibold ${basenameClassName}`}
      >
        {baseName}
      </span>
    );
  }

  // Fallback to Name component from OnchainKit
  return (
    <div className={`${addressClassName}`}>
      <Name address={address as `0x${string}`} chain={base} />
    </div>
  );
};

// WalletSelector component with ref
interface WalletSelectorProps {
  triggerLogin?: () => void; // Optional prop, expects 0 arguments
}

const WalletSelector = forwardRef<
  { triggerLogin: () => void },
  WalletSelectorProps
>(({ triggerLogin }, ref) => {
  // Enhanced mobile-specific styles
  const mobileStyles = `
      @media (max-width: 640px) {
        
        .wallet-icon {
          width: 18px !important;
          height: 18px !important;
          margin-right: 6px !important;
          flex-shrink: 0 !important;
        }
        
        
        
        
        .basename-display {
          max-width: 100px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .address-display {
          max-width: 80px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
      }
      
      @media (max-width: 480px) {
        
        .wallet-address {
          font-size: 0.65rem;
          max-width: calc(100vw - 100px);
        }
        .basename-display {
          max-width: 80px !important;
        }
        .address-display {
          max-width: 60px !important;
        }
      }
    `;

  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Email sync and update
  const {
    userData,
    isLoading: userLoading,
    addEmail,
    hasEmail,
  } = useUserSync();

  // Privy hooks
  const { authenticated, user, connectWallet, logout, ready, login } =
    usePrivy();

  // Farcaster profile integration
  const { profile: farcasterProfile, isLoading: farcasterLoading, isFarcasterEnvironment } = useFarcasterProfile();

  // Link account hook
  const { linkEmail } = useLinkAccount({
    onSuccess: ({ user, linkMethod, linkedAccount }) => {
      console.log("Linked account to user ", linkedAccount);
      toast.success("Email linked successfully!");
    },
    onError: (error) => {
      console.error("Failed to link account with error ", error);
      toast.error("Failed to link email. Please try again.");
    },
  });

  // Get the primary wallet address safely
  const walletAddress = user?.wallet?.address;
  // localStorage.setItem("walletAddress", walletAddress || "");
  
  const emailAddress = user?.email?.address;
  const isConnected = authenticated && (walletAddress || emailAddress);

  // Show authentication modal only on / and once per session
  useEffect(() => {
    if (
      ready &&
      authenticated &&
      (walletAddress || emailAddress) &&
      pathname === "/"
    ) {
      const hasShown = sessionStorage.getItem("hasShownAuthModal") === "true";
      if (!hasShown) {
        setShowAuthModal(true);
        sessionStorage.setItem("hasShownAuthModal", "true");
      }
    }
  }, [ready, authenticated, walletAddress, emailAddress, pathname]);

  // Expose handleEmailLogin via ref
  const handleEmailLogin = useCallback(async () => {
    if (!ready) {
      toast.error("Privy is not ready yet. Please wait a moment.");
      return;
    }

    setIsConnecting(true);
    try {
      await login();
      // Trigger modal if on /
      if (
        pathname === "/" &&
        sessionStorage.getItem("hasShownAuthModal") !== "true"
      ) {
        setShowAuthModal(true);
        sessionStorage.setItem("hasShownAuthModal", "true");
      }
    } catch (error: any) {
      console.error("Error with email login:", error);
      toast.error("Failed to login. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  }, [ready, login, pathname]);

  useImperativeHandle(ref, () => ({
    triggerLogin: handleEmailLogin,
  }));

  // Format address for display
  const formatAddress = useCallback(
    (address: string | undefined, isMobile: boolean = false): string => {
      if (
        !address ||
        typeof address !== "string" ||
        !address.startsWith("0x") ||
        address.length < 10
      ) {
        return "Unknown Address";
      }

      if (isMobile) {
        return `${address.substring(0, 4)}...${address.substring(address.length - 3)}`;
      }

      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    },
    []
  );

  // Debug Privy state
  // useEffect(() => {
  //   console.log("Privy State:", {
  //     ready,
  //     authenticated,
  //     user,
  //     walletAddress,
  //     walletClientType: user?.wallet?.walletClientType,
  //     emailAddress,
  //     isConnected,
  //   });
  // }, [ready, authenticated, user, walletAddress, emailAddress, isConnected]);

  // Enhanced format email for mobile display
  const formatEmail = useCallback(
    (email: string | undefined, maxLength: number = 20): string => {
      if (!email) return "Connected";

      if (email.length <= maxLength) return email;

      const [localPart, domain] = email.split("@");
      if (localPart.length > maxLength - domain.length - 4) {
        return `${localPart.substring(0, maxLength - domain.length - 7)}...@${domain}`;
      }

      return email;
    },
    []
  );

  // Close dropdown when clicking or touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowOptions(false);
      }
    };

    if (showOptions) {
      document.addEventListener(
        "mousedown",
        handleClickOutside as EventListener
      );
      document.addEventListener(
        "touchstart",
        handleClickOutside as EventListener
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside as EventListener
      );
      document.removeEventListener(
        "touchstart",
        handleClickOutside as EventListener
      );
    };
  }, [showOptions]);

  // Handle wallet connection state and persistence
  useEffect(() => {
    if (ready && isConnected) {
      const address = walletAddress || emailAddress || "";

      if (typeof window !== "undefined") {
        localStorage.setItem("walletConnected", "true");
        if (address) {
          localStorage.setItem("walletAddress", address);
        }

        document.cookie =
          "wallet_connected=true; path=/; max-age=86400; SameSite=Lax";

        window.dispatchEvent(
          new CustomEvent("walletConnected", {
            detail: { address, authenticated: true },
          })
        );
      }
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("walletConnected");
        localStorage.removeItem("walletAddress");
        document.cookie = "wallet_connected=; path=/; max-age=0; SameSite=Lax";

        window.dispatchEvent(new CustomEvent("walletDisconnected"));
      }
    }
  }, [ready, isConnected, walletAddress, emailAddress]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      setShowOptions(false);

      if (typeof window !== "undefined") {
        localStorage.removeItem("walletConnected");
        localStorage.removeItem("walletAddress");
        sessionStorage.removeItem("hasShownAuthModal"); // Reset modal state
        document.cookie = "wallet_connected=; path=/; max-age=0; SameSite=Lax";
      }

      toast.success("Logged out successfully");
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out");
    }
  };

  // Handle linking email
  const handleLinkEmail = async () => {
    try {
      await linkEmail();
    } catch (error) {
      console.error("Error linking email:", error);
    }
  };

  // Render wallet icon
  const renderWalletIcon = () => {
    const walletType = user?.wallet?.walletClientType;

    if (walletType === "coinbase_wallet") {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="12" fill="#0052FF" />
          <circle cx="12" cy="12" r="7.2" fill="#fff" />
          <rect x="8" y="11" width="8" height="2" rx="1" fill="#0052FF" />
        </svg>
      );
    } else if (walletType === "metamask") {
      return (
        <img
          src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/metamask-icon.svg"
          alt="MetaMask Logo"
          width="18"
          height="18"
        />
      );
    }

    return (
      <FaWallet className="text-white"/>
    );
  };

  if (!ready) {
    return (
      <div className="flex items-center bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl shadow-sm">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-sm text-gray-600 font-medium">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <style jsx>{`
        .modern-wallet-selector {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(156, 163, 175, 0.6) !important;
          color: rgb(55, 65, 81) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          border-radius: 0.75rem !important;
          padding: 0.5rem 0.75rem !important;
          transition: all 0.3s ease !important;
        }
        .modern-wallet-selector:hover {
          background: rgba(255, 255, 255, 1) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
        }
        ${mobileStyles}
      `}</style>

      {isConnected ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowOptions(!showOptions);
          }}
          className="modern-wallet-selector flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2"
        >
          <div className="wallet-icon w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 p-1">
            {renderWalletIcon()}
          </div>

          {pathname !== "/" && (
            <div className="wallet-address-container flex-1 min-w-0">
              {isFarcasterEnvironment && farcasterProfile ? (
                <div className="flex items-center space-x-2">
                  <img
                    src={farcasterProfile.pfpUrl}
                    alt={`${farcasterProfile.username} avatar`}
                    className="w-5 h-5 rounded-full object-cover border border-gray-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-avatar.svg';
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors truncate">
                      {farcasterProfile.displayName}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      @{farcasterProfile.username}
                    </span>
                  </div>
                </div>
              ) : walletAddress ? (
                <div className="wallet-address text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                  <BasenameDisplay
                    address={walletAddress}
                    basenameClassName="basename-display text-gray-700 group-hover:text-gray-900"
                    addressClassName="address-display text-gray-700 group-hover:text-gray-900"
                    isMobile={true}
                  />
                </div>
              ) : emailAddress ? (
                <span className="wallet-address text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                  {formatEmail(emailAddress, 15)}
                </span>
              ) : (
                <span className="wallet-address text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                  Connected
                </span>
              )}
            </div>
          )}

          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 group-hover:text-gray-700 transition-colors"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      ) : (
        <button
          onClick={handleEmailLogin}
          className="flex items-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 px-4 py-2"
          disabled={isConnecting}
        >
          <FaWallet className="w-4 h-4 mr-2" />
          <span className="sign-in-text text-sm font-semibold">
            {isConnecting ? "Connecting..." : "Sign in"}
          </span>
        </button>
      )}

      {showOptions && isConnected && (
        <div
          className="wallet-dropdown absolute right-0 mt-3 w-72 rounded-2xl shadow-2xl bg-white/95 backdrop-blur-sm border border-gray-200/50 focus:outline-none z-50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: "80vh", overflowY: "auto" }}
        >
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {isFarcasterEnvironment && farcasterProfile ? 'Farcaster Profile' : 'Connected Account'}
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
                Active
              </span>
            </div>
            
            {isFarcasterEnvironment && farcasterProfile ? (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-3 border border-purple-100">
                <FarcasterProfile 
                  profile={farcasterProfile} 
                  compact={true}
                  className="bg-transparent border-0 p-0 shadow-none"
                />
                {walletAddress && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">Wallet Address</div>
                    <div className="text-xs text-gray-700 break-all font-mono">
                      <BasenameDisplay
                        address={walletAddress}
                        basenameClassName="text-xs font-semibold text-gray-700"
                        addressClassName="text-xs text-gray-600"
                        isMobile={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-1">Address</div>
                <div className="text-sm text-gray-900 break-all font-mono">
                  {walletAddress ? (
                    <BasenameDisplay
                      address={walletAddress}
                      basenameClassName="text-sm font-semibold text-gray-900"
                      addressClassName="text-sm text-gray-700"
                      isMobile={false}
                    />
                  ) : emailAddress ? (
                    emailAddress
                  ) : (
                    "Connected"
                  )}
                </div>
              </div>
            )}
          </div>

          {!hasEmail && walletAddress && (
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={handleLinkEmail}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-all duration-200 rounded-xl border border-blue-200/50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span className="font-medium">Add Email Address</span>
              </button>
            </div>
          )}

          {user?.wallet?.walletClientType === 'privy' && (
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={() => {
                  setShowWithdrawalModal(true);
                  setIsLoadingWallet(true);
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 transition-all duration-200 rounded-xl border border-orange-200/50"
              >
                <FaWallet className="w-4 h-4" />
                <span className="font-medium">
                  {isLoadingWallet ? "Loading..." : "Wallet"}
                </span>
              </button>
            </div>
          )}

          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all duration-200 rounded-xl border border-red-200/50"
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}

      {showWithdrawalModal && (
        <div className="inset-0 flex items-center justify-center z-[9999] p-4">
        <WalletFundsModal
          isOpen={showWithdrawalModal}
          onClose={() => {
            setShowWithdrawalModal(false);
            setIsLoadingWallet(false);
          }}
          walletAddress={walletAddress}
        />
        </div>
      )}

      {showAuthModal && isConnected && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
          <AuthenticationModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            address={walletAddress || emailAddress || ""}
          />
        </div>
      )}
    </div>
  );
});

WalletSelector.displayName = "WalletSelector";

export { BasenameDisplay };
export default WalletSelector;
