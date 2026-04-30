#!/usr/bin/env node
/**
 * Creates the 'receipts' Supabase Storage bucket (private) if it doesn't exist.
 *
 * Usage:
 *   node scripts/setup-storage.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

console.log('→ Checking storage bucket "receipts"…')

const { data: buckets, error: listError } = await supabase.storage.listBuckets()
if (listError) {
  console.error('✗ Failed to list buckets:', listError.message)
  process.exit(1)
}

const exists = buckets.some((b) => b.name === 'receipts')

if (exists) {
  console.log('✓ Bucket "receipts" already exists — nothing to do.')
} else {
  const { error: createError } = await supabase.storage.createBucket('receipts', {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  })

  if (createError) {
    console.error('✗ Failed to create bucket:', createError.message)
    process.exit(1)
  }

  console.log('✓ Created private bucket "receipts" (max 10 MB, images + PDF).')
}
