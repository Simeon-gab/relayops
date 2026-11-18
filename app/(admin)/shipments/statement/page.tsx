import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/admin/print-button'
import { getLoadingStatement } from '@/lib/db/loading-statement'
import { formatQty } from '@/lib/utils/format'

type Props = {
  searchParams: Promise<{ ids?: string | string[] }>
}

// Who the statement is issued by — the header of every printed copy.
const ISSUER = 'Cedar Oasis Enterprise'
const BRAND = 'HUNGKEE MOTORCYCLE'

const NAVY = '#14283c'
const RED = '#b3202a'

const longDate = (day: string) =>
  new Date(`${day}T12:00:00+01:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  })

const shortDate = (day: string) =>
  new Date(`${day}T12:00:00+01:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Lagos',
  })

const listOf = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 border-l-4 pl-2 font-serif text-xl" style={{ borderColor: RED, color: NAVY }}>
      {children}
    </h2>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-900">{value}</p>
    </div>
  )
}

export default async function LoadingStatementPage({ searchParams }: Props) {
  const { ids } = await searchParams
  const idList = (Array.isArray(ids) ? ids.join(',') : ids ?? '').split(',').filter(Boolean)

  const statement = await getLoadingStatement(idList)
  if (!statement) notFound()

  const { lines, allTransload, anyTransload, balance } = statement
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

  const dates = [...new Set(lines.map((l) => l.date))]
  const destinations = [...new Set(lines.map((l) => l.destination))]
  const showDates = dates.length > 1
  const sameUnit = new Set(lines.map((l) => l.unit_label)).size === 1
  const total = lines.reduce((sum, l) => sum + l.quantity, 0)

  const word = allTransload ? 'Transloading' : 'Dispatch'
  const verb = allTransload ? 'transloaded' : 'dispatched'
  const title = `Warehouse ${word} Statement`
  const statementDate = dates.length === 1 ? dates[0] : today

  // One sentence per destination: "154 F1 (Motobi) units and 2 City 125 units transloaded to Kabiru / Kano."
  const sentences = destinations.map((dest) => {
    const parts = lines
      .filter((l) => l.destination === dest)
      .map((l) => `${formatQty(l.quantity, l.unit_label)} of ${l.description}${l.color ? ` (${l.color})` : ''}`)
    return `${listOf(parts)} ${verb} to ${dest}.`
  })

  return (
    <div className="px-6 py-10 print:p-0">
      <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/shipments" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to shipments
        </Link>
        <PrintButton />
      </div>

      <article
        className="mx-auto max-w-3xl bg-white px-10 py-12 text-slate-800 shadow-sm ring-1 ring-slate-200 print:max-w-none print:px-0 print:py-0 print:shadow-none print:ring-0"
        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        <header className="flex items-end justify-between gap-4 border-b-[3px] pb-1" style={{ borderColor: RED }}>
          <p className="font-serif text-2xl" style={{ color: NAVY }}>{ISSUER}</p>
          <p className="text-[11px] tracking-[0.3em]" style={{ color: RED }}>{BRAND}</p>
        </header>

        <div className="mt-8 px-2">
          <h1 className="font-serif text-3xl" style={{ color: NAVY }}>{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {allTransload
              ? 'Record of goods transloaded and dispatched to destination.'
              : 'Record of goods loaded from the warehouse and dispatched to destination.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-y border-slate-200 py-3">
          <Meta label="Statement date" value={longDate(statementDate)} />
          <Meta
            label="Transaction"
            value={
              dates.length === 1
                ? `${word} of ${shortDate(dates[0])}`
                : `${word}, ${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`
            }
          />
          <Meta label="Destination" value={destinations.length === 1 ? destinations[0] : `${destinations.length} destinations`} />
        </div>

        <SectionTitle>{word} details</SectionTitle>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-white" style={{ backgroundColor: NAVY }}>
              {showDates && <th className="px-3 py-2.5 font-semibold">Date</th>}
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 font-semibold">Quantity</th>
              <th className="px-3 py-2.5 font-semibold">Destination</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200">
                {showDates && <td className="px-3 py-3">{shortDate(l.date)}</td>}
                <td className="px-3 py-3">
                  {l.description}
                  {l.color ? ` — ${l.color}` : ''}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums">{formatQty(l.quantity, l.unit_label)}</td>
                <td className="px-3 py-3">{l.destination}</td>
              </tr>
            ))}
            {lines.length > 1 && sameUnit && (
              <tr className="bg-slate-100 font-semibold">
                <td className="px-3 py-3 uppercase" colSpan={showDates ? 2 : 1}>Total</td>
                <td className="px-3 py-3 tabular-nums">{formatQty(total, lines[0].unit_label)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>

        {balance.length > 0 && (
          <>
            <SectionTitle>Warehouse balance — {longDate(today)}</SectionTitle>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-white" style={{ backgroundColor: NAVY }}>
                  <th className="px-3 py-2.5 font-semibold">Item</th>
                  <th className="px-3 py-2.5 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((b) => (
                  <tr key={b.display_name} className="border-b border-slate-200">
                    <td className="px-3 py-3">{b.display_name}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{formatQty(b.quantity, b.unit_label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              {statement.warehouse_name} stock on record on the day this statement was printed.
            </p>
          </>
        )}

        <SectionTitle>Notes</SectionTitle>
        <div className="space-y-1 text-sm">
          {sentences.map((s, i) => (
            <p key={i}>
              {i === 0 && <span className="font-semibold">{word}. </span>}
              {s}
            </p>
          ))}
          {allTransload && (
            <p className="text-slate-600">Moved truck-to-truck — these goods did not enter the warehouse.</p>
          )}
          {anyTransload && !allTransload && (
            <p className="text-slate-600">Some of these loads were moved truck-to-truck and did not enter the warehouse.</p>
          )}
        </div>

        <p className="mt-6 border-l-4 border-t border-t-slate-200 pl-2 pt-3 text-xs text-slate-600" style={{ borderLeftColor: RED }}>
          <span className="font-semibold">Record copy.</span> Soft copy kept as evidence of goods {verb} on the date
          {dates.length === 1 ? '' : 's'} stated.
        </p>
      </article>
    </div>
  )
}
