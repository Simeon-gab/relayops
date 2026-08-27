'use server'

import { can } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'

async function getAdminUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(data?.role, 'manage_products')) return null
  return { db, user }
}

export interface ProductInput {
  sku_code: string
  display_name: string
  category: 'motorcycle' | 'ebike'
  color?: string | null
  engine_size_cc?: number | null
  sell_price_naira?: number | null
  import_cost_naira?: number | null
  active?: boolean
}

export type ProductActionResult =
  | { success: true; productId?: string }
  | { success: false; error: string }

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(input: ProductInput): string | null {
  if (!input.sku_code?.trim()) return 'SKU code is required.'
  if (!input.display_name?.trim()) return 'Display name is required.'
  if (!['motorcycle', 'ebike'].includes(input.category)) return 'Category must be Motorcycle or E-bike.'
  if (input.category === 'ebike' && input.engine_size_cc) return 'E-bikes cannot have an engine size.'
  if (input.sell_price_naira != null && input.sell_price_naira < 0) return 'Sell price must be 0 or greater.'
  if (input.import_cost_naira != null && input.import_cost_naira < 0) return 'Import cost must be 0 or greater.'
  return null
}

// ─── createProduct ───────────────────────────────────────────────────────────��

export async function createProduct(input: ProductInput): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  const err = validate(input)
  if (err) return { success: false, error: err }

  const sku = input.sku_code.trim().toUpperCase()

  const { data: existing } = await admin.db
    .from('products')
    .select('id')
    .eq('sku_code', sku)
    .single()

  if (existing) return { success: false, error: `SKU "${sku}" already exists.` }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    const res = await client.query(
      `INSERT INTO products
         (sku_code, display_name, category, color, engine_size_cc,
          sell_price_naira, import_cost_naira, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING id`,
      [
        sku,
        input.display_name.trim(),
        input.category,
        input.color?.trim() || null,
        input.category === 'motorcycle' ? (input.engine_size_cc ?? null) : null,
        input.sell_price_naira ?? null,
        input.import_cost_naira ?? null,
      ]
    )

    const productId: string = res.rows[0].id

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'product_created', 'product', $2, $3)`,
      [admin.user.id, productId, JSON.stringify({ sku_code: sku, display_name: input.display_name.trim() })]
    )

    await client.query('COMMIT')
    revalidatePath('/products')
    return { success: true, productId }
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error.' }
  } finally {
    await client.end()
  }
}

// ─── updateProduct ────────────────────────────────────────────────────────────

export async function updateProduct(productId: string, input: ProductInput): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  const err = validate(input)
  if (err) return { success: false, error: err }

  const sku = input.sku_code.trim().toUpperCase()

  // Uniqueness check — only if SKU changed
  const { data: current } = await admin.db
    .from('products')
    .select('id, sku_code')
    .eq('id', productId)
    .single()

  if (!current) return { success: false, error: 'Product not found.' }

  if (sku !== current.sku_code) {
    const { data: dupe } = await admin.db
      .from('products')
      .select('id')
      .eq('sku_code', sku)
      .single()
    if (dupe) return { success: false, error: `SKU "${sku}" already exists.` }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE products
       SET sku_code=$1, display_name=$2, category=$3, color=$4, engine_size_cc=$5,
           sell_price_naira=$6, import_cost_naira=$7, active=$8, updated_at=now()
       WHERE id=$9`,
      [
        sku,
        input.display_name.trim(),
        input.category,
        input.color?.trim() || null,
        input.category === 'motorcycle' ? (input.engine_size_cc ?? null) : null,
        input.sell_price_naira ?? null,
        input.import_cost_naira ?? null,
        input.active ?? true,
        productId,
      ]
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'product_updated', 'product', $2, $3)`,
      [admin.user.id, productId, JSON.stringify({ sku_code: sku, display_name: input.display_name.trim() })]
    )

    await client.query('COMMIT')
    revalidatePath('/products')
    revalidatePath(`/products/${productId}`)
    revalidatePath(`/products/${productId}/edit`)
    return { success: true, productId }
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error.' }
  } finally {
    await client.end()
  }
}

// ─── uploadProductImage ───────────────────────────────────────────────────────

export async function uploadProductImage(
  productId: string,
  file: File
): Promise<{ success: true; imagePath: string } | { success: false; error: string }> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  if (!file.type.startsWith('image/')) return { success: false, error: 'File must be an image.' }
  if (file.size > 5 * 1024 * 1024) return { success: false, error: 'Image must be under 5 MB.' }

  const { data: current } = await admin.db
    .from('products')
    .select('image_path')
    .eq('id', productId)
    .single()

  if (!current) return { success: false, error: 'Product not found.' }

  const storage = createAdminClient().storage.from('product-images')

  if (current.image_path) {
    await storage.remove([current.image_path])
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await storage.upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) return { success: false, error: uploadError.message }

  const { error: dbError } = await admin.db
    .from('products')
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (dbError) {
    await storage.remove([path])
    return { success: false, error: dbError.message }
  }

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  revalidatePath(`/products/${productId}/edit`)

  return { success: true, imagePath: path }
}

// ─── removeProductImage ───────────────────────────────────────────────────────

export async function removeProductImage(productId: string): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  const { data: current } = await admin.db
    .from('products')
    .select('image_path')
    .eq('id', productId)
    .single()

  if (!current) return { success: false, error: 'Product not found.' }
  if (!current.image_path) return { success: true }

  const storage = createAdminClient().storage.from('product-images')
  await storage.remove([current.image_path])

  const { error } = await admin.db
    .from('products')
    .update({ image_path: null, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  revalidatePath(`/products/${productId}/edit`)

  return { success: true }
}

// ─── deactivateProduct ────────────────────────────────────────────────────────

export async function deactivateProduct(productId: string): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `UPDATE products SET active=false, deleted_at=now(), updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL
       RETURNING id`,
      [productId]
    )

    if (!rows.length) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Product not found.' }
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'product_deactivated', 'product', $2, NULL)`,
      [admin.user.id, productId]
    )

    await client.query('COMMIT')
    revalidatePath('/products')
    revalidatePath(`/products/${productId}`)
    return { success: true }
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error.' }
  } finally {
    await client.end()
  }
}
