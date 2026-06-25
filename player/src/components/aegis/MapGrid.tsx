"use client";

import { EVAC_ROOM, GRID_COLS, GRID_ROWS, roomToGrid } from "@/lib/mapLayout";
import type { AgentPose, EpisodeMeta, PhaseName, ReplaySnapshot, TaskState } from "@/lib/replay/types";
import { normalizeEdgeKey } from "@/lib/replay/edgeUtils";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import { useMemo } from "react";

type Props = {
  snapshot: ReplaySnapshot;
  className?: string;
};

function phaseRibbon(phase: PhaseName): string {
  switch (phase) {
    case "FREE_PLAY":
      return "Free play";
    case "MEETING":
      return "Meeting";
    case "VOTING":
      return "Voting";
    default:
      return "Phase";
  }
}

function offsetInRoom(aid: number, poses: (AgentPose | null)[]): { x: number; y: number } {
  const p = poses[aid];
  if (p) return { x: p.x, y: p.y };
  const j = aid % 7;
  return { x: 0.42 + j * 0.035, y: 0.44 + (aid % 5) * 0.035 };
}

function cellDoorClasses(room: number, closed: Set<string>): string {
  const { row, col } = roomToGrid(room);
  const parts: string[] = [];
  if (col < GRID_COLS - 1) {
    const k = normalizeEdgeKey([room, room + 1]);
    if (k && closed.has(k)) parts.push("border-r-[3px] border-r-rose-700/85");
    else parts.push("border-r-[2px] border-r-emerald-500/65");
  }
  if (row < GRID_ROWS - 1) {
    const k = normalizeEdgeKey([room, room + GRID_COLS]);
    if (k && closed.has(k)) parts.push("border-b-[3px] border-b-rose-700/85");
    else parts.push("border-b-[2px] border-b-emerald-500/65");
  }
  return parts.join(" ");
}

function metaLabel(meta: EpisodeMeta | null): string | null {
  if (!meta) return null;
  return `seed ${meta.seed} · ${meta.numAgents}a ${meta.numImpostors}i · ${meta.numRooms}r · max_t ${meta.maxTicks}`;
}

