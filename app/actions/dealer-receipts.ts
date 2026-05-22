'use server'

export type UploadDealerReceiptResult =
  | { success: true; receiptId: string }
  | { success: false; error: string }

export async function uploadDealerReceipt(
  _formData: FormData
): Promise<UploadDealerReceiptResult> {
  throw new Error('Not implemented')
}
