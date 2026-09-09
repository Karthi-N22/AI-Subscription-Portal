import { prisma } from '../prisma.js'

export async function saveInvoiceUpload(subscriptionId: string, month: string, file: { originalname: string; buffer: Buffer; mimetype: string; size: number }, uploadedBy?: string) {
  return prisma.invoiceUpload.upsert({
    where: { subscriptionId_month: { subscriptionId, month } },
    create: { subscriptionId, month, fileName: file.originalname, mimeType: file.mimetype, data: file.buffer, sizeBytes: file.size, uploadedBy },
    update: { fileName: file.originalname, mimeType: file.mimetype, data: file.buffer, sizeBytes: file.size, uploadedBy },
    select: { id: true, subscriptionId: true, month: true, fileName: true, sizeBytes: true, createdAt: true },
  })
}

// Falls back to "no uploads yet" instead of throwing when Postgres isn't configured/reachable -
// invoice file uploads are an optional feature and must never break the base invoice list.
export async function listInvoiceUploads(month: string, subscriptionIds: string[]) {
  try {
    return await prisma.invoiceUpload.findMany({ where: { month, subscriptionId: { in: subscriptionIds } }, select: { id: true, subscriptionId: true, fileName: true, createdAt: true } })
  } catch (error) {
    console.warn('Unable to load invoice uploads (falling back to none):', error instanceof Error ? error.message : error)
    return []
  }
}

export function getInvoiceFile(id: string) {
  return prisma.invoiceUpload.findUnique({ where: { id }, select: { fileName: true, mimeType: true, data: true } })
}
