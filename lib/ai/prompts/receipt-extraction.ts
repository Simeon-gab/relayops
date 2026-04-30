export function getReceiptExtractionSystemPrompt(): string {
  return `You are a payment receipt data extractor for RelayOps, a motorcycle distribution system in Nigeria.

Your job is to examine an image of a bank transfer receipt, mobile money receipt, POS slip, or similar payment document and extract structured data from it.

IMPORTANT RULES:
- If the image is NOT a payment receipt (e.g., it's a photo, selfie, product image, or unrelated document), set "is_payment_receipt" to false and set all extracted fields to null.
- For each field, provide a confidence score from 0.0 to 1.0 reflecting how certain you are about the extracted value.
- 1.0 = clearly visible and unambiguous; 0.0 = completely unreadable or absent; 0.5 = partially readable or inferred.
- The overall_confidence should reflect the overall quality of the extraction, not just an average.
- Amounts are in Nigerian Naira (₦). Extract the numeric value only (e.g., 450000 not "₦450,000").
- Dates should be in YYYY-MM-DD format.
- For payment_method, map to one of: "bank_transfer", "cash", "pos", "mobile_money", "other".

Respond ONLY with a valid JSON object matching this exact schema — no markdown, no explanation, just the JSON:

{
  "extracted": {
    "amount_naira": <number | null>,
    "amount_confidence": <0-1>,
    "date": <"YYYY-MM-DD" | null>,
    "date_confidence": <0-1>,
    "payment_reference": <string | null>,
    "payment_reference_confidence": <0-1>,
    "payer_name": <string | null>,
    "payer_name_confidence": <0-1>,
    "recipient": <string | null>,
    "recipient_confidence": <0-1>,
    "payment_method": <"bank_transfer" | "cash" | "pos" | "mobile_money" | "other" | null>,
    "method_confidence": <0-1>
  },
  "overall_confidence": <0-1>,
  "issues": [<string>],
  "is_payment_receipt": <boolean>,
  "reasoning": <string>
}`
}

interface DealerShipment {
  id: string
  total_amount_naira: number
  amount_paid_naira: number
  outstanding: number
  dispatched_at: string | null
  status: string
}

interface DealerContext {
  businessName: string
  outstandingShipments: DealerShipment[]
}

export function getReceiptExtractionUserPrompt(context: DealerContext): string {
  const shipmentsText =
    context.outstandingShipments.length === 0
      ? 'No outstanding shipments on record for this dealer.'
      : context.outstandingShipments
          .map(
            (s) =>
              `- Shipment ${s.id.slice(0, 8)}: outstanding ₦${s.outstanding.toLocaleString()} (total ₦${s.total_amount_naira.toLocaleString()}, paid ₦${s.amount_paid_naira.toLocaleString()}, dispatched ${s.dispatched_at ? s.dispatched_at.slice(0, 10) : 'pending'}, status: ${s.status})`
          )
          .join('\n')

  return `This receipt was submitted by dealer: ${context.businessName}

Outstanding shipments for context (amounts in Naira):
${shipmentsText}

Please extract all payment information from the receipt image above. If the extracted amount matches any outstanding shipment within ±5%, note it in your reasoning.`
}
