import { NextRequest, NextResponse } from 'next/server';
import { initiatePaymentOrder, Recipient, fetchAllOrders } from '../../../utils/paycrest';

interface PaymentOrderRequest {
  amount: number;
  rate: number;
  network: 'base' | 'celo';
  token: 'USDC' | 'USDT' | 'cUSD';
  recipient: Recipient;
  returnAddress?: string;
  reference?: string;
}


// export async function GET(req: NextRequest) {
//   console.log("debugging orders req",req)
//   try {
//     const { searchParams } = new URL(req.url);
    
//     const params = {
//       ordering: searchParams.get('ordering') || undefined,
//       status: searchParams.get('status') || undefined,
//       token: searchParams.get('token') || undefined,
//       network: searchParams.get('network') || undefined,
//       page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
//       pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined,
//     };

//     const orders = await fetchAllOrders(params);
    
    
//     return NextResponse.json(orders);
//   } catch (error) {
//     console.error('Error fetching orders:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch orders' },
//       { status: 500 }
//     );
//   }
// }

export async function POST(request: NextRequest) {
  try {
    console.log('PayCrest orders POST request received');
    console.log('Request headers:', request.headers);
    
    const body = await request.json() as PaymentOrderRequest;
    console.log('🔍 API Debug - Request body received:', body);
    console.log('🔍 API Debug - Network from body:', body.network);
    console.log('🔍 API Debug - Token from body:', body.token);

    // Validate payload
    if (!body.amount || !body.rate || !body.recipient || !body.network || !body.token) {
      console.log('Missing required fields in request body');
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Attempting to initiate payment order with payload:', {
      amount: body.amount,
      rate: body.rate,
      network: body.network,
      token: body.token,
      recipient: body.recipient,
      returnAddress: body.returnAddress,
      reference: body.reference,
    });

    const order = await initiatePaymentOrder({
      amount: body.amount,
      rate: body.rate,
      network: body.network,
      token: body.token,
      recipient: body.recipient,
      returnAddress: body.returnAddress,
      reference: body.reference,
    });

    console.log('Payment order initiated successfully:', order);
    
    // Ensure we return valid JSON
    if (!order || typeof order !== 'object') {
      console.error('Invalid order response:', order);
      return NextResponse.json(
        { message: 'Invalid response from payment service' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(order);
  } catch (error) {
    console.error('❌ Error initiating payment order:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        message: 'Internal Server Error',
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'No stack trace available'
      },
      { status: 500 }
    );
  }
}