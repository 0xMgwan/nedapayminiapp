import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { getUserIdFromRequest } from './route';

import prisma from '@/lib/prisma';

export async function handleApiKeys(req: NextRequest) {
    const { method } = req;
    const userId = await getUserIdFromRequest(req);
    
    if (!userId) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }
  
    switch (method) {
      case 'POST':
        return generateApiKey(req, userId);
      case 'DELETE':
        return revokeApiKey(req, userId);
      default:
        return NextResponse.json(
          { error: `Method ${method} not allowed` }, 
          { 
            status: 405,
            headers: { 'Allow': 'POST, DELETE' }
          }
        );
    }
  }
  
  async function generateApiKey(req: NextRequest, userId: string) {
    try {
      const body = await req.json();
      const { environment, name } = body;
      
      if (!environment || !['live', 'test'].includes(environment)) {
        return NextResponse.json(
          { error: 'Invalid environment. Must be "live" or "test"' },
          { status: 400 }
        );
      }
  
      // Generate API key
      const apiKey = `sk_${environment}_${crypto.randomBytes(32).toString('hex')}`;
      const keyId = `key_${crypto.randomBytes(16).toString('hex')}`;
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
      // Store in database
      const createdKey = await prisma.apiKey.create({
        data: {
          userId,
          keyId,
          hashedKey,
          environment,
          name: name || `${environment} API Key`,
        }
      });
  
      return NextResponse.json({
        message: 'API key generated successfully',
        apiKey, // Only return the actual key once, during creation
        keyId: createdKey.keyId,
        environment: createdKey.environment,
        name: createdKey.name,
      }, { status: 201 });
    } catch (error) {
      console.error('Error generating API key:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
  
  async function revokeApiKey(req: NextRequest, userId: string) {
    try {
      const body = await req.json();
      const { keyId } = body;
      
      if (!keyId) {
        return NextResponse.json(
          { error: 'Key ID is required' },
          { status: 400 }
        );
      }
  
      // Update API key to inactive
      const updatedKey = await prisma.apiKey.updateMany({
        where: {
          keyId,
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        }
      });
  
      if (updatedKey.count === 0) {
        return NextResponse.json(
          { error: 'API key not found or already revoked' },
          { status: 404 }
        );
      }
  
      return NextResponse.json(
        { message: 'API key revoked successfully' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Error revoking API key:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
  
  // 2FA Handler
  export async function handle2FA(req: NextRequest) {
    const { method } = req;
    const userId = await getUserIdFromRequest(req);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  
    switch (method) {
      case 'POST':
        return setup2FA(req, userId);
      case 'PUT':
        return verify2FA(req, userId);
      case 'DELETE':
        return disable2FA(req, userId);
      default:
        return NextResponse.json(
          { error: `Method ${method} not allowed` },
          { 
            status: 405,
            headers: { 'Allow': 'POST, PUT, DELETE' }
          }
        );
    }
  }
  
  async function setup2FA(req: NextRequest, userId: string) {
    try {
      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: 'NEDA Pay',
        issuer: userId,
        length: 32,
      });
  
      // Store encrypted secret temporarily (not enabled until verified)
      await prisma.merchantSettings.upsert({
        where: { userId },
        update: {
          twoFactorSecret: secret.base32, // In production, encrypt this
          updatedAt: new Date(),
        },
        create: {
          userId,
          twoFactorSecret: secret.base32,
        }
      });
  
      return NextResponse.json({
        secret: secret.base32,
        qrCode: secret.otpauth_url,
      }, { status: 200 });
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
  
  async function verify2FA(req: NextRequest, userId: string) {
    try {
      const body = await req.json();
      const { token } = body;
      
      if (!token) {
        return NextResponse.json(
          { error: 'Token is required' },
          { status: 400 }
        );
      }
  
      const settings = await prisma.merchantSettings.findUnique({
        where: { userId }
      });
  
      if (!settings?.twoFactorSecret) {
        return NextResponse.json(
          { error: '2FA setup not initiated' },
          { status: 400 }
        );
      }
  
      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: settings.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps of tolerance
      });
  
      if (!verified) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 400 }
        );
      }
  
      // Enable 2FA
      await prisma.merchantSettings.update({
        where: { userId },
        data: {
          twoFactorEnabled: true,
          updatedAt: new Date(),
        }
      });
  
      return NextResponse.json(
        { message: '2FA enabled successfully' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
  
  async function disable2FA(req: NextRequest, userId: string) {
    try {
      const body = await req.json();
      const { token } = body;
      
      const settings = await prisma.merchantSettings.findUnique({
        where: { userId }
      });
  
      if (!settings?.twoFactorEnabled || !settings.twoFactorSecret) {
        return NextResponse.json(
          { error: '2FA is not enabled' },
          { status: 400 }
        );
      }
  
      // Verify token before disabling
      const verified = speakeasy.totp.verify({
        secret: settings.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2,
      });
  
      if (!verified) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 400 }
        );
      }
  
      // Disable 2FA
      await prisma.merchantSettings.update({
        where: { userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          updatedAt: new Date(),
        }
      });
  
      return NextResponse.json(
        { message: '2FA disabled successfully' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }