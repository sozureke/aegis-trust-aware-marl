"use client";

import type { ReplaySnapshot } from "@/lib/replay/types"
import { voteTallyEntries } from "@/lib/replay/voteFormat"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

type Props = {
  snapshot: ReplaySnapshot;
  className?: string;
  suppressCommStreams?: boolean;
};

function roleLabel(role: number): string {
  if (role === 0) return "crew";
  if (role === 1) return "impostor";
  return "?";
}

export function ReplayHud({ snapshot, className, suppressCommStreams = false }: Props) {
  const {
    meetingVotes,
    recentTokens,
    recentCommActions,
    knower,
    lastVoteFailed,
    lastMeetingSummary,
    lastEjection,
  } = snapshot;

  const summaryVotes = lastMeetingSummary ? voteTallyEntries(lastMeetingSummary.votes) : [];
  const ejectionVotes = lastEjection ? voteTallyEntries(lastEjection.votes) : [];

  const hasAny =
    meetingVotes.length > 0 ||
    (lastMeetingSummary &&
      (summaryVotes.length > 0 ||
        (!suppressCommStreams && lastMeetingSummary.commActions.length > 0) ||
        lastMeetingSummary.reporterId >= 0)) ||
    lastEjection != null ||
    ((recentTokens.length > 0 || recentCommActions.length > 0) && !suppressCommStreams) ||
    knower != null ||
    lastVoteFailed != null;

  if (!hasAny) return null;

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-2 text-[10px] text-zinc-500",
        className,
      )}
    >
      {meetingVotes.length > 0 && (
        <div>
          <div className="mb-0.5 font-medium uppercase tracking-wide text-zinc-600">
            Vote stream <span className="font-normal normal-case text-zinc-500">(vote_cast)</span>
          </div>
          <ul className="space-y-1 font-mono text-zinc-400">
            {meetingVotes.map((v, i) => (
              <li key={`${v.voterId}-${i}`} className="flex items-center gap-1">
                <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                  {v.voterId}
                </span>
                <ArrowRight className="size-3 shrink-0 text-zinc-600" aria-hidden />
                <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                  {v.targetId ?? "skip"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastMeetingSummary && (
        <div className="space-y-1.5 rounded border border-zinc-800/60 bg-black/20 px-1.5 py-1.5">
          <div className="font-medium uppercase tracking-wide text-zinc-600">Meeting summary</div>
          <div className="font-mono text-[9px] leading-relaxed text-zinc-500">
            t{lastMeetingSummary.meetingTickStart}–t{lastMeetingSummary.tick} · rep{" "}
            {lastMeetingSummary.reporterId} · body room {lastMeetingSummary.bodyRoom}
            {lastMeetingSummary.ejectedId != null ? (
              <>
                {" "}
                · out {lastMeetingSummary.ejectedId}{" "}
                <span className="text-zinc-600">
                  ({roleLabel(lastMeetingSummary.ejectedRole ?? -1)})
                </span>
              </>
            ) : null}
          </div>
          {summaryVotes.length > 0 && (
            <div>
              <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
                Tallies
              </div>
              <ul className="space-y-0.5 font-mono text-zinc-400">
                {summaryVotes.map(({ voter, target }) => (
                  <li key={voter} className="flex items-center gap-1">
                    <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                      {voter}
                    </span>
                    <ArrowRight className="size-2.5 shrink-0 text-zinc-600" aria-hidden />
                    <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                      {target === null ? "skip" : target}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lastMeetingSummary.commActions.length > 0 && !suppressCommStreams && (
            <div>
              <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
                Comm
              </div>
              <ul className="max-h-[120px] space-y-1 overflow-y-auto font-mono text-zinc-400">
                {lastMeetingSummary.commActions.map((c, i) => (
                  <li
                    key={i}
                    className="rounded border border-zinc-800/60 bg-black/30 px-1.5 py-1 text-[9px] leading-snug"
                  >
                    <span className="text-zinc-600">t{String(c.tick ?? "")}</span>{" "}
                    {String(c.sender_id ?? "?")} ·{" "}
                    <span className="text-zinc-300">{String(c.action_name ?? c.action_id ?? "?")}</span>
                    {c.target_id != null ? (
                      <span className="text-zinc-600"> →{String(c.target_id)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {lastEjection && (
        <div className="space-y-1 rounded border border-amber-950/50 bg-amber-950/10 px-1.5 py-1.5">
          <div className="font-medium uppercase tracking-wide text-amber-900/90">Ejection t{lastEjection.tick}</div>
          <div className="font-mono text-[9px] text-amber-900/85">
            agent {lastEjection.ejectedId} · {roleLabel(lastEjection.role)}
          </div>
          {ejectionVotes.length > 0 && (
            <ul className="space-y-0.5 font-mono text-[9px] text-zinc-400">
              {ejectionVotes.map(({ voter, target }) => (
                <li key={voter} className="flex items-center gap-1">
                  <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                    {voter}
                  </span>
                  <ArrowRight className="size-2.5 shrink-0 text-zinc-600" aria-hidden />
                  <span className="min-w-[1.25rem] rounded bg-zinc-900/90 px-1 text-center tabular-nums text-zinc-200">
                    {target === null ? "skip" : target}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lastVoteFailed && (
        <div className="font-mono text-amber-800/90">
          vote failed t{lastVoteFailed.tick} · score {lastVoteFailed.maxScore.toFixed(2)} below{" "}
          {lastVoteFailed.threshold.toFixed(2)} · cand {lastVoteFailed.numCandidates}
        </div>
      )}

      {recentCommActions.length > 0 && !suppressCommStreams && (
        <div>
          <div className="mb-0.5 font-medium uppercase tracking-wide text-zinc-600">
            Comm stream <span className="font-normal normal-case text-zinc-500">(comm_action)</span>
          </div>
          <ul className="space-y-0.5 font-mono text-[9px] text-zinc-400">
            {recentCommActions.map((c, i) => (
              <li key={`${c.tick}-${c.senderId}-${i}`} className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <span className="text-zinc-600">t{c.tick}</span>
                <span className="rounded bg-zinc-900/80 px-1 text-zinc-300">{c.senderId}</span>
                <span className="text-zinc-300">{c.actionName}</span>
                {c.targetId != null ? (
                  <span className="text-zinc-600">→{c.targetId}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentTokens.length > 0 && !suppressCommStreams && (
        <div>
          <div className="mb-0.5 font-medium uppercase tracking-wide text-zinc-600">Tokens (message_sent)</div>
          <ul className="space-y-0.5 font-mono text-zinc-400">
            {recentTokens.map((t, i) => (
              <li key={`${t.senderId}-${t.tokenId}-${i}`} className="flex items-center gap-1">
                <span className="rounded bg-zinc-900/80 px-1 text-zinc-300">{t.senderId}</span>
                <ArrowRight className="size-2.5 shrink-0 text-zinc-700" aria-hidden />
                <span className="text-zinc-500">#{t.tokenId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {knower && (
        <div className="flex flex-wrap items-center gap-1 rounded border border-amber-600/35 bg-amber-950/25 px-1.5 py-1 font-mono text-[9px] text-amber-800/95 dark:text-amber-100/90">
          <span className="text-amber-900/80 dark:text-amber-200/80">Knower</span>
          <span className="rounded bg-amber-950/80 px-1 tabular-nums text-amber-100">{knower.knowerId}</span>
          <ArrowRight className="size-2.5 shrink-0 text-amber-800/80 dark:text-amber-300/70" aria-hidden />
          <span className="rounded bg-amber-950/80 px-1 tabular-nums text-amber-100">{knower.targetId}</span>
          <span className="text-amber-900/70 dark:text-amber-300/80">
            (sees as{" "}
            {knower.targetRole === 1 ? "impostor" : knower.targetRole === 0 ? "crew" : "?"})
          </span>
        </div>
      )}
    </div>
  );
}
