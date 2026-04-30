'use client'

import { AlertCircle, ChevronDown } from 'lucide-react'
import type { NLQueryResult } from '@/app/actions/nl-query'

interface Props {
  result: NLQueryResult
}

export function NLQueryResults({ result }: Props) {
  if (!result.success) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-start gap-2 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{result.error}</p>
            {result.clarification && (
              <p className="mt-1 text-red-700">{result.clarification}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const { sql, explanation, caveats, results } = result

  return (
    <div className="space-y-4">
      {/* Explanation */}
      {explanation && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {explanation}
        </div>
      )}

      {/* Caveats */}
      {caveats && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Note: </span>
          {caveats}
        </div>
      )}

      {/* Results table */}
      {results.rows.length === 0 ? (
        <div className="rounded-xl border bg-white px-4 py-10 text-center text-sm text-slate-400">
          No results found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  {results.columns.map(col => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 font-medium text-slate-600"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {results.columns.map(col => (
                      <td
                        key={col}
                        className="whitespace-nowrap px-4 py-3 text-slate-700"
                      >
                        {row[col] === null || row[col] === undefined
                          ? '—'
                          : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {results.rowCount >= 500
              ? '500 rows shown (result may be truncated)'
              : `${results.rowCount} row${results.rowCount !== 1 ? 's' : ''}`}
          </div>
        </div>
      )}

      {/* SQL accordion */}
      <details className="group rounded-xl border bg-white">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-xs font-medium text-slate-500 hover:text-slate-700">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Generated SQL
        </summary>
        <div className="border-t">
          <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-slate-700">
            {sql}
          </pre>
        </div>
      </details>
    </div>
  )
}
