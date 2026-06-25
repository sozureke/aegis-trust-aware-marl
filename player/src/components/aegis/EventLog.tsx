"use client";

import type { GameEvent } from "@/lib/replay/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatVoteTallyShort } from "@/lib/replay/voteFormat";

/**
 * High-volume events that are logged for snapshot accuracy but add little
 * semantic value when browsing the event log. These are excluded from the
 * display window so meaningful events are not crowded out.
 */
const DISPLAY_NOISE = new Set([
  "pose",
  "room_enter",
  "room_exit",
  "move_blocked",
]);

const HIGHLIGHT = new Set([
  "episode_start",
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
  "vote_failed_low_confidence",
  "vote_resolution",
  "door_close",
  "door_open",
  "task_assignment",
  "task_progress",
  "task_step_complete",
  "task_complete",
  "message_sent",
  "evac_activated",
  "evac_progress",
  "knower_reveal",
  "role_assignment",
  "tick_start",
  "tick_end",
]);

const PHASE_NAMES: Record<number, string> = {
  0: "FREE_PLAY",
  1: "MEETING",
  2: "VOTING",
};

function jsonPreview(e: GameEvent, maxLen = 96): string {
  const rest: Record<string, unknown> = { ...e };
  delete rest.event_type;
  delete rest.tick;
  const s = JSON.stringify(rest);
  if (s === "{}") return "";
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function phaseName(v: unknown): string {
  if (typeof v === "number" && v in PHASE_NAMES) return PHASE_NAMES[v]!;
  if (typeof v === "string") return v;
  return String(v ?? "?");
}

function summarize(e: GameEvent): string {
  switch (e.event_type) {
    case "episode_start":
      return `seed ${e.seed ?? "?"} · ${e.num_agents ?? "?"}a ${e.num_impostors ?? "?"}i · max_t ${e.max_ticks ?? "?"}`;
    case "tick_start":
    case "tick_end":
      return jsonPreview(e, 64) || "(tick boundary)";
    case "move":
      return `agent ${e.agent_id} ${e.from_room}→${e.to_room}`;
    case "kill":
      return `agent ${e.killer_id} kills agent ${e.victim_id} @room ${e.room}`;
    case "report":
      return `agent ${e.reporter_id} reports body ${e.body_id} @room ${e.room}`;
    case "meeting_start":
      return `reporter ${e.reporter_id} · body ${e.body_id} · room ${e.room}`;
    case "meeting_end":
      return "";
    case "meeting_summary": {
      const nv = e.votes && typeof e.votes === "object" && !Array.isArray(e.votes)
        ? Object.keys(e.votes as object).length
        : 0;
      const nc = Array.isArray(e.comm_actions) ? e.comm_actions.length : 0;
      const bodyInfo = e.body_agent_id != null ? ` body_agent ${e.body_agent_id}` : "";
      const tally = formatVoteTallyShort(e.votes as Record<string, number | null | undefined>, 72);
      return `t${e.meeting_tick_start}–${e.tick} rep ${e.reporter_id} room ${e.body_room}${bodyInfo} · votes ${nv} comm ${nc}${tally ? ` · ${tally}` : ""}`;
    }
    case "comm_action": {
      const parts: string[] = [];
      if (e.action_name != null) parts.push(String(e.action_name));
      else if (e.action_id != null) parts.push(`id ${e.action_id}`);
      parts.push(`from ${e.sender_id}`);
      if (e.sender_role === 0) parts.push("(crew)");
      else if (e.sender_role === 1) parts.push("(imp)");
      if (e.target_id != null) parts.push(`→${e.target_id}`);
      if (e.target_role === 0) parts.push("(crew)");
      else if (e.target_role === 1) parts.push("(imp)");
      if (e.meeting_tick_start != null) parts.push(`mt ${e.meeting_tick_start}`);
      return parts.join(" ");
    }
    case "ejection": {
      const roleStr = e.role === 0 ? "crew" : e.role === 1 ? "impostor" : String(e.role);
      const vt = formatVoteTallyShort(e.votes as Record<string, number | null | undefined>, 72);
      return `agent ${e.ejected_id} out (${roleStr})${vt ? ` · ${vt}` : ""}`;
    }
    case "phase_change":
      return `${phaseName(e.old_phase)} → ${phaseName(e.new_phase)}`;
    case "win": {
      const winner = e.winner === 0 ? "survivors" : e.winner === 1 ? "impostors" : String(e.winner);
      return `${winner} win · ${String(e.reason ?? "").slice(0, 48)}`;
    }
    case "vote_cast":
      return `agent ${e.voter_id} → ${e.target_id ?? "skip"}`;
    case "vote_failed_low_confidence":
      return `max_score ${Number(e.max_score).toFixed(2)} below thr ${Number(e.threshold).toFixed(2)} · ${e.num_candidates} candidates`;
    case "door_close":
      return `agent ${e.agent_id} closes edge ${JSON.stringify(e.edge)}`;
    case "door_open":
      return `edge ${JSON.stringify(e.edge)} reopens`;
    case "task_progress": {
      const pMax = typeof e.progress_max === "number" && e.progress_max > 0 ? e.progress_max : null;
      const progStr = pMax != null
        ? `${e.progress}/${pMax} (${Math.round((Number(e.progress) / pMax) * 100)}%)`
        : String(e.progress);
      return `agent ${e.agent_id} task ${e.task_idx} step ${e.step}: ${progStr}`;
    }
    case "task_step_complete":
      return `agent ${e.agent_id} task ${e.task_idx} step ${e.step} complete`;
    case "task_complete":
      return `agent ${e.agent_id} task ${e.task_idx} ALL DONE`;
    case "message_sent":
      return `agent ${e.sender_id} token #${e.token_id}`;
    case "evac_activated":
      return `reason: ${e.reason ?? "unknown"}`;
    case "evac_progress":
      return `count=${e.count} agents=[${(e.agents_in_evac as unknown[])?.join(",")}]`;
    case "knower_reveal":
      return `agent ${e.knower_id} learns agent ${e.target_id} is ${e.target_role === 1 ? "impostor" : "crew"}`;
    case "role_assignment": {
      const r = e.roles;
      if (!Array.isArray(r)) return "roles (malformed)";
      const imps: number[] = [];
      for (let i = 0; i < r.length; i++) {
        if (Number(r[i]) === 1) imps.push(i);
      }
      return `impostors [${imps.join(", ")}] · full vector ${JSON.stringify(r)}`;
    }
    case "task_assignment": {
      const tasks = Array.isArray(e.tasks) ? (e.tasks as Array<{ task_idx: number; rooms: number[] }>) : [];
      const rooms = tasks.map((t) => `t${t.task_idx}→[${(t.rooms ?? []).join(",")}]`).join(" ");
      return `agent ${e.agent_id} · ${rooms || "no tasks"}`;
    }
    case "vote_resolution": {
      const ejected = e.ejected_id != null ? `ejected ${e.ejected_id}` : "no ejection";
      const coord = e.has_coordination ? "coordinated" : "no coordination";
      const cands = Array.isArray(e.eligible_candidates) ? e.eligible_candidates.length : 0;
      return `${ejected} · ${coord} · ${cands} eligible · noise ${Number(e.voting_noise ?? 0).toFixed(2)}`;
    }
    default:
      return jsonPreview(e);
  }
}

type Props = {
  events: GameEvent[];
  currentTick: number;
  className?: string;
};

export function EventLog({ events, currentTick, className }: Props) {
  // Filter out high-volume noise events that obscure meaningful game events.
  const displayEvents = events.filter((e) => !DISPLAY_NOISE.has(e.event_type));

  return (
    <ScrollArea className={cn("h-[200px] rounded-md border border-zinc-800", className)}>
      <ul className="space-y-0.5 p-2 font-mono text-[11px]">
        {displayEvents.map((e, i) => {
          const hi = HIGHLIGHT.has(e.event_type);
          const atTick = e.tick === currentTick;
          const line = summarize(e);
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
              {line ? (
                <span className="text-zinc-500"> · {line}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
