import axios from 'axios';

const PAYCREST_API_URL = 'https://api.paycrest.io';
const CLIENT_ID = process.env.PAYCREST_CLIENT_ID!;
const CLIENT_SECRET = process.env.PAYCREST_CLIENT_SECRET!;

const headers = {
  'API-Key': CLIENT_ID,
  'Content-Type': 'application/json',
};

// Add this interface after your existing interfaces
interface PaymentOrder {
  id: string;
  amount: string;
  amountPaid: string;
  amountReturned: string;
  token: string;
  senderFee: string;
  transactionFee: string;
  rate: string;
  network: string;
  gatewayId: string;
  reference: string;
  recipient: Recipient;
  fromAddress: string;
  returnAddress: string;
  receiveAddress: string;
  feeAddress: string;
  createdAt: string;
  updatedAt: string;
  txHash: string;
  status: string;
}

interface FetchOrdersResponse {
  message: string;
  status: string;
  data: {
    total: number;
    page: number;
    pageSize: number;
    orders: PaymentOrder[];
  };
}

interface FetchOrdersParams {
  ordering?: string;
  status?: string;
  token?: string;
  network?: string;
  page?: number;
  pageSize?: number;
}

export interface Recipient {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  memo: string;
  providerId?: string;
}

interface PaymentOrderPayload {
  amount: number;
  rate: number;
  network: 'base' | 'celo';
  token: 'USDC' | 'USDT';
  recipient: Recipient;
  returnAddress?: string;
  reference?: string;
}

interface PaymentOrderResponse {
  message: string;
  status: string;
  data: {
    id: string;
    amount: string;
    token: string;
    network: string;
    receiveAddress: string;
    validUntil: string;
    senderFee: string;
    transactionFee: string;
    reference?: string;
  };
}

interface NetworkErrorDetails {
  code: string;
  message: string;
  details?: {
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
  };
}

export async function initiatePaymentOrder(payload: PaymentOrderPayload): Promise<PaymentOrderResponse> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  async function makeRequest(retryCount = 0): Promise<PaymentOrderResponse> {
    try {
      console.log('Attempting to initiate PayCrest order with payload:', {
        payload,
        retry: retryCount + 1
      });
      
      const response = await axios.post(`${PAYCREST_API_URL}/v1/sender/orders`, payload, { 
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => true,
        maxRedirects: 5
      });

      if (response.status >= 400) {
        console.error('PayCrest API error response:', {
          status: response.status,
          data: response.data
        });
        throw new Error(`PayCrest API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const networkError = extractNetworkError(error);
        console.error('Network error details:', networkError);

        if (retryCount < MAX_RETRIES && isRetryableError(error)) {
          console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return makeRequest(retryCount + 1);
        }

        throw new Error(`Network error: ${networkError.message}. Details: ${JSON.stringify(networkError.details)}`);
      }

      console.error('Error in initiatePaymentOrder:', {
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  return makeRequest();
}

function extractNetworkError(error: any): NetworkErrorDetails {
  if (!error.response) {
    const details = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      details: {
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      }
    };
    return details;
  }
  
  return {
    code: error.response.status.toString(),
    message: error.response.statusText,
    details: {
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    }
  };
}

function isRetryableError(error: any): boolean {
  if (!axios.isAxiosError(error)) return false;
  
  const retryableCodes = ['ETIMEDOUT', 'ENETUNREACH', 'ECONNRESET', 'ECONNREFUSED'];
  return retryableCodes.includes(error.code as string);
}


export async function fetchTokenRate(token: 'USDC' | 'USDT', amount: number, fiat: string, providerId?: string): Promise<string> {
  const query = providerId ? `?provider_id=${providerId}` : '';
  const network = token === 'USDT' ? 'celo' : 'base';
  const response = await axios.get(`${PAYCREST_API_URL}/v1/rates/${token}/${amount}/${fiat}?network=${network}`, { headers });
  return response.data.data;
}

export async function verifyAccount(institution: string, accountIdentifier: string): Promise<string> {
  const response = await axios.post(
    `${PAYCREST_API_URL}/v1/verify-account`,
    { institution, accountIdentifier },
    { headers }
  );
  console.log("response account", response.data.data); //debugging
  return response.data.data;
}

export async function fetchSupportedInstitutions(currencyCode: string): Promise<Array<{ name: string; code: string; type: string }>> {
  const response = await axios.get(`${PAYCREST_API_URL}/v1/institutions/${currencyCode}`, { headers });
  return response.data.data;
}

export async function fetchSupportedCurrencies(): Promise<Array<{ code: string; name: string; shortName: string; decimals: number; symbol: string; marketRate: string }>> {
  const response = await axios.get(`${PAYCREST_API_URL}/v1/currencies`, { headers });
  return response.data.data;
}

export async function fetchAllOrders(): Promise<FetchOrdersResponse> {
  try {
    const response = await fetch(`${PAYCREST_API_URL}/v1/sender/orders/`, { headers });
    return response.json(); 
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw new Error('Failed to fetch orders: An unexpected error occurred');
  }
}
