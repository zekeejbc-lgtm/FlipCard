/**
 * DriveImage - Resilient Google Drive Image Component
 * 
 * A highly resilient image component for displaying Google Drive images.
 * Implements automatic fallback logic when primary URLs fail to load.
 * 
 * Features:
 * - Cache busting to ensure fresh images
 * - Multiple fallback URL strategies
 * - Graceful degradation to placeholder
 * - Loading states
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { extractDriveFileId, generateDriveUrls, addCacheBuster } from '../utils/imageUtils';

// =====================================================
// TYPES
// =====================================================

export interface DriveImageProps {
  /** The primary image URL (can be any Google Drive URL format) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Placeholder to show when all fallbacks fail */
  fallbackPlaceholder?: React.ReactNode;
  /** Whether to add cache-busting timestamp */
  cacheBust?: boolean;
  /** Maximum number of fallback attempts before showing placeholder */
  maxFallbackAttempts?: number;
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when all fallbacks fail */
  onAllFallbacksFailed?: () => void;
  /** Preferred size for thumbnail fallback (w100, w200, w500, w1000) */
  thumbnailSize?: number;
  /** Object-fit CSS property */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

// Default placeholder icon component
const DefaultPlaceholder = ({ className }: { className?: string }) => (
  <div 
    className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className || ''}`}
    style={{ minWidth: 40, minHeight: 40 }}
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  </div>
);

// =====================================================
// COMPONENT
// =====================================================

export const DriveImage: React.FC<DriveImageProps> = ({
  src,
  alt,
  className = '',
  style,
  fallbackPlaceholder,
  cacheBust = true,
  maxFallbackAttempts = 3,
  onLoad,
  onAllFallbacksFailed,
  thumbnailSize = 500,
  objectFit = 'cover'
}) => {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Generate fallback URLs based on extracted file ID
  const fallbackUrls = useMemo(() => {
    if (!src) return [];
    
    const fileId = extractDriveFileId(src);
    
    if (!fileId) {
      // If we can't extract a file ID, just use the original URL
      return [src];
    }
    
    const urls = generateDriveUrls(fileId);
    
    // Order: primary googleusercontent -> thumbnail -> direct
    return [
      urls.primary,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${thumbnailSize}`,
      urls.direct
    ];
  }, [src, thumbnailSize]);
  
  // Get current URL with optional cache busting
  const currentUrl = useMemo(() => {
    const url = fallbackUrls[currentUrlIndex];
    if (!url) return '';
    return cacheBust ? addCacheBuster(url) : url;
  }, [fallbackUrls, currentUrlIndex, cacheBust]);
  
  // Reset state when src changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setIsLoading(true);
    setHasError(false);
  }, [src]);
  
  // Handle successful load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);
  
  // Handle error - try next fallback URL
  const handleError = useCallback(() => {
    const nextIndex = currentUrlIndex + 1;
    
    if (nextIndex < fallbackUrls.length && nextIndex < maxFallbackAttempts) {
      // Try next fallback URL
      setCurrentUrlIndex(nextIndex);
    } else {
      // All fallbacks failed
      setIsLoading(false);
      setHasError(true);
      onAllFallbacksFailed?.();
    }
  }, [currentUrlIndex, fallbackUrls.length, maxFallbackAttempts, onAllFallbacksFailed]);
  
  // If no src provided or all fallbacks failed
  if (!src || hasError) {
    return (
      <>
        {fallbackPlaceholder || <DefaultPlaceholder className={className} />}
      </>
    );
  }
  
  return (
    <>
      {isLoading && (
        <div 
          className={`animate-pulse bg-gray-200 ${className}`}
          style={style}
        />
      )}
      <img
        src={currentUrl}
        alt={alt}
        className={className}
        style={{
          ...style,
          objectFit,
          display: isLoading ? 'none' : 'block'
        }}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </>
  );
};

// =====================================================
// SPECIALIZED VARIANTS
// =====================================================

/**
 * Profile picture variant with circular styling
 */
export interface ProfileImageProps extends Omit<DriveImageProps, 'thumbnailSize'> {
  size?: number | string;
}

export const ProfileImage: React.FC<ProfileImageProps> = ({
  size = 48,
  className = '',
  style,
  ...props
}) => {
  const sizeStyle = typeof size === 'number' ? `${size}px` : size;
  
  return (
    <DriveImage
      {...props}
      className={`rounded-full ${className}`}
      style={{
        width: sizeStyle,
        height: sizeStyle,
        ...style
      }}
      thumbnailSize={200}
      fallbackPlaceholder={
        <div 
          className={`rounded-full bg-gray-200 flex items-center justify-center text-gray-400 ${className}`}
          style={{ width: sizeStyle, height: sizeStyle }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={typeof size === 'number' ? size * 0.5 : 24} 
            height={typeof size === 'number' ? size * 0.5 : 24}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      }
    />
  );
};

/**
 * Signature image variant
 */
export const SignatureImage: React.FC<DriveImageProps> = ({
  className = '',
  ...props
}) => {
  return (
    <DriveImage
      {...props}
      className={`max-w-full h-auto ${className}`}
      objectFit="contain"
      fallbackPlaceholder={
        <div className={`bg-gray-100 text-gray-400 p-4 text-center text-sm ${className}`}>
          Signature unavailable
        </div>
      }
    />
  );
};

export default DriveImage;
