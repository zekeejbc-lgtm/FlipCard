/**
 * Image Upload Utilities - CORS-Resilient System
 * 
 * This module provides utilities for uploading images to Google Drive
 * via Google Apps Script, and extracting file IDs for fallback rendering.
 */

// =====================================================
// TYPES
// =====================================================

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  url?: string;
  alternativeUrls?: {
    googleusercontent: string;
    thumbnail: string;
    driveView: string;
  };
  error?: string;
}

export interface ImageUploadOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  folderId?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

// =====================================================
// PHASE 1: Image Validation & Preparation
// =====================================================

/**
 * Validate an image file before upload
 * @param file - The File object to validate
 * @param options - Validation options
 */
export function validateImage(
  file: File,
  options: ImageUploadOptions = {}
): ImageValidationResult {
  const maxSizeMB = options.maxSizeMB ?? DEFAULT_MAX_SIZE_MB;
  const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  
  // Check file type
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`
    };
  }
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`
    };
  }
  
  return { valid: true };
}

/**
 * Create an instant local preview URL for an image file
 * Returns a cleanup function to prevent memory leaks
 * @param file - The File object
 */
export function createImagePreview(file: File): { url: string; cleanup: () => void } {
  const url = URL.createObjectURL(file);
  return {
    url,
    cleanup: () => URL.revokeObjectURL(url)
  };
}

/**
 * Convert a File to base64 string (stripped of data URL prefix)
 * @param file - The File object to convert
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

// =====================================================
// PHASE 2: CORS-Safe Upload
// =====================================================

/**
 * Upload an image to Google Drive via GAS backend
 * Uses text/plain Content-Type to bypass CORS preflight
 * 
 * @param gasUrl - The Google Apps Script web app URL
 * @param file - The File object to upload
 * @param options - Upload options
 */
export async function uploadImageToGAS(
  gasUrl: string,
  file: File,
  options: ImageUploadOptions = {}
): Promise<UploadResult> {
  // Validate first
  const validation = validateImage(file, options);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    // Convert to base64
    const base64Data = await fileToBase64(file);
    
    // Prepare payload
    const payload = {
      action: 'uploadImage',
      base64Data: base64Data,
      fileName: file.name,
      mimeType: file.type,
      folderId: options.folderId
    };
    
    // CRITICAL: Use text/plain to bypass CORS preflight
    // GAS does not handle OPTIONS requests properly
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        fileId: result.fileId,
        url: result.url,
        alternativeUrls: result.alternativeUrls
      };
    } else {
      return {
        success: false,
        error: result.error || 'Upload failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Upload profile picture specifically
 * Uses the uploadProfilePicture action with proper naming
 */
export async function uploadProfilePicture(
  gasUrl: string,
  file: File,
  userData: { idNumber: string; firstName?: string; lastName?: string }
): Promise<UploadResult> {
  // Validate first
  const validation = validateImage(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const base64Data = await fileToBase64(file);
    
    const payload = {
      action: 'uploadProfilePicture',
      data: base64Data,
      fileName: file.name,
      mimeType: file.type,
      idNumber: userData.idNumber,
      firstName: userData.firstName,
      lastName: userData.lastName
    };
    
    // CRITICAL: Use text/plain to bypass CORS preflight
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        fileId: result.fileId,
        url: result.url
      };
    } else {
      return {
        success: false,
        error: result.error || 'Upload failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// =====================================================
// PHASE 4: URL Utilities for Fallback System
// =====================================================

/**
 * Extract Google Drive file ID from various URL formats
 * Supports:
 * - https://lh3.googleusercontent.com/d/{fileId}
 * - https://drive.google.com/thumbnail?id={fileId}
 * - https://drive.google.com/uc?export=view&id={fileId}
 * - https://drive.google.com/file/d/{fileId}/view
 * 
 * @param url - The URL to extract file ID from
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  
  // Pattern 1: googleusercontent.com/d/{fileId}
  const googleUserContentMatch = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (googleUserContentMatch) {
    return googleUserContentMatch[1];
  }
  
  // Pattern 2: drive.google.com/thumbnail?id={fileId} or uc?...&id={fileId}
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) {
    return idParamMatch[1];
  }
  
  // Pattern 3: drive.google.com/file/d/{fileId}/
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) {
    return fileDMatch[1];
  }
  
  // Pattern 4: direct file ID (if it matches the pattern)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return url;
  }
  
  return null;
}

/**
 * Generate alternative Google Drive URLs for fallback rendering
 * @param fileId - The Google Drive file ID
 */
export function generateDriveUrls(fileId: string): {
  primary: string;
  thumbnail: string;
  thumbnailLarge: string;
  direct: string;
} {
  return {
    primary: `https://lh3.googleusercontent.com/d/${fileId}`,
    thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`,
    thumbnailLarge: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    direct: `https://drive.google.com/uc?export=view&id=${fileId}`
  };
}

/**
 * Add cache-busting timestamp to a URL
 * @param url - The URL to add cache busting to
 */
export function addCacheBuster(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}
