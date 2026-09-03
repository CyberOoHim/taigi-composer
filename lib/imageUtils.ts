/**
 * Utility functions for handling, validating, resizing, and compressing
 * sheet music and lyric images for Gemini Multimodal API.
 */

export interface PreparedImage {
  id: string;
  name: string;
  mimeType: string;
  base64: string;      // Raw base64 string without data URI prefix
  previewUrl: string;  // Full data URI suitable for <img src="..." />
  size: number;        // Compressed size in bytes
  originalSize: number;// Original file size in bytes
  width: number;
  height: number;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

const MAX_PAGES = 3;
const MAX_DIMENSION = 2048; // Max width or height for score OCR
const DEFAULT_QUALITY = 0.88;

/**
 * Validates selected image files against type and page limits.
 */
export function validateImageFiles(
  files: File[],
  currentCount: number,
  maxCount: number = MAX_PAGES
): { validFiles: File[]; error?: string } {
  if (files.length === 0) {
    return { validFiles: [] };
  }

  const validFiles: File[] = [];
  let errorMsg: string | undefined;

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp|gif|bmp|tiff)$/i.test(file.name)) {
      errorMsg = `Unsupported file format "${file.name}". Please upload JPG, PNG, or WebP images.`;
      continue;
    }
    validFiles.push(file);
  }

  if (currentCount + validFiles.length > maxCount) {
    const allowedToAdd = Math.max(0, maxCount - currentCount);
    const trimmed = validFiles.slice(0, allowedToAdd);
    return {
      validFiles: trimmed,
      error: `A maximum of ${maxCount} score images can be uploaded at once (automatically selected first ${allowedToAdd} pages).`,
    };
  }

  return { validFiles, error: errorMsg };
}

/**
 * Loads an image file, downscales it to maxDim (preserving aspect ratio),
 * and compresses it to high-clarity JPEG for optimal Gemini OCR processing.
 */
export async function compressAndPrepareImage(
  file: File,
  maxDim: number = MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY
): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error(`Failed to read image file "${file.name}"`));

    reader.onload = (e) => {
      const srcUrl = e.target?.result as string;
      if (!srcUrl) {
        reject(new Error(`File data is empty "${file.name}"`));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error(`Failed to parse image "${file.name}"`));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate downscaled dimensions if exceeding maxDim
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas context fails
          const cleanBase64 = srcUrl.replace(/^data:[^;]+;base64,/, '');
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            mimeType: file.type || 'image/jpeg',
            base64: cleanBase64,
            previewUrl: srcUrl,
            size: file.size,
            originalSize: file.size,
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const cleanBase64 = compressedDataUrl.replace(/^data:image\/jpeg;base64,/, '');
        const compressedSize = Math.round((cleanBase64.length * 3) / 4);

        resolve({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          mimeType: 'image/jpeg',
          base64: cleanBase64,
          previewUrl: compressedDataUrl,
          size: compressedSize,
          originalSize: file.size,
          width,
          height,
        });
      };

      img.src = srcUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable string (e.g. 1.2 MB or 450 KB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
