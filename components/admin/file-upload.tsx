'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, X, FileText, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  accept?: string
  disabled?: boolean
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({ value, onChange, accept, disabled, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    onChange(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }, [onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [disabled, handleFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null)
  }

  if (value) {
    const isImage = value.type.startsWith('image/')
    return (
      <div className={cn('rounded-lg border bg-white p-3', className)}>
        <div className="flex items-start gap-3">
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="h-16 w-16 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-slate-100">
              {isImage ? (
                <ImageIcon className="h-6 w-6 text-slate-400" />
              ) : (
                <FileText className="h-6 w-6 text-slate-400" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{value.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(value.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-slate-400 hover:text-red-500"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white p-6 text-center transition-colors hover:border-border hover:bg-slate-50',
        isDragOver && 'border-blue-400 bg-blue-50',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <Upload className="mb-2 h-7 w-7 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">
        Drop file here or <span className="text-blue-600">click to select</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-400">Images (JPG, PNG, WEBP) or PDF — max 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? 'image/*,.pdf'}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  )
}
