'use client'

import { useState } from 'react'
import { NLQueryInput } from '@/components/admin/nl-query-input'
import { NLQueryResults } from '@/components/admin/nl-query-results'
import { executeNLQuery, type NLQueryResult } from '@/app/actions/nl-query'

export default function QueriesPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NLQueryResult | null>(null)

  async function handleQuery(question: string) {
    setLoading(true)
    setResult(null)
    const res = await executeNLQuery(question)
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Natural Language Queries</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask questions about your operations in plain English.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <NLQueryInput onSubmit={handleQuery} loading={loading} />

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            Generating and running query…
          </div>
        )}

        {result && !loading && <NLQueryResults result={result} />}
      </div>
    </div>
  )
}
