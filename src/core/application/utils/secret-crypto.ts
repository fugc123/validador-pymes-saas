import * as crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';

function deriveAesKey(): Buffer {
  const material =
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'cajasegura-dev-memory-key';
  return crypto.createHash('sha256').update(material, 'utf8').digest();
}

export function encryptSecretAtRest(plain: string | null | undefined): string | null {
  if (!plain || !plain.trim()) return null;
  if (plain.startsWith(ENC_PREFIX)) return plain;

  const key = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretAtRest(stored: string | null | undefined): string | null {
  if (!stored || !stored.trim()) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const rest = stored.slice(ENC_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, tagHex, dataHex] = parts;
  const key = deriveAesKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
