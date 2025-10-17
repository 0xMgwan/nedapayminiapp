'use client';

import React from 'react';
import { FarcasterProfile as FarcasterProfileType } from '../hooks/useFarcasterProfile';

interface FarcasterProfileProps {
  profile: FarcasterProfileType;
  className?: string;
  showBio?: boolean;
  showStats?: boolean;
  compact?: boolean;
}

export const FarcasterProfile: React.FC<FarcasterProfileProps> = ({
  profile,
  className = '',
  showBio = false,
  showStats = false,
  compact = false
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <img
          src={profile.pfpUrl}
          alt={`${profile.username} avatar`}
          className="w-6 h-6 rounded-full object-cover border border-gray-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-avatar.svg';
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {profile.displayName}
          </span>
          <span className="text-xs text-gray-500 truncate">
            @{profile.username}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-4 border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-start space-x-3">
        <img
          src={profile.pfpUrl}
          alt={`${profile.username} avatar`}
          className="w-12 h-12 rounded-full object-cover border-2 border-purple-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-avatar.svg';
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {profile.displayName}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Farcaster
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            @{profile.username} • FID: {profile.fid}
          </p>
          
          {showBio && profile.bio && (
            <p className="text-sm text-gray-700 mt-2 line-clamp-2">
              {profile.bio}
            </p>
          )}
          
          {showStats && (
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span>{formatNumber(profile.followerCount)} followers</span>
              </div>
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                </svg>
                <span>{formatNumber(profile.followingCount)} following</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarcasterProfile;
