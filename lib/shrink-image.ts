const MAX_DIMENSION = 1600
const SHRINK_ABOVE_BYTES = 1024 * 1024

/** Largest image the upload action can receive (see bodySizeLimit in next.config.ts). */
export const MAX_IMAGE_UPLOAD_BYTES = 3.9 * 1024 * 1024

/**
 * Shrinks a large photo in the browser so it fits the upload limit.
 * Returns the original file when it is already small or the browser cannot
 * decode it (HEIC in Chrome, for example).
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // JPEG has no transparency, so transparent PNGs get a white background.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
