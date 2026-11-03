import { jsPDF } from 'jspdf';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export type MaxDimension = 'original' | 3840 | 1920 | 1200 | 800;

export interface ConversionOptions {
  format: OutputFormat;
  quality: number; // 0.1 to 1.0
  maxDimension: MaxDimension;
  stripMetadata: boolean;
}

export const SUPPORTED_EXTENSIONS = [
  '.heic',
  '.heif',
  '.webp',
  '.avif',
  '.png',
  '.jpg',
  '.jpeg',
];

export const SUPPORTED_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/webp',
  'image/avif',
  'image/png',
  'image/jpeg',
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
  const hasValidMime = SUPPORTED_MIME_TYPES.includes(file.type.toLowerCase());
  return (hasValidExt || hasValidMime) && file.size <= MAX_FILE_SIZE;
}

export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

export function getTargetExtension(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'jpg';
  }
}

/**
 * Loads an image from a blob or object URL and resolves with the HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image in browser: ' + e));
    img.src = src;
  });
}

/**
 * Calculates resized dimensions while maintaining original aspect ratio
 */
export function calculateDimensions(
  width: number,
  height: number,
  maxDim: MaxDimension
): { width: number; height: number } {
  if (maxDim === 'original') {
    return { width, height };
  }

  const targetMax = typeof maxDim === 'number' ? maxDim : parseInt(maxDim, 10);
  if (isNaN(targetMax) || (width <= targetMax && height <= targetMax)) {
    return { width, height };
  }

  if (width >= height) {
    const ratio = targetMax / width;
    return {
      width: targetMax,
      height: Math.round(height * ratio),
    };
  } else {
    const ratio = targetMax / height;
    return {
      width: Math.round(width * ratio),
      height: targetMax,
    };
  }
}

/**
 * Converts an image element to a Blob using HTMLCanvasElement,
 * applying downscaling, format conversion, and EXIF/metadata stripping.
 */
async function canvasToBlob(
  img: HTMLImageElement,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width: targetWidth, height: targetHeight } = calculateDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    options.maxDimension
  );

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // If converting to JPEG or PDF, fill background with white (PNGs or transparent WEBP would otherwise turn black)
  if (options.format === 'image/jpeg' || options.format === 'application/pdf') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  if (options.format === 'application/pdf') {
    // Generate single-page PDF with high quality JPEG compression
    const imgDataUrl = canvas.toDataURL('image/jpeg', options.quality);
    const orientation = targetWidth > targetHeight ? 'landscape' : 'portrait';
    
    // Create PDF with dimensions matched to image in points (or mm)
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [targetWidth, targetHeight],
      hotfixes: ['px_scaling'],
    });

    pdf.addImage(imgDataUrl, 'JPEG', 0, 0, targetWidth, targetHeight);
    const pdfBlob = pdf.output('blob');
    return { blob: pdfBlob, width: targetWidth, height: targetHeight };
  }

  // Handle image/jpeg, image/png, image/webp
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image to ' + options.format));
          return;
        }
        resolve({ blob, width: targetWidth, height: targetHeight });
      },
      options.format,
      options.quality
    );
  });
}

/**
 * Main conversion handler supporting HEIC, WebP, AVIF, PNG, and JPEG inputs
 * to JPEG, PNG, WebP, or PDF outputs.
 */
export async function convertImageFile(
  file: File,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  let intermediateUrl: string | null = null;

  try {
    if (isHeicFile(file)) {
      // Step 1: Decode HEIC using heic2any (dynamically loaded on-demand)
      const heic2any = (await import('heic2any')).default;
      const decodedResult = await heic2any({
        blob: file,
        toType: 'image/png',
      });
      const decodedBlob = Array.isArray(decodedResult) ? decodedResult[0] : decodedResult;
      intermediateUrl = URL.createObjectURL(decodedBlob);
    } else {
      // Step 1 for non-HEIC (WebP, AVIF, PNG, JPEG): directly use object URL
      intermediateUrl = URL.createObjectURL(file);
    }

    const img = await loadImage(intermediateUrl);
    const result = await canvasToBlob(img, options);
    return result;
  } finally {
    if (intermediateUrl) {
      URL.revokeObjectURL(intermediateUrl);
    }
  }
}

/**
 * Merges multiple images into a single multi-page PDF document
 */
export async function createMergedPdf(
  items: { blob: Blob; name: string }[]
): Promise<Blob> {
  if (items.length === 0) {
    throw new Error('No items to merge into PDF');
  }

  let pdf: jsPDF | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const objectUrl = URL.createObjectURL(item.blob);
    try {
      const img = await loadImage(objectUrl);
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
      const orientation = width > height ? 'landscape' : 'portrait';

      if (i === 0) {
        pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
        });
      } else {
        pdf!.addPage([width, height], orientation);
      }

      // Create a canvas to convert to clean JPEG data url
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        pdf!.addImage(dataUrl, 'JPEG', 0, 0, width, height);
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  if (!pdf) {
    throw new Error('Failed to create PDF document');
  }

  return pdf.output('blob');
}

