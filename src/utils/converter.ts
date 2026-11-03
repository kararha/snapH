import { jsPDF } from 'jspdf';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export type MaxDimension = 'original' | 3840 | 1920 | 1200 | 800;

export type PdfPageFormat = 'a4' | 'letter' | 'fit';
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';
export type PdfMargin = 'none' | 'small' | 'normal';

export interface PdfExportOptions {
  pageFormat: PdfPageFormat;
  orientation: PdfOrientation;
  margin: PdfMargin;
}

export interface ConversionOptions {
  format: OutputFormat;
  quality: number; // 0.1 to 1.0
  maxDimension: MaxDimension;
  stripMetadata: boolean;
  pdfOptions?: PdfExportOptions;
}

export const SUPPORTED_EXTENSIONS = [
  '.heic',
  '.heif',
  '.webp',
  '.avif',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
];

export const SUPPORTED_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/webp',
  'image/avif',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

export function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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
export function loadImage(src: string): Promise<HTMLImageElement> {
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
 * Helper to compute PDF page dimensions and margin in points (pt)
 */
function getPdfGeometry(
  imgW: number,
  imgH: number,
  pdfOptions: PdfExportOptions = { pageFormat: 'a4', orientation: 'auto', margin: 'none' }
) {
  // Margin in points (pt)
  let marginPt = 0;
  if (pdfOptions.margin === 'small') marginPt = 20; // ~7mm
  if (pdfOptions.margin === 'normal') marginPt = 40; // ~14mm

  // Determine orientation
  let isLandscape = false;
  if (pdfOptions.orientation === 'auto') {
    isLandscape = imgW > imgH;
  } else {
    isLandscape = pdfOptions.orientation === 'landscape';
  }

  let pageW = 0;
  let pageH = 0;

  if (pdfOptions.pageFormat === 'a4') {
    // A4 in pt: 595.28 x 841.89
    const baseW = 595.28;
    const baseH = 841.89;
    pageW = isLandscape ? baseH : baseW;
    pageH = isLandscape ? baseW : baseH;
  } else if (pdfOptions.pageFormat === 'letter') {
    // US Letter in pt: 612 x 792
    const baseW = 612;
    const baseH = 792;
    pageW = isLandscape ? baseH : baseW;
    pageH = isLandscape ? baseW : baseH;
  } else {
    // 'fit' - fit image exactly + margins
    pageW = imgW + 2 * marginPt;
    pageH = imgH + 2 * marginPt;
  }

  // Printable area inside margins
  const availW = Math.max(pageW - 2 * marginPt, 1);
  const availH = Math.max(pageH - 2 * marginPt, 1);

  // Fit image into printable area preserving aspect ratio
  const scale = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // Center on page
  const drawX = marginPt + (availW - drawW) / 2;
  const drawY = marginPt + (availH - drawH) / 2;

  return {
    pageW,
    pageH,
    drawX,
    drawY,
    drawW,
    drawH,
    orientation: isLandscape ? ('landscape' as const) : ('portrait' as const),
  };
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
    const imgDataUrl = canvas.toDataURL('image/jpeg', options.quality);
    const pdfOpts: PdfExportOptions = options.pdfOptions || {
      pageFormat: 'a4',
      orientation: 'auto',
      margin: 'none',
    };

    const geom = getPdfGeometry(targetWidth, targetHeight, pdfOpts);

    const pdf = new jsPDF({
      orientation: geom.orientation,
      unit: 'pt',
      format: [geom.pageW, geom.pageH],
      hotfixes: ['px_scaling'],
    });

    pdf.addImage(imgDataUrl, 'JPEG', geom.drawX, geom.drawY, geom.drawW, geom.drawH);
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
 * Converts a Word (.docx) document to PDF in the browser using docx-preview + html2canvas
 */
export async function convertDocxToPdf(file: File): Promise<Blob> {
  const [{ renderAsync }, { default: html2canvas }] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
  ]);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 width in 96dpi
  container.style.padding = '20px';
  container.style.background = '#FFFFFF';
  container.style.color = '#000000';
  document.body.appendChild(container);

  try {
    await renderAsync(file, container);
    
    // Give browser a moment to render fonts and layout
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      scale: 1.5,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [canvas.width * 0.75, canvas.height * 0.75],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width * 0.75, canvas.height * 0.75);
    return pdf.output('blob');
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Main conversion handler supporting HEIC, WebP, AVIF, PNG, JPEG, and DOCX inputs
 * to JPEG, PNG, WebP, or PDF outputs.
 */
export async function convertImageFile(
  file: File,
  options: ConversionOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  // If file is Word DOCX
  if (isDocxFile(file)) {
    const pdfBlob = await convertDocxToPdf(file);
    return { blob: pdfBlob, width: 794, height: 1123 };
  }

  let intermediateUrl: string | null = null;

  try {
    if (isHeicFile(file)) {
      // Decode HEIC using dynamically imported heic2any
      const heic2any = (await import('heic2any')).default;
      const decodedResult = await heic2any({
        blob: file,
        toType: 'image/png',
      });
      const decodedBlob = Array.isArray(decodedResult) ? decodedResult[0] : decodedResult;
      intermediateUrl = URL.createObjectURL(decodedBlob);
    } else {
      // Non-HEIC (WebP, AVIF, PNG, JPEG)
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
 * with custom page formatting (A4, Letter, Fit), orientation, and margins.
 */
export async function createMergedPdf(
  items: { blob: Blob; name: string }[],
  pdfOptions: PdfExportOptions = { pageFormat: 'a4', orientation: 'auto', margin: 'none' }
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

      // Draw onto canvas to ensure clean RGB JPEG encoding
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const geom = getPdfGeometry(width, height, pdfOptions);

      if (i === 0) {
        pdf = new jsPDF({
          orientation: geom.orientation,
          unit: 'pt',
          format: [geom.pageW, geom.pageH],
          hotfixes: ['px_scaling'],
        });
      } else {
        pdf!.addPage([geom.pageW, geom.pageH], geom.orientation);
      }

      pdf!.addImage(dataUrl, 'JPEG', geom.drawX, geom.drawY, geom.drawW, geom.drawH);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  if (!pdf) {
    throw new Error('Failed to create PDF document');
  }

  return pdf.output('blob');
}
