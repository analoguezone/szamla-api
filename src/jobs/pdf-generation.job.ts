import { Worker, Job } from 'bullmq';
import { queueConnection, QueueName, workerConcurrency } from '@config/queue.config';
import { pdfService } from '@services/pdf.service';
import { storageService } from '@services/storage.service';
import { db } from '@config/database';
import { logger } from '@config/logger';

/**
 * PDF Generation Job
 *
 * Generates PDF for invoices in the background
 */

export interface PDFGenerationJobData {
  invoiceId: string;
  organizationId: string;
}

/**
 * Process PDF generation job
 */
async function processPDFGeneration(job: Job<PDFGenerationJobData>): Promise<void> {
  const { invoiceId, organizationId } = job.data;

  logger.info(`Generating PDF for invoice ${invoiceId}`, {
    jobId: job.id,
    invoiceId,
    organizationId,
  });

  try {
    // Fetch invoice with all relations
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        organization: true,
        partner: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new Error('Organization mismatch');
    }

    // Generate PDF
    const pdfBuffer = await pdfService.generateInvoicePDF(invoice);

    // Save PDF to storage
    const storageFile = await storageService.saveInvoicePDF(
      organizationId,
      invoiceId,
      pdfBuffer
    );

    // Update invoice with PDF path
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        pdfPath: storageFile.path,
      },
    });

    logger.info(`PDF generated successfully for invoice ${invoiceId}`, {
      jobId: job.id,
      invoiceId,
      pdfPath: storageFile.path,
      fileSize: storageFile.size,
    });
  } catch (error: any) {
    logger.error(`Failed to generate PDF for invoice ${invoiceId}`, {
      jobId: job.id,
      invoiceId,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Create and export the PDF generation worker
 */
export function createPDFGenerationWorker(): Worker<PDFGenerationJobData> {
  return new Worker<PDFGenerationJobData>(
    QueueName.PDF_GENERATION,
    processPDFGeneration,
    {
      connection: queueConnection,
      concurrency: workerConcurrency[QueueName.PDF_GENERATION],
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 60000, // 1 minute
      },
    }
  );
}
