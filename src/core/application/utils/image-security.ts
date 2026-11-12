import { BadRequestException } from '@nestjs/common';

const MAX_DATA_URI_BYTES = 512 * 1024; // 512 KB max for compressed base64 images

type AllowedMime = 'image/webp' | 'image/jpeg' | 'image/png';

/**
 * Inspects binary magic bytes to verify the decoded payload is genuinely a
 * JPEG, PNG, or WebP image and matches the declared MIME type.
 */
export function detectImageMagicBytes(buf: Buffer): AllowedMime | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x45 && // E
    buf[10] === 0x42 && // B
    buf[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates an image URL or base64 data URI before persisting it.
 * - Rejects SVG, HTML, javascript:, or any non-raster image data URI.
 * - Verifies magic bytes match the declared MIME type for data URIs.
 * - Enforces a maximum decoded size of 512 KB.
 */
export function validateSafeImageUrl(imageUrl?: string | null): string | null {
  if (imageUrl === undefined || imageUrl === null) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      throw new BadRequestException(
        'Formato de imagen no permitido. Solo se aceptan imágenes seguras WebP, JPEG o PNG.',
      );
    }

    const declaredMime = match[1].toLowerCase() as AllowedMime;
    const base64Data = match[2];
    const buf = Buffer.from(base64Data, 'base64');

    if (buf.length > MAX_DATA_URI_BYTES) {
      throw new BadRequestException(
        'La imagen supera el tamaño máximo permitido (512 KB). Comprimila a WebP antes de subir.',
      );
    }

    const detectedMime = detectImageMagicBytes(buf);
    if (!detectedMime || detectedMime !== declaredMime) {
      throw new BadRequestException(
        'Contenido de imagen inválido o alterado: la firma binaria no coincide con una imagen real.',
      );
    }

    return trimmed;
  }

  // External HTTP(S) URL validation
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('La URL de imagen debe usar protocolo https:// o http://.');
    }
    return trimmed;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('URL de imagen inválida.');
  }
}
