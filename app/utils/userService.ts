// utils/userService.ts
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface PrivyUser {
  id: string;
  email?: { address: string };
  wallet?: { address: string };
  phone?: { number: string };
}

export interface UserData {
  id: string;
  email: string | null;
  wallet: string | null;
  privyUserId: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create or update user when they sign in with Privy
export async function syncPrivyUser(privyUser: PrivyUser): Promise<UserData> {
  try {
    const userData = {
      privyUserId: privyUser.id,
      email: privyUser.email?.address,
      name: null, // Can be updated later
      isActive: true,
      wallet: privyUser.wallet?.address,
    };

    const user = await prisma.user.upsert({
      where: { privyUserId: privyUser.id },
      update: {
        email: userData.email ? { set: userData.email } : undefined,
        updatedAt: new Date(),
      },
      create: userData,
    });

    console.log('User synced successfully:', user.id);
    return user;
  } catch (error) {
    console.error('Error syncing Privy user:', error);
    throw new Error('Failed to sync user data');
  }
}


// Get user by Privy ID
export async function getUserByPrivyId(privyUserId: string): Promise<UserData | null> {
  try {
    return await prisma.user.findUnique({
      where: { privyUserId },
    });
  } catch (error) {
    console.error('Error fetching user by Privy ID:', error);
    return null;
  }
}

// Get user by email
export async function getUserByEmail(email: string): Promise<UserData | null> {
  try {
    return await prisma.user.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

// Get user by wallet address
export async function getUserByWallet(wallet: string): Promise<UserData | null> {
  try {
    return await prisma.user.findUnique({
      where: { wallet },
    });
  } catch (error) {
    console.error('Error fetching user by wallet:', error);
    return null;
  }
}

// Update user profile
export async function updateUserProfile(
  privyUserId: string, 
  updates: { name?: string; email?: string }
): Promise<UserData> {
  try {
    const user = await prisma.user.update({
      where: { privyUserId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    console.log('User profile updated:', user.id);
    return user;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error('Failed to update user profile');
  }
}

