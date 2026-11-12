export type DetectedImageFormat = 'jpeg' | 'png' | 'webp';

export interface ProcessedImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  detectedFormat: DetectedImageFormat;
}

const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB input limit
const MAX_DIMENSION_PX = 1024;
const WEBP_QUALITY = 0.8;

/**
 * Reads the first 12 binary bytes of a File to detect its true format
 * independently of filename extension or browser-reported MIME type.
 */
async function detectFileMagicBytes(file: File): Promise<DetectedImageFormat | null> {
  const headerSlice = file.slice(0, 12);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Validates magic bytes, strips EXIF/metadata via Canvas re-render,
 * resizes proportionally up to 1024px, and compresses to WebP.
 */
export async function processImageToWebp(file: File): Promise<ProcessedImageResult> {
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('La imagen supera el máximo de 10 MB.');
  }

  const detectedFormat = await detectFileMagicBytes(file);
  if (!detectedFormat) {
    throw new Error(
      'Archivo rechazado por seguridad: solo se permiten imágenes reales JPEG, PNG o WebP (firma binaria inválida).',
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'));
      el.src = objectUrl;
    });

    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth <= 0 || targetHeight <= 0) {
      throw new Error('Dimensiones de imagen inválidas.');
    }

    if (targetWidth > MAX_DIMENSION_PX || targetHeight > MAX_DIMENSION_PX) {
      const ratio = Math.min(MAX_DIMENSION_PX / targetWidth, MAX_DIMENSION_PX / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Tu navegador no soporta procesamiento gráfico Canvas.');
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const webpDataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
    if (!webpDataUrl.startsWith('data:image/webp;base64,')) {
      throw new Error('Tu navegador no soporta compresión a WebP.');
    }

    const base64Body = webpDataUrl.split(',')[1] || '';
    const compressedBytes = Math.ceil((base64Body.length * 3) / 4);

    return {
      dataUrl: webpDataUrl,
      originalBytes: file.size,
      compressedBytes,
      detectedFormat,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
