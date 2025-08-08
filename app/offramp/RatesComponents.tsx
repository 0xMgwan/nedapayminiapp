import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSupportedCurrencies, fetchTokenRate } from '../utils/paycrest';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { horizontalLoop } from '../utils/horizontalLoop';

interface Currency {
  code: string;
  name: string;
  shortName: string;
  decimals: number;
  symbol: string;
  marketRate: string;
}

interface RateCache {
  [key: string]: {
    rate: string;
    timestamp: number;
    isStale: boolean;
  };
}

const CACHE_DURATION = 21600000; // 6 hours
const REFRESH_INTERVAL = 60000; // 60 seconds
const REQUEST_DELAY = 300; // 300ms delay between requests
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const ITEMS_PER_VIEW = 4;

const CurrencyRatesWidget = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateCache, setRateCache] = useState<RateCache>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const requestQueueRef = useRef<Set<Promise<void>>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();
    intervalRef.current = null;
    abortControllerRef.current = null;
    
    if (loopRef.current) {
      loopRef.current.kill();
      loopRef.current = null;
    }
  }, []);

  const fetchRateWithRetry = useCallback(async (
    fromToken: string, 
    amount: number, 
    toCurrency: string, 
    retryCount = 0
  ): Promise<string> => {
    try {
      if (abortControllerRef.current?.signal.aborted) throw new Error('Request aborted');
      return await fetchTokenRate(fromToken="USDC", amount, toCurrency);
    } catch (error) {
      if (retryCount < MAX_RETRIES && !abortControllerRef.current?.signal.aborted) {
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, RETRY_DELAY * (retryCount + 1));
          retryTimeoutsRef.current.add(timeout);
        });
        return fetchRateWithRetry(fromToken, amount, toCurrency, retryCount + 1);
      }
      throw error;
    }
  }, []);

  const isRateStale = useCallback((timestamp: number) => {
    return Date.now() - timestamp > CACHE_DURATION;
  }, []);

  const loadCurrencies = useCallback(async () => {
    try {
      const supportedCurrencies = await fetchSupportedCurrencies();
      
      // Priority currencies to display (whitelisted)
      const priorityCurrencies = ['NGN', 'KES', 'GHS', 'TZS', 'UGX', 'ZAR', 'EGP', 'MAD', 'XOF', 'XAF'];
      
      // Filter to only show priority currencies
      const filteredCurrencies = supportedCurrencies.filter(currency => 
        priorityCurrencies.includes(currency.code)
      );
      
      // Sort priority currencies by the order defined in priorityCurrencies array
      const sortedCurrencies = filteredCurrencies.sort((a, b) => {
        const aIndex = priorityCurrencies.indexOf(a.code);
        const bIndex = priorityCurrencies.indexOf(b.code);
        return aIndex - bIndex;
      });
      
      console.log(`💱 Displaying ${sortedCurrencies.length} priority currencies:`, sortedCurrencies.map(c => c.code));
      setCurrencies(sortedCurrencies);
      return sortedCurrencies;
    } catch (err) {
      console.error('Failed to load currencies:', err);
      throw new Error('Failed to load supported currencies');
    }
  }, []);

  const processRateRequest = useCallback(async (
    currency: Currency,
    now: number,
    newCacheEntries: RateCache
  ) => {
    try {
      const rate = await fetchRateWithRetry('USDC', 1, currency.code);
      newCacheEntries[currency.code] = {
        rate,
        timestamp: now,
        isStale: false
      };
    } catch (error) {
      console.warn(`Failed to fetch rate for ${currency.code}:`, error);
      newCacheEntries[currency.code] = {
        rate: currency.marketRate,
        timestamp: now,
        isStale: true
      };
    }
  }, [fetchRateWithRetry]);

  const loadRates = useCallback(async (currenciesToLoad: Currency[], forceRefresh = false) => {
    if (!currenciesToLoad.length) return;

    try {
      setIsRefreshing(true);
      abortControllerRef.current = new AbortController();
      const now = Date.now();
      const newCacheEntries: RateCache = {};
      const currenciesToUpdate: Currency[] = [];

      // Determine which currencies need updates
      currenciesToLoad.forEach(currency => {
        const cached = rateCache[currency.code];
        if (forceRefresh || !cached || isRateStale(cached.timestamp)) {
          currenciesToUpdate.push(currency);
        }
      });

      if (currenciesToUpdate.length > 0) {
        // Process requests with concurrency control
        const processQueue = async () => {
          const activeRequests = new Set<Promise<void>>();
          
          for (const currency of currenciesToUpdate) {
            if (abortControllerRef.current?.signal.aborted) break;

            // Wait if we've reached max concurrent requests
            while (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
              await Promise.race(activeRequests);
            }

            const requestPromise = processRateRequest(currency, now, newCacheEntries)
              .finally(() => activeRequests.delete(requestPromise));

            activeRequests.add(requestPromise);
            requestQueueRef.current.add(requestPromise);
            
            // Add delay between requests if not the last one
            if (currency !== currenciesToUpdate[currenciesToUpdate.length - 1]) {
              await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
            }
          }

          // Wait for all remaining requests to complete
          await Promise.all(activeRequests);
        };

        await processQueue();
        
        // Update cache with all new entries
        setRateCache(prev => ({ ...prev, ...newCacheEntries }));
      }

      setLastUpdateTime(now);
      setError(null);
    } catch (err) {
      console.error('Failed to load rates:', err);
      setError('Failed to load rates. Please try again later.');
    } finally {
      setIsRefreshing(false);
      abortControllerRef.current = null;
      requestQueueRef.current.clear();
    }
  }, [isRateStale, fetchRateWithRetry, rateCache]);

  // GSAP animation setup
  useGSAP(() => {
    if (!containerRef.current || currencies.length === 0) return;
    
    const currencyItems = containerRef.current.querySelectorAll('.currency-item');
    if (currencyItems.length === 0) return;
    
    loopRef.current = horizontalLoop(currencyItems, {
      repeat: -1,
      speed: 0.5,
      paused: isPaused,
      paddingRight: parseFloat(
        gsap.getProperty(currencyItems[0], 'marginRight') as string
      )
    });
    
    return () => {
      if (loopRef.current) {
        loopRef.current.kill();
        loopRef.current = null;
      }
    };
  }, { 
    scope: containerRef,
    dependencies: [currencies, isPaused] 
  });

  useEffect(() => {
    const initializeWidget = async () => {
      try {
        setLoading(true);
        const loadedCurrencies = await loadCurrencies();
        await loadRates(loadedCurrencies);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize widget');
      } finally {
        setLoading(false);
      }
    };

    initializeWidget();
    return cleanup;
  }, [loadCurrencies, loadRates, cleanup]);

  useEffect(() => {
    if (currencies.length > 0 && !loading) {
      setIsPaused(false);
    }
  }, [currencies, loading]);

  useEffect(() => {
    if (currencies.length > 0 && !loading) {
      intervalRef.current = setInterval(() => {
        if (!isRefreshing) loadRates(currencies);
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currencies, loadRates, loading, isRefreshing]);

  const handleManualRefresh = useCallback(() => {
    if (!isRefreshing && currencies.length > 0) {
      loadRates(currencies, true);
    }
  }, [currencies, loadRates, isRefreshing]);

  const formatRate = useCallback((rate: string, currency: Currency) => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate)) return 'N/A';
    return numRate.toLocaleString(undefined, {
      minimumFractionDigits: currency.decimals === 0 ? 0 : 2,
      maximumFractionDigits: currency.decimals === 0 ? 0 : currency.decimals
    });
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-700">
        <div className="flex items-center justify-center gap-3">
          <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
          <span className="text-slate-300 text-sm font-medium">Loading exchange rates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-gradient-to-r from-red-900/20 via-red-800/20 to-red-900/20 rounded-2xl p-6 shadow-2xl border border-red-700/50">
        <div className="flex items-center justify-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <span className="text-red-300 text-sm font-medium">{error}</span>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-300 hover:text-red-100 
                       bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-all duration-200
                       border border-red-700/50 hover:border-red-600/50"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
          .rate-card {
            backdrop-filter: blur(10px);
            border-image: linear-gradient(135deg, 
              rgba(16, 185, 129, 0.2) 0%,
              rgba(16, 185, 129, 0.4) 50%,
              rgba(16, 185, 129, 0.2) 100%
            ) 1;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          .rate-card:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
          }
          .stale-rate {
            border-color: rgba(245, 158, 11, 0.3) !important;
          }
        `
      }} />

      <div className="relative overflow-hidden">
        <div 
          ref={containerRef}
          className="flex"
        >
          {currencies.map((currency) => {
            const cached = rateCache[currency.code];
            const isStale = cached?.isStale || false;
            const rate = cached ? cached.rate : currency.marketRate;

            return (
              <div 
                key={currency.code}
                className={`sm:min-w-[200px] sm:max-w-[260px] md:min-w-[220px] md:max-w-[280px] currency-item rate-card group relative overflow-hidden p-4 mx-3 !rounded-2xl flex-shrink-0 
                           bg-gradient-to-br from-slate-900/95 to-slate-800/90 backdrop-blur-sm
                           border ${isStale ? 'stale-rate border-amber-500/30' : 'border-slate-700/50'} hover:border-emerald-500/30 
                           hover:shadow-xl hover:shadow-emerald-500/10
                           hover:scale-[1.02] cursor-pointer transition-all duration-300`}
                style={{ 
                  width: `calc(${100 / ITEMS_PER_VIEW}% - 1.5rem)`,
                  minWidth: '180px',
                  maxWidth: '240px'
                }}
              >
                {isStale && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5 
                                opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border 
                                      ${isStale ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}
                                      group-hover:border-emerald-400/50 transition-all duration-300`}>
                        <span className={`${isStale ? 'text-amber-400' : 'text-emerald-400'} font-bold text-xs font-mono`}>
                          {currency.symbol}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-white font-bold text-sm tracking-wide">
                        {currency.code}
                      </div>
                      <div className="text-slate-400 text-xs font-medium tracking-wider uppercase">
                        {currency.name}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-400 text-xs font-medium">1 USDC</span>
                    <span className="text-slate-500 text-sm">=</span>
                  </div>
                  
                  <div className="relative">
                    <div className={`text-sm font-bold font-mono text-transparent bg-clip-text 
                                    ${isStale ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-gradient-to-r from-emerald-400 to-emerald-300'}
                                    group-hover:from-emerald-300 group-hover:to-emerald-400 
                                    transition-all duration-300`}>
                      {formatRate(rate, currency)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CurrencyRatesWidget;
