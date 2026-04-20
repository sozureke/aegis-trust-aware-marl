"use client";

import type { GameEvent } from "@/lib/replay/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HIGHLIGHT = new Set([
  "move",
  "kill",
  "report",
  "meeting_start",
  "meeting_end",
  "meeting_summary",
  "comm_action",
  "ejection",
  "phase_change",
  "win",
  "vote_cast",
]);

function summarize(e: GameEvent): string {
  switch (e.event_type) {
    case "move":
      return `agent ${e.agent_id} → room ${e.to_room}`;
    case "kill":
      return `${e.killer_id} kills ${e.victim_id} @${e.room}`;
    case "report":
      return `agent ${e.reporter_id} reports body ${e.body_id}`;
    case "meeting_summary":
      return `votes ${Object.keys((e.votes as object) ?? {}).length} comms ${(e.comm_actions as unknown[])?.length ?? 0}`;
    case "comm_action":
      return `${e.action_name ?? "?"}`;
    case "ejection":
      return `eject ${e.ejected_id} (role ${e.role})`;
    case "phase_change":
      return `${e.old_phase} → ${e.new_phase}`;
    case "win":
      return `winner ${e.winner} · ${String(e.reason).slice(0, 48)}`;
    case "vote_cast":
      return `agent ${e.voter_id} → ${e.target_id ?? "skip"}`;
    default:
      return "";
  }
}

type Props = {
  events: GameEvent[];
  currentTick: number;
  className?: string;
};

export function EventLog({ events, currentTick, className }: Props) {
  return (
    <ScrollArea className={cn("h-[320px] rounded-md border border-zinc-800", className)}>
      <ul className="space-y-0.5 p-2 font-mono text-[11px]">
        {events.map((e, i) => {
          const hi = HIGHLIGHT.has(e.event_type);
          const atTick = e.tick === currentTick;
          return (
            <li
              key={`${e.tick}-${i}-${e.event_type}`}
              className={cn(
                "rounded px-1.5 py-0.5 leading-snug text-zinc-500",
                hi && "text-zinc-300",
                atTick && "bg-zinc-900/80 text-zinc-100",
              )}
            >
              <span className="text-zinc-600 tabular-nums">t{e.tick}</span>{" "}
              <span className="text-zinc-400">{e.event_type}</span>
              {summarize(e) ? (
                <span className="text-zinc-500"> · {summarize(e)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
