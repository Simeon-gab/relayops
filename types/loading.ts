/** A product the loading form can pick, with what Lagos has on hand. */
export interface LoadingProductOption {
  id: string
  sku_code: string
  display_name: string
  category: string
  unit_label: string
  lagos_stock: number
}

/** Somewhere a truck can go: a dealer, or a warehouse (Kano is Mr Kabiru's). */
export interface LoadingDestinationOption {
  /** "dealer:<uuid>" or "warehouse:<uuid>" */
  key: string
  kind: 'dealer' | 'warehouse'
  id: string
  name: string
  city: string
  state: string
  /** Warehouse owned by a dealer — what goes there is theirs, not ours. */
  partner: boolean
}

export interface LoadingOptions {
  origin_warehouse_id: string
  origin_warehouse_name: string
  products: LoadingProductOption[]
  destinations: LoadingDestinationOption[]
}

export interface LoadingLine {
  product_id: string | null
  quantity: number
  color: string | null
  /** The words in the message this line came from, e.g. "80 cristal". */
  source_text: string
}

export interface LoadingLoad {
  destination_key: string | null
  /** What the message called the destination, e.g. "Kara/mina". */
  destination_text: string
  lines: LoadingLine[]
}

export interface LoadingDraft {
  load_date: string
  loads: LoadingLoad[]
  issues: string[]
  parsed_by: 'ai' | 'rules'
}
