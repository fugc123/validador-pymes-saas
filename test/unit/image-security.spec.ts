import { BadRequestException } from '@nestjs/common';
import {
  detectImageMagicBytes,
  validateSafeImageUrl,
} from '../../src/core/application/utils/image-security';

describe('Image Security & Magic Bytes Validation', () => {
  const validWebpBuf = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20,
  ]);

  const validJpegBuf = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  const validPngBuf = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  it('detects genuine WebP, JPEG, and PNG magic bytes', () => {
    expect(detectImageMagicBytes(validWebpBuf)).toBe('image/webp');
    expect(detectImageMagicBytes(validJpegBuf)).toBe('image/jpeg');
    expect(detectImageMagicBytes(validPngBuf)).toBe('image/png');
    expect(detectImageMagicBytes(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('accepts valid base64 WebP, JPEG, and PNG data URIs', () => {
    const webpUri = `data:image/webp;base64,${validWebpBuf.toString('base64')}`;
    const jpegUri = `data:image/jpeg;base64,${validJpegBuf.toString('base64')}`;
    const pngUri = `data:image/png;base64,${validPngBuf.toString('base64')}`;

    expect(validateSafeImageUrl(webpUri)).toBe(webpUri);
    expect(validateSafeImageUrl(jpegUri)).toBe(jpegUri);
    expect(validateSafeImageUrl(pngUri)).toBe(pngUri);
  });

  it('rejects SVG, HTML, and javascript: payloads', () => {
    const svgUri = `data:image/svg+xml;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;
    expect(() => validateSafeImageUrl(svgUri)).toThrow(BadRequestException);
    expect(() => validateSafeImageUrl('javascript:alert(1)')).toThrow(BadRequestException);
    expect(() => validateSafeImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toThrow(
      BadRequestException,
    );
  });

  it('rejects spoofed MIME headers where magic bytes do not match', () => {
    const spoofedJpegWithPng = `data:image/jpeg;base64,${validPngBuf.toString('base64')}`;
    const spoofedWebpWithText = `data:image/webp;base64,${Buffer.from('not an image at all!').toString('base64')}`;

    expect(() => validateSafeImageUrl(spoofedJpegWithPng)).toThrow(BadRequestException);
    expect(() => validateSafeImageUrl(spoofedWebpWithText)).toThrow(BadRequestException);
  });

  it('rejects oversized data URIs exceeding 512 KB', () => {
    const hugeBuf = Buffer.concat([validWebpBuf, Buffer.alloc(520 * 1024)]);
    const hugeUri = `data:image/webp;base64,${hugeBuf.toString('base64')}`;
    expect(() => validateSafeImageUrl(hugeUri)).toThrow(BadRequestException);
  });

  it('accepts valid https:// and http:// URLs and handles empty/null cleanly', () => {
    expect(validateSafeImageUrl(null)).toBeNull();
    expect(validateSafeImageUrl('   ')).toBeNull();
    expect(validateSafeImageUrl('https://cdn.example.com/foto.webp')).toBe(
      'https://cdn.example.com/foto.webp',
    );
  });
});
