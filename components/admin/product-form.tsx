'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createProduct, updateProduct, deactivateProduct, uploadProductImage, removeProductImage } from '@/app/actions/products'
import { FileUpload } from '@/components/admin/file-upload'
import type { ProductDetail } from '@/types/products'

type Mode = 'create' | 'edit'
type Category = 'motorcycle' | 'ebike'
type FieldErrors = Record<string, string>

interface Props {
  product?: ProductDetail
  mode: Mode
}

export function ProductForm({ product, mode }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [sku, setSku] = useState(product?.sku_code ?? '')
  const [displayName, setDisplayName] = useState(product?.display_name ?? '')
  const [category, setCategory] = useState<Category>(
    (product?.category as Category) ?? 'motorcycle'
  )
  const [color, setColor] = useState(product?.color ?? '')
  const [engineSize, setEngineSize] = useState(
    product?.engine_size_cc != null ? String(product.engine_size_cc) : ''
  )
  const [sellPrice, setSellPrice] = useState(
    product?.sell_price_naira != null ? String(product.sell_price_naira) : ''
  )
  const [importCost, setImportCost] = useState(
    product?.import_cost_naira != null ? String(product.import_cost_naira) : ''
  )
  const [active, setActive] = useState(product?.active ?? true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(product?.image_path ?? null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const currentImageUrl = currentImagePath
    ? `${supabaseUrl}/storage/v1/object/public/product-images/${currentImagePath}`
    : null

  function clearError(key: string) {
    setFieldErrors((p) => ({ ...p, [key]: '' }))
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (!sku.trim()) e.sku = 'SKU code is required.'
    if (!displayName.trim()) e.displayName = 'Display name is required.'
    if (!category) e.category = 'Category is required.'
    if (sellPrice && Number(sellPrice) < 0) e.sellPrice = 'Price must be 0 or greater.'
    if (importCost && Number(importCost) < 0) e.importCost = 'Cost must be 0 or greater.'
    return e
  }

  function buildInput() {
    return {
      sku_code: sku.trim().toUpperCase(),
      display_name: displayName.trim(),
      category,
      color: color.trim() || null,
      engine_size_cc:
        category === 'motorcycle' && engineSize ? parseInt(engineSize, 10) || null : null,
      sell_price_naira: sellPrice ? parseFloat(sellPrice) : null,
      import_cost_naira: importCost ? parseFloat(importCost) : null,
      active,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setFieldErrors({})

    startTransition(async () => {
      const input = buildInput()

      if (mode === 'create') {
        const result = await createProduct(input)
        if (!result.success) { setServerError(result.error); return }
        if (imageFile && result.productId) {
          await uploadProductImage(result.productId, imageFile)
        }
        toast.success('Product created')
        router.push(`/products/${result.productId}`)
      } else {
        const result = await updateProduct(product!.id, input)
        if (!result.success) { setServerError(result.error); return }
        if (imageFile) {
          const imgResult = await uploadProductImage(product!.id, imageFile)
          if (imgResult.success) setCurrentImagePath(imgResult.imagePath)
        }
        toast.success('Product updated')
        router.push(`/products/${product!.id}`)
      }
    })
  }

  function handleRemoveImage() {
    if (!product?.id) { setCurrentImagePath(null); return }
    startTransition(async () => {
      const result = await removeProductImage(product.id)
      if (!result.success) { toast.error(`Could not remove image: ${result.error}`); return }
      setCurrentImagePath(null)
      setImageFile(null)
      toast.success('Image removed')
    })
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateProduct(product!.id)
      if (!result.success) {
        toast.error(`Could not deactivate: ${result.error}`)
        setShowDeleteDialog(false)
        return
      }
      toast.success('Product deactivated')
      router.push('/products')
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ── Left column ── */}
          <div className="space-y-5">
            {/* SKU */}
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU code <span className="text-red-500">*</span></Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => { setSku(e.target.value.toUpperCase()); clearError('sku') }}
                placeholder="HK-M150-GRN"
                className="font-mono uppercase"
                disabled={isPending}
              />
              {fieldErrors.sku && <p className="text-xs text-red-600">{fieldErrors.sku}</p>}
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name <span className="text-red-500">*</span></Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); clearError('displayName') }}
                placeholder="Hungkee 150cc Standard - Green"
                disabled={isPending}
              />
              {fieldErrors.displayName && <p className="text-xs text-red-600">{fieldErrors.displayName}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
              <Select
                value={category}
                onValueChange={(v) => { setCategory(v as Category); clearError('category') }}
                disabled={isPending}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  <SelectItem value="ebike">E-bike</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.category && <p className="text-xs text-red-600">{fieldErrors.category}</p>}
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Red, Black, White…"
                disabled={isPending}
              />
            </div>

            {/* Engine size — only for motorcycles */}
            {category === 'motorcycle' && (
              <div className="space-y-1.5">
                <Label htmlFor="engine_size">Engine size (cc)</Label>
                <Input
                  id="engine_size"
                  type="number"
                  min={1}
                  step={1}
                  value={engineSize}
                  onChange={(e) => setEngineSize(e.target.value)}
                  placeholder="150"
                  className="tabular-nums"
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">
            {/* Sell price */}
            <div className="space-y-1.5">
              <Label htmlFor="sell_price">Sell price (₦)</Label>
              <Input
                id="sell_price"
                type="number"
                min={0}
                step="1"
                value={sellPrice}
                onChange={(e) => { setSellPrice(e.target.value); clearError('sellPrice') }}
                placeholder="e.g. 850000"
                className="tabular-nums"
                disabled={isPending}
              />
              {fieldErrors.sellPrice && <p className="text-xs text-red-600">{fieldErrors.sellPrice}</p>}
              <p className="text-xs text-slate-400">Reference price — actual price set per order</p>
            </div>

            {/* Import cost */}
            <div className="space-y-1.5">
              <Label htmlFor="import_cost">Import cost (₦)</Label>
              <Input
                id="import_cost"
                type="number"
                min={0}
                step="1"
                value={importCost}
                onChange={(e) => { setImportCost(e.target.value); clearError('importCost') }}
                placeholder="e.g. 600000"
                className="tabular-nums"
                disabled={isPending}
              />
              {fieldErrors.importCost && <p className="text-xs text-red-600">{fieldErrors.importCost}</p>}
              <p className="text-xs text-slate-400">Internal only — not visible to dealers</p>
            </div>

            {/* Active toggle — edit mode only */}
            {mode === 'edit' && (
              <div className="flex items-center justify-between rounded-lg border bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">Active</p>
                  <p className="text-xs text-slate-500">Inactive products are hidden from all views</p>
                </div>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
        </div>

        {/* Image upload */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Product image</h2>
          {currentImageUrl && !imageFile && (
            <div className="mb-3 flex items-start gap-3">
              <img
                src={currentImageUrl}
                alt={displayName || 'Product'}
                className="h-24 w-24 rounded-lg border object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600 hover:border-red-300 hover:text-red-700"
                onClick={handleRemoveImage}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove image
              </Button>
            </div>
          )}
          <FileUpload
            value={imageFile}
            onChange={setImageFile}
            accept="image/jpeg,image/png,image/webp,image/heic"
            disabled={isPending}
          />
          {imageFile && (
            <p className="mt-2 text-xs text-slate-500">Image will be uploaded when you save.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : mode === 'create' ? 'Create product' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          {mode === 'edit' && (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Deactivate
            </Button>
          )}
        </div>
      </form>

      {/* Deactivate confirmation dialog */}
      {mode === 'edit' && (
        <Dialog open={showDeleteDialog} onOpenChange={(o) => { if (!isPending) setShowDeleteDialog(o) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate product?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              <strong>{product?.display_name}</strong> will be hidden from all views. This action can be
              reversed by editing the product and turning Active back on.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
