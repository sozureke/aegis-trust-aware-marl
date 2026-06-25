"use client";

import { ScrollArea } from "@/components/ui/scroll-area"
import type { ParsedMeeting } from "@/lib/dialogue/extractMeetings"
import type { Utterance } from "@/lib/dialogue/fallbackUtterances"
import type { PhaseName } from "@/lib/replay/types"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useRef } from "react"

type Props = {
  phase: PhaseName;
  meetings: ParsedMeeting[];
  utterancesByMeetingIdx: Map<number, Utterance[]>;
  symbolicMeetingIndices?: number[];
  currentTick: number;
  agentLabels: string[];
  agentRoles?: (0 | 1 | null)[];
  className?: string;
};

function displayName(id: number, agentLabels: string[]): string {
  const n = agentLabels[id]?.trim();
  return n || `Agent ${id}`;
}

function activeMeetingAtTick(
  meetings: ParsedMeeting[],
  tick: number,
  phase: PhaseName,
): ParsedMeeting | null {
  if (phase !== "MEETING" && phase !== "VOTING") return null;
  for (const m of meetings) {
    if (tick >= m.startTick && tick <= m.endTick) return m;
  }
  return null;
}

/** Zinc / chrome-metal stack aligned with MapGrid. */
export function MeetingChat({
  phase,
  meetings,
  utterancesByMeetingIdx,
  symbolicMeetingIndices = [],
  currentTick,
  agentLabels,
  agentRoles,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = useMemo(
    () => activeMeetingAtTick(meetings, currentTick, phase),
    [meetings, currentTick, phase],
  );

  const lines = useMemo(() => {
    if (!active) return [];
    const all = utterancesByMeetingIdx.get(active.index) ?? [];
    return all.filter((u) => u.tick <= currentTick);
  }, [active, utterancesByMeetingIdx, currentTick]);

  const isShorthandMeeting = useMemo(
    () =>
      active != null && symbolicMeetingIndices.length > 0
        ? symbolicMeetingIndices.includes(active.index)
        : false,
    [active, symbolicMeetingIndices],
  );

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    const el = viewport ?? root;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, currentTick, active?.index]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "flex max-h-[min(52vh,520px)] min-h-[280px] flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950/98 to-zinc-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-700/75 bg-zinc-950/95 px-3 py-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
        <div className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
          Voice · Meeting
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
      </div>
      <div className="border-b border-zinc-800/90 px-3 py-1.5 text-center font-mono text-[9px] text-zinc-500">
        ticks {active.startTick}–{active.endTick}
      </div>

      {isShorthandMeeting ? (
        <div className="shrink-0 border-b border-amber-900/35 bg-amber-950/20 px-3 py-2 font-mono text-[10px] leading-snug text-amber-200/90">
          NL dialogue unavailable · showing scripted chatter (not raw log symbols). Configure{" "}
          <span className="text-amber-100/95">OPENROUTER_API_KEY</span> for model lines.
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1">
        <ScrollArea className="h-[min(40vh,420px)] px-2 py-3">
          <div className="flex flex-col gap-2.5 pr-1">
            {lines.length === 0 ? (
              <p className="px-2 text-center font-mono text-[10px] text-zinc-600">No lines at this tick…</p>
            ) : (
              lines.map((u, i) => {
                const sid =
                  typeof u.speaker_id === "number" && !Number.isNaN(u.speaker_id) ? u.speaker_id : 0;
                const rr = agentRoles?.[sid];
                return (
                  <div key={`${u.tick}-${sid}-${i}`} className="flex gap-2">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md border bg-zinc-900/95 font-mono text-[10px] font-bold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,.05)]",
                        rr === 1 && "border-rose-700/60 text-rose-100",
                        rr === 0 && "border-emerald-700/55 text-emerald-100",
                        (rr !== 0 && rr !== 1) && "border-zinc-600 text-zinc-300",
                      )}
                      title={`Agent ${sid}`}
                    >
                      {sid}
                    </div>
                    <div className="min-w-0 flex-1 rounded-lg border border-zinc-700/85 bg-black/35 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[9px] text-zinc-500">
                        <span className="font-medium text-zinc-300">{displayName(sid, agentLabels)}</span>
                        {rr === 1 && (
                          <span className="rounded bg-rose-950/80 px-1 text-[8px] uppercase text-rose-300/95">
                            impostor
                          </span>
                        )}
                        {rr === 0 && (
                          <span className="rounded bg-emerald-950/85 px-1 text-[8px] uppercase text-emerald-300/95">
                            crew
                          </span>
                        )}
                        {(rr !== 0 && rr !== 1) && (
                          <span className="rounded bg-zinc-800 px-1 text-[8px] uppercase text-zinc-400">?</span>
                        )}
                        <span className="text-zinc-600">· t{u.tick}</span>
                      </div>
                      <p className="text-[12.5px] leading-snug text-zinc-100">{u.text}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
