'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Opens the browser's print dialog — "Save as PDF" there gives the soft copy. */
export function PrintButton({ label = 'Print / save as PDF' }: { label?: string }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  )
}
