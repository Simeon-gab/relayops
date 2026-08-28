import { Bot, AlertTriangle } from 'lucide-react'
import type { AgentRun } from '@/lib/db/ai-proposals'
import { timeAgo } from '@/lib/utils/format'

/**
 * What the system did without being asked.
 *
 * Unattended work is only tolerable while it stays visible. Now that the policy
 * lets an agent raise an order on its own, there has to be one place that says
 * so in plain language — otherwise the first anyone hears of it is an order
 * nobody remembers creating.
 *
 * Failures are listed as loudly as successes: an agent that quietly stopped
 * running is the failure mode that costs the most and shows the least.
 */

const AGENT_LABEL: Record<string, string> = {
  watchdog: 'Swept for problems',
  parse_message: 'Read a dealer message',
  auto_order: 'Raised an order on its own',
  suggest_allocation: 'Planned a container split',
  extract_receipt: 'Read a receipt',
}

const TRIGGER_LABEL: Record<string, string> = {
  cron: 'on schedule',
  event: 'on arrival',
  manual: 'when asked',
}

export function AgentActivity({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-subtle px-5 py-3">
        <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">What ran on its own</h2>
      </div>

      {runs.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Nothing has run unattended yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              {!run.ok && (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-danger" />
              )}
              <span className="text-sm text-foreground">
                {AGENT_LABEL[run.agent] ?? run.agent.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-muted-foreground">
                {TRIGGER_LABEL[run.trigger] ?? run.trigger} · {timeAgo(run.created_at)}
                {run.duration_ms !== null ? ` · ${(run.duration_ms / 1000).toFixed(1)}s` : ''}
              </span>
              {!run.ok && (
                <span className="w-full text-xs text-status-danger sm:w-auto">
                  Failed{run.error ? `: ${run.error}` : '.'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
