export interface MessageFilters {
  dealer_id?: string
  channel?: string
  parse_status?: 'parsed' | 'unparsed'
  intent?: string
}

export interface MessageSummary {
  id: string
  dealer_id: string
  business_name: string
  city: string
  channel: string
  language: string | null
  original_text: string
  created_at: string
  has_receipt: boolean
  has_parse_result: boolean
  parse_intent: string | null
}

export interface MessageReceipt {
  id: string
  storage_path: string
  file_type: string
  status: string
  created_at: string
}

export interface MessageParseResult {
  id: string
  parsed_intent: string
  extracted_data: Record<string, unknown>
  confidence: number
  ai_notes: string | null
  created_at: string
}

export interface OutboundMessageSummary {
  id: string
  dealer_id: string
  business_name: string
  city: string
  channel: string
  language: string | null
  original_text: string
  translated_text: string | null
  created_at: string
}

export interface MessageDetail {
  id: string
  dealer_id: string
  business_name: string
  city: string
  state: string
  channel: string
  language: string | null
  original_text: string
  translated_text: string | null
  created_at: string
  recorded_by_email: string | null
  receipts: MessageReceipt[]
  parse_result: MessageParseResult | null
}
