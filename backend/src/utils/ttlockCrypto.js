import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
  const keyHex = process.env.TTLOCK_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('TTLOCK_ENCRYPTION_KEY is not set');
  }

  if (!/^[0-9a-fA-F]+$/.test(keyHex) || keyHex.length < 64) {
    throw new Error('TTLOCK_ENCRYPTION_KEY must be at least 64 hex characters');
  }

  const normalized = keyHex.slice(0, 64);
  return Buffer.from(normalized, 'hex');
};

export const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Encrypted value format invalid');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[TTLockCrypto] Decryption error:', error.message);
    return null;
  }
};

export default {
  encrypt,
  decrypt
};
