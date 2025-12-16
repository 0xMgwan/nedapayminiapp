import { NextRequest, NextResponse } from 'next/server';
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

import prisma from '@/lib/prisma';

// GET handler
export async function GET(request: NextRequest) {
  try {
    // Extract user ID from authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with settings and API keys
    const user = await prisma.user.findUnique({
      where: { privyUserId: userId },
      include: {
        merchantSettings: true,
        apiKeys: {
          where: { isActive: true },
          select: {
            id: true,
            keyId: true,
            environment: true,
            name: true,
            lastUsed: true,
            createdAt: true,
            // Don't return the actual hashed key
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If no settings exist, create default ones
    let settings = user.merchantSettings;
    if (!settings) {
      settings = await prisma.merchantSettings.create({
        data: {
          userId: user.id,
          businessName: '',
          businessEmail: user.email || '',
          businessPhone: '',
          businessCategory: 'retail',
          businessDescription: '',
        }
      });
    }

    return NextResponse.json({
      settings: {
        businessName: settings.businessName,
        businessEmail: settings.businessEmail,
        businessPhone: settings.businessPhone,
        businessCategory: settings.businessCategory,
        businessDescription: settings.businessDescription,
        autoSettlement: settings.autoSettlement,
        settlementThreshold: settings.settlementThreshold,
        settlementCurrency: settings.settlementCurrency,
        paymentExpiry: settings.paymentExpiry,
        twoFactorEnabled: settings.twoFactorEnabled,
        withdrawalConfirmation: settings.withdrawalConfirmation,
        transactionNotifications: settings.transactionNotifications,
        settlementNotifications: settings.settlementNotifications,
        securityAlerts: settings.securityAlerts,
        marketingUpdates: settings.marketingUpdates,
        webhookUrl: settings.webhookUrl,
      },
      apiKeys: user.apiKeys
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT handler
export async function PUT(request: NextRequest) {
  try {
    // Extract user ID from authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      businessName,
      businessEmail,
      businessPhone,
      businessCategory,
      businessDescription,
      autoSettlement,
      settlementThreshold,
      settlementCurrency,
      paymentExpiry,
      twoFactorEnabled,
      withdrawalConfirmation,
      transactionNotifications,
      settlementNotifications,
      securityAlerts,
      marketingUpdates,
      webhookUrl,
    } = body;

    // Validate required fields
    if (!businessName || !businessEmail) {
      return NextResponse.json({ error: 'Business name and email are required' }, { status: 400 });
    }

    // Validate business category
    const validCategories = ['retail', 'food', 'services', 'technology', 'education', 'other'];
    if (businessCategory && !validCategories.includes(businessCategory)) {
      return NextResponse.json({ error: 'Invalid business category' }, { status: 400 });
    }

    // Validate settlement threshold
    if (settlementThreshold && (isNaN(settlementThreshold) || settlementThreshold < 0)) {
      return NextResponse.json({ error: 'Invalid settlement threshold' }, { status: 400 });
    }

    // Validate payment expiry
    if (paymentExpiry && (isNaN(paymentExpiry) || paymentExpiry < 1 || paymentExpiry > 1440)) {
      return NextResponse.json({ error: 'Payment expiry must be between 1 and 1440 minutes' }, { status: 400 });
    }

    // Update or create settings
    const settings = await prisma.merchantSettings.upsert({
      where: { userId },
      update: {
        businessName,
        businessEmail,
        businessPhone,
        businessCategory,
        businessDescription,
        autoSettlement: autoSettlement ?? undefined,
        settlementThreshold: settlementThreshold ? parseFloat(settlementThreshold) : undefined,
        settlementCurrency,
        paymentExpiry: paymentExpiry ? parseInt(paymentExpiry) : undefined,
        twoFactorEnabled: twoFactorEnabled ?? undefined,
        withdrawalConfirmation: withdrawalConfirmation ?? undefined,
        transactionNotifications: transactionNotifications ?? undefined,
        settlementNotifications: settlementNotifications ?? undefined,
        securityAlerts: securityAlerts ?? undefined,
        marketingUpdates: marketingUpdates ?? undefined,
        webhookUrl,
        updatedAt: new Date(),
      },
      create: {
        userId,
        businessName,
        businessEmail,
        businessPhone,
        businessCategory,
        businessDescription,
        autoSettlement: autoSettlement ?? true,
        settlementThreshold: settlementThreshold ? parseFloat(settlementThreshold) : 1000,
        settlementCurrency: settlementCurrency || 'TSHC',
        paymentExpiry: paymentExpiry ? parseInt(paymentExpiry) : 60,
        twoFactorEnabled: twoFactorEnabled ?? false,
        withdrawalConfirmation: withdrawalConfirmation ?? true,
        transactionNotifications: transactionNotifications ?? true,
        settlementNotifications: settlementNotifications ?? true,
        securityAlerts: securityAlerts ?? true,
        marketingUpdates: marketingUpdates ?? false,
        webhookUrl,
      }
    });

    return NextResponse.json({ 
      message: 'Settings updated successfully',
      settings: {
        businessName: settings.businessName,
        businessEmail: settings.businessEmail,
        businessPhone: settings.businessPhone,
        businessCategory: settings.businessCategory,
        businessDescription: settings.businessDescription,
        autoSettlement: settings.autoSettlement,
        settlementThreshold: settings.settlementThreshold,
        settlementCurrency: settings.settlementCurrency,
        paymentExpiry: settings.paymentExpiry,
        twoFactorEnabled: settings.twoFactorEnabled,
        withdrawalConfirmation: settings.withdrawalConfirmation,
        transactionNotifications: settings.transactionNotifications,
        settlementNotifications: settings.settlementNotifications,
        securityAlerts: settings.securityAlerts,
        marketingUpdates: settings.marketingUpdates,
        webhookUrl: settings.webhookUrl,
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to extract user ID from request
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided');
      return null;
    }

    // For Privy integration, we need to decode the JWT token directly
    // Privy access tokens are JWTs that contain user information
    try {
      // Decode the JWT without verification first to see the structure
      const decoded = jwt.decode(token) as any;
      // console.log('Decoded token payload:', decoded); //debugging
      
      if (decoded && decoded.sub) {
        // The 'sub' (subject) field typically contains the user ID
        return decoded.sub;
      }
      
      // If you need to verify with Privy's API (use correct endpoint)
      // if (process.env.PRIVY_APP_SECRET) {
      //   const response = await fetch('https://auth.privy.io/api/v1/users/me', {
      //     method: 'GET',
      //     headers: {
      //       'Authorization': `Bearer ${token}`,
      //       'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      //       'Content-Type': 'application/json',
      //     },
      //   });

      //   if (response.ok) {
      //     const userData = await response.json();
      //     console.log('Privy user data:', userData);
      //     return userData.id || userData.sub;
      //   } else {
      //     console.log('Privy API response not ok:', response.status, await response.text());
      //   }
      // }
      
    } catch (jwtError) {
      console.log('JWT decode error:', jwtError);
    }
    
    // Fallback: For custom JWT tokens
    // if (process.env.JWT_SECRET) {
    //   try {
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    //     return decoded.userId || decoded.sub;
    //   } catch (verifyError) {
    //     console.log('JWT verification failed:', verifyError);
    //   }
    // }

    console.log('Could not extract user ID from token');
    return null;
    
  } catch (error) {
    console.error('Error extracting user ID:', error);
    return null;
  }
}