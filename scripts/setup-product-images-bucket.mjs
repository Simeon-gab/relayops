import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('→ Checking storage bucket "product-images"…')
const { data: buckets, error } = await supabase.storage.listBuckets()
if (error) { console.error('✗', error.message); process.exit(1) }

if (buckets.some((b) => b.name === 'product-images')) {
  console.log('✓ Bucket "product-images" already exists.')
} else {
  const { error: ce } = await supabase.storage.createBucket('product-images', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  })
  if (ce) { console.error('✗', ce.message); process.exit(1) }
  console.log('✓ Created public bucket "product-images" (max 5 MB, images only).')
}
