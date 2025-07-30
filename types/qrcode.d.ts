declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }

  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export function toString(text: string, options?: QRCodeOptions): Promise<string>;
}
