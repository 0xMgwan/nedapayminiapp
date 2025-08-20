export {};

declare global {
  interface Window {
    ethereum?: {
      isMiniPay?: boolean;
      request: (request: { method: string; params?: any[] }) => Promise<any>;
    };
    miniAppBridge?: {
      openUrl: (url: string) => Promise<void>;
    };
  }
}
