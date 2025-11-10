import crypto from 'crypto';
import { config } from '@config/index';
import { AppError } from '@utils/errors';

/**
 * Encryption Service
 *
 * Handles encryption and decryption of sensitive data (NAV credentials)
 * using AES-256-GCM (authenticated encryption).
 *
 * Format: iv:authTag:encryptedData (all base64 encoded)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits

export class EncryptionService {
  private readonly encryptionKey: Buffer;

  constructor() {
    // Validate encryption key
    if (!config.security.encryptionKey) {
      throw new AppError(
        'ENCRYPTION_KEY is not configured',
        500,
        'ENCRYPTION_KEY_MISSING'
      );
    }

    // Ensure key is 32 bytes (256 bits) for AES-256
    const keyHex = config.security.encryptionKey;
    if (keyHex.length !== 64) {
      throw new AppError(
        'ENCRYPTION_KEY must be 32 bytes (64 hex characters)',
        500,
        'INVALID_ENCRYPTION_KEY'
      );
    }

    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt a string value
   *
   * @param plaintext - The value to encrypt
   * @returns Encrypted string in format: iv:authTag:encryptedData
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new AppError('Cannot encrypt empty value', 400, 'ENCRYPTION_ERROR');
    }

    try {
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData (all base64)
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      throw new AppError(
        'Encryption failed',
        500,
        'ENCRYPTION_ERROR',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Decrypt an encrypted string
   *
   * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      throw new AppError('Cannot decrypt empty value', 400, 'DECRYPTION_ERROR');
    }

    try {
      // Parse the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new Error('Invalid encrypted data format');
      }

      const ivBase64 = parts[0];
      const authTagBase64 = parts[1];
      const encrypted = parts[2];

      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new AppError(
        'Decryption failed',
        500,
        'DECRYPTION_ERROR',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Encrypt NAV credentials
   *
   * @param credentials - NAV credentials object
   * @returns Encrypted credentials
   */
  encryptNAVCredentials(credentials: {
    technicalUser: string;
    password: string;
    signatureKey: string;
    exchangeKey: string;
  }): {
    technicalUser: string;
    passwordEncrypted: string;
    signatureKeyEncrypted: string;
    exchangeKeyEncrypted: string;
  } {
    return {
      technicalUser: credentials.technicalUser, // Not encrypted
      passwordEncrypted: this.encrypt(credentials.password),
      signatureKeyEncrypted: this.encrypt(credentials.signatureKey),
      exchangeKeyEncrypted: this.encrypt(credentials.exchangeKey),
    };
  }

  /**
   * Decrypt NAV credentials
   *
   * @param encryptedCredentials - Encrypted NAV credentials
   * @returns Decrypted credentials
   */
  decryptNAVCredentials(encryptedCredentials: {
    technicalUser: string;
    passwordEncrypted: string;
    signatureKeyEncrypted: string;
    exchangeKeyEncrypted: string;
  }): {
    technicalUser: string;
    password: string;
    signatureKey: string;
    exchangeKey: string;
  } {
    return {
      technicalUser: encryptedCredentials.technicalUser,
      password: this.decrypt(encryptedCredentials.passwordEncrypted),
      signatureKey: this.decrypt(encryptedCredentials.signatureKeyEncrypted),
      exchangeKey: this.decrypt(encryptedCredentials.exchangeKeyEncrypted),
    };
  }

  /**
   * Hash a value using SHA-256
   * Useful for API key hashing (one-way)
   *
   * @param value - Value to hash
   * @returns Hex-encoded hash
   */
  hash(value: string): string {
    if (!value) {
      throw new AppError('Cannot hash empty value', 400, 'HASH_ERROR');
    }

    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a random token
   * Useful for API keys
   *
   * @param length - Length in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate an API key with prefix
   * Format: sk_live_<random> or sk_test_<random>
   *
   * @param isTest - Whether this is a test key
   * @returns API key
   */
  generateAPIKey(isTest: boolean = false): string {
    const prefix = isTest ? 'sk_test' : 'sk_live';
    const randomPart = this.generateRandomToken(32);
    return `${prefix}_${randomPart}`;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