export function MapGrid({ snapshot, className }: Props) {
  const {
    positions,
    alive,
    roles,
    bodiesByRoom,
    activeMeeting,
    closedEdges,
    evac,
    tasksByAgent,
    recentTokens,
    knower,
    poses,
    hasPoseStream,
    phase,
    episodeMeta,
    lastWin,
    tick,
  } = snapshot;

  const usePoseCoordinates = hasPoseStream;
  const closed = useMemo(() => new Set(closedEdges), [closedEdges]);
  const lastTokenSender = recentTokens.length > 0 ? recentTokens[recentTokens.length - 1]!.senderId : null;

  const agentsByRoom: number[][] = Array.from({ length: GRID_COLS * GRID_ROWS }, () => []);
  for (let a = 0; a < positions.length; a++) {
    const r = positions[a];
    if (r !== null && r >= 0 && r < GRID_COLS * GRID_ROWS && alive[a]) {
      agentsByRoom[r].push(a);
    }
  }

  const evacHot =
    evac.agentsInEvac.length > 0 || (evac.active && (evac.lastCount ?? 0) > 0);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-lg border border-border/80 bg-muted/25 px-3 py-1.5 text-center",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
          {phaseRibbon(phase)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">t{snapshot.tick}</span>
        {episodeMeta ? (
          <span className="font-mono text-[9px] text-zinc-600" title="Episode metadata (from episode_start event)">
            {metaLabel(episodeMeta)}
          </span>
        ) : null}
        {knower ? (
          <span className="text-[10px] text-amber-800/95 dark:text-amber-200/90">
            · knower reveals in log{" "}
            <span className="font-mono">
              ({knower.knowerId}→{knower.targetId})
            </span>
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "relative mx-auto aspect-square w-full max-w-[min(96vw,960px)]",
          "rounded-2xl border border-zinc-700 bg-zinc-900/50 p-1 sm:p-1.5",
        )}
      >
        {lastWin && lastWin.tick <= tick && (() => {
          const isImpostor = lastWin.winner === 1;
          return (
            <div
              className={cn(
                "absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-[2px]",
              )}
            >
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight sm:text-3xl",
                  isImpostor ? "text-rose-400" : "text-emerald-400",
                )}
              >
                {isImpostor ? "Impostors win" : "Survivors win"}
              </span>
              <span className="mt-1 font-mono text-[11px] text-zinc-400">
                t{lastWin.tick} · {lastWin.reason}
              </span>
            </div>
          );
        })()}
        <div
          className="grid h-full w-full gap-1 rounded-xl bg-zinc-800/80 p-1"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, room) => {
            const row = Math.floor(room / GRID_COLS);
            const col = room % GRID_COLS;
            const evacRoom = episodeMeta?.evacRoom ?? EVAC_ROOM;
            const isEvac = room === evacRoom;
            const meetingHere = activeMeeting?.room === room;
            const bodies = bodiesByRoom[room] ?? [];
            const agentsHere = agentsByRoom[room];
            const doorCls = cellDoorClasses(room, closed);
            const evacRoster = isEvac ? evac.agentsInEvac : [];

            return (
              <div
                key={room}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-gradient-to-b from-zinc-900 to-zinc-950 p-1.5 sm:p-2",
                  "border-zinc-700/80",
                  doorCls,
                  isEvac && "border-zinc-500/60 ring-1 ring-zinc-500/25",
                  isEvac && evacHot && "ring-2 ring-emerald-600/45 ring-offset-1 ring-offset-zinc-900",
                  isEvac && evac.active && "bg-emerald-950/15",
                  meetingHere && "border-amber-500/40 ring-2 ring-amber-500/25",
                )}
              >
                <div className="mb-1 flex shrink-0 items-center justify-between gap-1 border-b border-zinc-800/70 pb-1">
                  <span className="font-mono text-[10px] font-medium tabular-nums text-zinc-300 sm:text-xs">
                    {isEvac ? "Evac" : `Room ${room}`}
                  </span>
                  {isEvac && (
                    <span
                      className={cn(
                        "text-[8px] font-medium uppercase tracking-wide",
                        evac.active ? "text-emerald-600/90" : "text-zinc-500",
                      )}
                    >
                      zone
                    </span>
                  )}
                </div>
                {isEvac && evacRoster.length > 0 && (
                  <div className="mb-1 shrink-0 rounded border border-emerald-900/40 bg-emerald-950/40 px-1 py-0.5 font-mono text-[8px] leading-tight text-emerald-600/95 sm:text-[9px]">
                    <span className="text-emerald-800/80">here</span> {evacRoster.join(", ")}
                  </div>
                )}

                <div
                  className={cn(
                    "flex min-h-0 flex-1",
                    usePoseCoordinates && agentsHere.some((aid) => poses[aid] != null)
                      ? "relative min-h-[5.5rem]"
                      : "flex-wrap content-center items-center justify-center gap-1.5 sm:gap-2",
                  )}
                >
                  {agentsHere.length === 0 && bodies.length === 0 && !meetingHere && (
                    <span className="text-[10px] text-zinc-700 sm:text-xs">—</span>
                  )}
                  {(() => {
                    const withPose = agentsHere.filter((aid) => poses[aid] != null);
                    const noPose = agentsHere.filter((aid) => poses[aid] == null);
                    const byPoseMode =
                      usePoseCoordinates && agentsHere.some((x) => poses[x] != null);

                    const token = (aid: number, abs: boolean) => {
                      const off = offsetInRoom(aid, poses);
                      return (
                        <div
                          key={aid}
                          className={cn(abs && "absolute z-[1]")}
                          style={
                            abs
                              ? {
                                  left: `${off.x * 100}%`,
                                  top: `${off.y * 100}%`,
                                  transform: "translate(-50%, -50%)",
                                }
                              : undefined
                          }
                        >
                          <AgentToken
                            id={aid}
                            role={roles[aid]}
                            tasks={tasksByAgent[aid] ?? []}
                            knowerMark={
                              knower
                                ? aid === knower.knowerId
                                  ? "knower"
                                  : aid === knower.targetId
                                    ? "target"
                                    : null
                                : null
                            }
                            targetRoleHint={knower && aid === knower.targetId ? knower.targetRole : null}
                            tokenPing={lastTokenSender === aid}
                          />
                        </div>
                      );
                    };

                    if (!byPoseMode) {
                      return agentsHere.map((aid) => token(aid, false));
                    }

                    return (
                      <>
                        {withPose.map((aid) => token(aid, true))}
                        {noPose.length > 0 ? (
                          <div className="absolute bottom-1 left-1 right-1 z-[2] flex flex-wrap items-center justify-center gap-1">
                            {noPose.map((aid) => token(aid, false))}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                {(bodies.length > 0 || meetingHere) && (
                  <div className="mt-1 shrink-0 border-t border-zinc-800/60 pt-1">
                    {bodies.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1">
                        {bodies.map((bid) => (
                          <span
                            key={bid}
                            className="rounded border border-amber-900/40 bg-amber-950/35 px-1 py-0.5 font-mono text-[9px] text-amber-700/90 sm:text-[10px]"
                            title={`Body — agent ${bid}`}
                          >
                            †{bid}
                          </span>
                        ))}
                      </div>
                    )}
                    {meetingHere && (
                      <div className="mt-0.5 text-center font-mono text-[8px] text-zinc-500 sm:text-[9px]">
                        meeting · rep {activeMeeting.reporterId}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[9px] text-muted-foreground sm:text-[10px]">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-600" /> crew
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-rose-600" /> impostor
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-zinc-500" /> role not in log yet
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-400" /> knower
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-violet-500" /> knower’s intel
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-amber-800/80 dark:text-amber-300/90">†</span> body
        </span>
      </p>

      <p className="mt-1 text-center font-mono text-[9px] text-zinc-600 sm:text-[10px]">
        <span className="text-emerald-600/85">─ open passage</span>
        {" · "}
        <span className="text-rose-800/90">─ direct path blocked</span>
        {closedEdges.length > 0 ? (
          <span className="text-rose-800/80"> · closed: {closedEdges.join(", ")}</span>
        ) : null}
        {closedEdges.length > 0 ? (
          <span className="text-zinc-700"> (agents may route around)</span>
        ) : null}
      </p>

      {(evac.active || evac.lastCount !== null || evac.agentsInEvac.length > 0) && (
        <p className="mt-0.5 text-center font-mono text-[9px] text-emerald-800/90 sm:text-[10px]">
          evac
          {evac.active ? " on" : ""}
          {evac.reason ? ` · ${evac.reason}` : ""}
          {evac.lastCount != null ? ` · count ${evac.lastCount}` : ""}
          {evac.agentsInEvac.length > 0 ? ` · [${evac.agentsInEvac.join(",")}]` : ""}
        </p>
      )}
    </div>
  );
}

function taskPrimary(tasks: TaskState[]): { progress: number; label: string } | null {
  if (tasks.length === 0) return null;
  const sorted = [...tasks].sort((a, b) => a.taskIdx - b.taskIdx || a.step - b.step);
  const t = sorted[0]!;
  // Compute percentage: if progress_max is available (new backend), use it; otherwise
  // assume progress is already a percentage (legacy logs without progress_max).
  const pct =
    t.progressMax != null && t.progressMax > 0
      ? Math.round((t.progress / t.progressMax) * 100)
      : Math.max(0, Math.min(100, Number(t.progress) || 0));
  const extra = sorted.length > 1 ? ` +${sorted.length - 1}` : "";
  const progressLabel =
    t.progressMax != null
      ? `${t.progress}/${t.progressMax}`
      : `${pct}%`;
  return { progress: pct, label: `t${t.taskIdx} s${t.step} ${progressLabel}${extra}` };
}

function roleTitle(role: 0 | 1 | null): string {
  if (role === 1) return "impostor (from log)";
  if (role === 0) return "crew (from log)";
  return "role not in log yet — wait for task, kill, comm, or meeting";
}

function AgentToken({
  id,
  role,
  tasks,
  knowerMark,
  targetRoleHint,
  tokenPing,
}: {
  id: number;
  role: 0 | 1 | null;
  tasks: TaskState[];
  knowerMark: "knower" | "target" | null;
  /** When this agent is the knower’s target, role from knower_reveal (0 crew / 1 impostor). */
  targetRoleHint: number | null;
  tokenPing: boolean;
}) {
  const label = role === 1 ? "IMP" : role === 0 ? "crew" : "?";
  const primary = taskPrimary(tasks);
  const taskTitle =
    tasks.length === 0
      ? ""
      : tasks
          .slice()
          .sort((a, b) => a.taskIdx - b.taskIdx)
          .map((t) => `t${t.taskIdx}: ${t.progress}% (step ${t.step})`)
          .join("; ");

  const intel =
    knowerMark === "target" && (targetRoleHint === 0 || targetRoleHint === 1)
      ? ` · knower saw them as ${targetRoleHint === 1 ? "impostor" : "crew"}`
      : "";

  return (
    <div className="relative">
      {knowerMark === "knower" && (
        <span
          className="absolute -left-0.5 -top-1 z-10 rounded bg-amber-500 px-0.5 font-mono text-[7px] font-bold uppercase leading-none text-amber-950 sm:text-[8px]"
          title="Knower (extra info role from log)"
        >
          K
        </span>
      )}
      {knowerMark === "target" && (
        <span
          className="absolute -right-0.5 -top-1 z-10 rounded bg-violet-600 px-0.5 font-mono text-[7px] font-bold uppercase leading-none text-white sm:text-[8px]"
          title="Who the knower learns about"
        >
          intel
        </span>
      )}
      <div
        className={cn(
          "relative flex size-10 shrink-0 flex-col items-center justify-center rounded-full border-2 font-mono leading-none shadow-md sm:size-12 md:size-14",
          role === 1 &&
            "border-rose-500 bg-rose-950/90 text-rose-50 ring-1 ring-rose-400/30",
          role === 0 && "border-emerald-600 bg-emerald-950/85 text-emerald-100 ring-1 ring-emerald-500/25",
          role === null && "border-zinc-500 bg-zinc-900 text-zinc-400",
          knowerMark === "knower" && "ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-950",
          knowerMark === "target" && "ring-2 ring-violet-500 ring-offset-1 ring-offset-zinc-950",
          tokenPing && "ring-2 ring-sky-400/70",
        )}
        title={`Agent ${id} · ${roleTitle(role)}${intel}${taskTitle ? ` · ${taskTitle}` : ""}${tokenPing ? " · last ping" : ""}`}
      >
        {tasks.length > 0 && (
          <ClipboardList className="absolute right-0.5 top-0.5 size-2.5 text-emerald-400/90 sm:size-3" aria-hidden />
        )}
        <span className="text-sm font-semibold tabular-nums sm:text-base md:text-lg">{id}</span>
        <span className="max-w-[2.5rem] truncate text-[7px] font-medium uppercase leading-tight text-white/80 sm:text-[8px]">
          {label}
        </span>
        {primary && (
          <div className="mt-0.5 h-1 w-[85%] max-w-[3rem] rounded-full bg-black/40 sm:max-w-[3.25rem]">
            <div
              className="h-full rounded-full bg-emerald-400/90 transition-[width] duration-150"
              style={{ width: `${primary.progress}%` }}
              title={primary.label}
            />
          </div>
        )}
      </div>
      {tokenPing && (
        <span
          className="absolute -bottom-0.5 left-1/2 z-10 -translate-x-1/2 font-mono text-[6px] uppercase text-sky-400/95 sm:text-[7px]"
          title="Last message token in log"
        >
          ping
        </span>
      )}
    </div>
  );
}
