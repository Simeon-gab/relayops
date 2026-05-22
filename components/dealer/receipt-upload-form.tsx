'use client'

import { useRef, useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, X, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadDealerReceipt } from '@/app/actions/dealer-receipts'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface OpenOrder {
  id: string
  label: string
}

interface Props {
  openOrders: OpenOrder[]
}

export function ReceiptUploadForm({ openOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function updatePreview(url: string | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreviewUrl(url)
  }

  const handleFile = useCallback((incoming: File) => {
    if (!ACCEPTED.includes(incoming.type)) {
      setError('Only JPEG, PNG, and PDF files are accepted.')
      return
    }
    if (incoming.size > MAX_BYTES) {
      setError(`File too large (${formatBytes(incoming.size)}). Maximum is 10 MB.`)
      return
    }
    setError(null)
    setFile(incoming)
    updatePreview(incoming.type.startsWith('image/') ? URL.createObjectURL(incoming) : null)
  }, [])

  const handleRemove = () => {
    updatePreview(null)
    setFile(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isPending) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [isPending, handleFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) handleFile(picked)
    e.target.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError(null)

    const formData = new FormData()
    formData.set('file', file)
    if (orderId) formData.set('order_id', orderId)
    if (notes.trim()) formData.set('notes', notes.trim())

    startTransition(async () => {
      try {
        const result = await uploadDealerReceipt(formData)
        if (!result.success) {
          setError(result.error)
          return
        }
        router.push('/portal/payments')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Drop zone / file preview ───────────────────────────────────── */}
      <div>
        {file ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-subtle">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 pt-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-status-danger disabled:opacity-50"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors',
              isDragOver && 'border-brand-deep bg-brand-soft',
              isPending && 'pointer-events-none opacity-50'
            )}
            onClick={() => !isPending && inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drop your receipt here, or{' '}
              <span className="text-brand-mid">click to browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or PDF — max 10 MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,application/pdf"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isPending}
        />
      </div>

      {/* ── Order selector ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Link to order{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <select
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">Not linked to a specific order</option>
          {openOrders.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Link this receipt to an open order if you know which one it&apos;s for.
        </p>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Notes{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any context about this payment..."
          disabled={isPending}
          className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {/* ── Inline error ───────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-status-danger">{error}</p>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!file || isPending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-deep px-4 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          'Upload & extract'
        )}
      </button>
    </form>
  )
}
