'use client'

import { useState } from 'react'
import { Search, CornerDownLeft } from 'lucide-react'

const SAMPLE_CHIPS = [
  "Which shipments haven't moved in 3+ days?",
  'Total payments received this month',
  'Which dealers have outstanding balances?',
  'Show low stock products by warehouse',
  'Pending and partial orders by state',
  'New orders placed in the last 7 days',
]

interface Props {
  onSubmit: (question: string) => void
  loading: boolean
}

export function NLQueryInput({ onSubmit, loading }: Props) {
  const [question, setQuestion] = useState('')

  function submit(q: string) {
    const trimmed = q.trim()
    if (trimmed && !loading) onSubmit(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit(question)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <textarea
          rows={3}
          placeholder="Ask a question about your operations… (⌘ Enter to run)"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-full resize-none rounded-xl border border-border bg-white py-3 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {SAMPLE_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => { setQuestion(chip); submit(chip) }}
            disabled={loading}
            className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => submit(question)}
          disabled={!question.trim() || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
          {loading ? 'Running…' : 'Run query'}
        </button>
      </div>
    </div>
  )
}
