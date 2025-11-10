import { EncryptionService } from '@services/encryption.service';
import { AppError } from '@utils/errors';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Create a new instance for each test
    encryptionService = new EncryptionService();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext', () => {
      const plaintext = 'same-password';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      // Different ciphertext (due to random IV)
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same value
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle Unicode characters', () => {
      const plaintext = 'Árvíztűrő tükörfúrógép 🚀';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when encrypting empty string', () => {
      expect(() => encryptionService.encrypt('')).toThrow(AppError);
      expect(() => encryptionService.encrypt('')).toThrow('Cannot encrypt empty value');
    });

    it('should throw error when decrypting empty string', () => {
      expect(() => encryptionService.decrypt('')).toThrow(AppError);
      expect(() => encryptionService.decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => encryptionService.decrypt('invalid-format')).toThrow(AppError);
      expect(() => encryptionService.decrypt('invalid-format')).toThrow('Decryption failed');
    });

    it('should throw error when decrypting tampered data', () => {
      const plaintext = 'secret';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      if (parts[2]) {
        parts[2] = parts[2].slice(0, -1) + 'X'; // Change last character
      }
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow(AppError);
      expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
    });
  });

  describe('encryptNAVCredentials and decryptNAVCredentials', () => {
    it('should encrypt and decrypt NAV credentials correctly', () => {
      const credentials = {
        technicalUser: 'user123',
        password: 'password123',
        signatureKey: 'sig-key-abc',
        exchangeKey: 'exch-key-xyz',
      };

      const encrypted = encryptionService.encryptNAVCredentials(credentials);
      const decrypted = encryptionService.decryptNAVCredentials(encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should not encrypt technical user', () => {
      const credentials = {
        technicalUser: 'user123',
        password: 'password123',
        signatureKey: 'sig-key-abc',
        exchangeKey: 'exch-key-xyz',
      };

      const encrypted = encryptionService.encryptNAVCredentials(credentials);

      expect(encrypted.technicalUser).toBe('user123');
      expect(encrypted.passwordEncrypted).not.toBe('password123');
      expect(encrypted.signatureKeyEncrypted).not.toBe('sig-key-abc');
      expect(encrypted.exchangeKeyEncrypted).not.toBe('exch-key-xyz');
    });

    it('should produce different encrypted values on each call', () => {
      const credentials = {
        technicalUser: 'user123',
        password: 'password123',
        signatureKey: 'sig-key-abc',
        exchangeKey: 'exch-key-xyz',
      };

      const encrypted1 = encryptionService.encryptNAVCredentials(credentials);
      const encrypted2 = encryptionService.encryptNAVCredentials(credentials);

      // Different ciphertext
      expect(encrypted1.passwordEncrypted).not.toBe(encrypted2.passwordEncrypted);
      expect(encrypted1.signatureKeyEncrypted).not.toBe(encrypted2.signatureKeyEncrypted);
      expect(encrypted1.exchangeKeyEncrypted).not.toBe(encrypted2.exchangeKeyEncrypted);

      // But both decrypt to same values
      const decrypted1 = encryptionService.decryptNAVCredentials(encrypted1);
      const decrypted2 = encryptionService.decryptNAVCredentials(encrypted2);

      expect(decrypted1).toEqual(credentials);
      expect(decrypted2).toEqual(credentials);
    });
  });

  describe('hash', () => {
    it('should hash a string consistently', () => {
      const value = 'my-api-key';
      const hash1 = encryptionService.hash(value);
      const hash2 = encryptionService.hash(value);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    });

    it('should produce different hashes for different values', () => {
      const hash1 = encryptionService.hash('value1');
      const hash2 = encryptionService.hash('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error when hashing empty string', () => {
      expect(() => encryptionService.hash('')).toThrow(AppError);
      expect(() => encryptionService.hash('')).toThrow('Cannot hash empty value');
    });
  });

  describe('generateRandomToken', () => {
    it('should generate a random token', () => {
      const token = encryptionService.generateRandomToken();

      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/); // Hex string
    });

    it('should generate different tokens each time', () => {
      const token1 = encryptionService.generateRandomToken();
      const token2 = encryptionService.generateRandomToken();

      expect(token1).not.toBe(token2);
    });

    it('should respect custom length', () => {
      const token = encryptionService.generateRandomToken(16);

      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    });
  });

  describe('generateAPIKey', () => {
    it('should generate a live API key by default', () => {
      const apiKey = encryptionService.generateAPIKey();

      expect(apiKey).toMatch(/^sk_live_[0-9a-f]{64}$/);
    });

    it('should generate a test API key when specified', () => {
      const apiKey = encryptionService.generateAPIKey(true);

      expect(apiKey).toMatch(/^sk_test_[0-9a-f]{64}$/);
    });

    it('should generate different API keys each time', () => {
      const key1 = encryptionService.generateAPIKey();
      const key2 = encryptionService.generateAPIKey();

      expect(key1).not.toBe(key2);
    });

    it('should have correct format', () => {
      const liveKey = encryptionService.generateAPIKey(false);
      const testKey = encryptionService.generateAPIKey(true);

      expect(liveKey.startsWith('sk_live_')).toBe(true);
      expect(testKey.startsWith('sk_test_')).toBe(true);

      // Total length: prefix (8 or 8) + underscore + 64 hex chars
      expect(liveKey).toHaveLength(72); // sk_live_ = 8 chars
      expect(testKey).toHaveLength(72); // sk_test_ = 8 chars
    });
  });

  describe('encryption format', () => {
    it('should produce encrypted data in correct format', () => {
      const plaintext = 'test-value';
      const encrypted = encryptionService.encrypt(plaintext);

      // Format: iv:authTag:encryptedData
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // Each part should be valid base64
      parts.forEach((part) => {
        expect(part).toMatch(/^[A-Za-z0-9+/]+=*$/);
      });
    });
  });

  describe('error handling', () => {
    it('should throw AppError with correct error code on encryption failure', () => {
      try {
        encryptionService.encrypt('');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ENCRYPTION_ERROR');
        expect((error as AppError).statusCode).toBe(400);
      }
    });

    it('should throw AppError with correct error code on decryption failure', () => {
      try {
        encryptionService.decrypt('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('DECRYPTION_ERROR');
        expect((error as AppError).statusCode).toBe(500);
      }
    });

    it('should throw AppError with correct error code on hash failure', () => {
      try {
        encryptionService.hash('');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('HASH_ERROR');
        expect((error as AppError).statusCode).toBe(400);
      }
    });
  });
});
