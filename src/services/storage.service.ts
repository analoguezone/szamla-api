import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import crypto from 'crypto';
import { AppError } from '@utils/errors';

/**
 * Storage Service
 *
 * Handles file storage operations for PDFs, XMLs, and other documents
 */

export interface StorageFile {
  path: string;
  filename: string;
  size: number;
  mimeType: string;
}

export class StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.STORAGE_PATH || './storage';
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.baseDir,
      path.join(this.baseDir, 'invoices', 'pdf'),
      path.join(this.baseDir, 'invoices', 'xml'),
      path.join(this.baseDir, 'temp'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Save invoice PDF
   */
  async saveInvoicePDF(
    organizationId: string,
    invoiceId: string,
    buffer: Buffer
  ): Promise<StorageFile> {
    const filename = `${invoiceId}.pdf`;
    const relativePath = path.join('invoices', 'pdf', organizationId, filename);
    const fullPath = path.join(this.baseDir, relativePath);

    // Ensure organization directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    // Get file stats
    const stats = await fs.stat(fullPath);

    return {
      path: relativePath,
      filename,
      size: stats.size,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Save NAV XML
   */
  async saveNAVXML(
    organizationId: string,
    invoiceId: string,
    xml: string
  ): Promise<StorageFile> {
    const filename = `${invoiceId}.xml`;
    const relativePath = path.join('invoices', 'xml', organizationId, filename);
    const fullPath = path.join(this.baseDir, relativePath);

    // Ensure organization directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, xml, 'utf-8');

    // Get file stats
    const stats = await fs.stat(fullPath);

    return {
      path: relativePath,
      filename,
      size: stats.size,
      mimeType: 'application/xml',
    };
  }

  /**
   * Get file as buffer
   */
  async getFile(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, relativePath);

    try {
      return await fs.readFile(fullPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }
      throw error;
    }
  }

  /**
   * Get file stream (for large files)
   */
  getFileStream(relativePath: string): NodeJS.ReadableStream {
    const fullPath = path.join(this.baseDir, relativePath);
    return createReadStream(fullPath);
  }

  /**
   * Check if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(relativePath: string): Promise<{
    size: number;
    createdAt: Date;
    modifiedAt: Date;
  }> {
    const fullPath = path.join(this.baseDir, relativePath);
    const stats = await fs.stat(fullPath);

    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  }

  /**
   * Save temporary file
   */
  async saveTempFile(buffer: Buffer, extension: string = 'tmp'): Promise<string> {
    const filename = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
    const relativePath = path.join('temp', filename);
    const fullPath = path.join(this.baseDir, relativePath);

    await fs.writeFile(fullPath, buffer);

    return relativePath;
  }

  /**
   * Cleanup old temporary files
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<number> {
    const tempDir = path.join(this.baseDir, 'temp');
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = olderThanHours * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const storageService = new StorageService();
