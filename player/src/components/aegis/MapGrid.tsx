"use client";

import { EVAC_ROOM, GRID_COLS, GRID_ROWS, roomToGrid } from "@/lib/mapLayout";
import type { ReplaySnapshot } from "@/lib/replay/types";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: ReplaySnapshot;
  className?: string;
};

export function MapGrid({ snapshot, className }: Props) {
  const { numAgents, positions, alive, roles, bodiesByRoom, activeMeeting } = snapshot;

  const agentsByRoom: number[][] = Array.from({ length: GRID_COLS * GRID_ROWS }, () => []);
  for (let a = 0; a < numAgents; a++) {
    const r = positions[a];
    if (r !== null && r >= 0 && r < GRID_COLS * GRID_ROWS && alive[a]) {
      agentsByRoom[r].push(a);
    }
  }

  return (
    <div
      className={cn(
        "grid gap-px bg-zinc-700/80 p-px rounded-md border border-zinc-600/90",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, room) => {
        const { row, col } = roomToGrid(room);
        const isEvac = room === EVAC_ROOM;
        const meetingHere = activeMeeting?.room === room;
        const bodies = bodiesByRoom[room] ?? [];
        const agentsHere = agentsByRoom[room];

        return (
          <div
            key={room}
            className={cn(
              "relative min-h-[88px] flex flex-col items-center justify-between py-2 px-1.5",
              "bg-zinc-950 text-zinc-200",
              isEvac && "ring-1 ring-inset ring-zinc-500/60 bg-zinc-900/95",
              meetingHere && "ring-1 ring-inset ring-zinc-400/70",
            )}
          >
            <div className="flex w-full items-start justify-between gap-1">
              <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
                {row},{col}
              </span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                #{room}
              </span>
            </div>

            {isEvac && (
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                evac
              </span>
            )}

            <div className="flex flex-wrap items-center justify-center gap-1">
              {agentsHere.map((aid) => (
                <AgentToken
                  key={aid}
                  id={aid}
                  role={roles[aid]}
                />
              ))}
            </div>

            {bodies.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                {bodies.map((bid) => (
                  <span
                    key={bid}
                    className="rounded border border-zinc-600 bg-zinc-900 px-1 py-0.5 font-mono text-[9px] text-zinc-500"
                    title={`Body: agent ${bid}`}
                  >
                    body {bid}
                  </span>
                ))}
              </div>
            )}

            {meetingHere && (
              <span className="mt-1 text-center text-[9px] leading-tight text-zinc-500">
                meeting · R{activeMeeting.reporterId} · B{activeMeeting.bodyId}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentToken({ id, role }: { id: number; role: 0 | 1 | null }) {
  const label = role === 1 ? "I" : role === 0 ? "S" : "?";
  return (
    <div
      className={cn(
        "flex size-8 flex-col items-center justify-center rounded-full border font-mono text-[10px] leading-none",
        role === 1 &&
          "border-zinc-500 bg-zinc-900 text-zinc-100 ring-1 ring-zinc-500/40",
        role === 0 &&
          "border-zinc-600 bg-zinc-950 text-zinc-300",
        role === null &&
          "border-zinc-700 bg-black text-zinc-500",
      )}
      title={`Agent ${id} · ${role === 1 ? "impostor" : role === 0 ? "survivor" : "role unknown"}`}
    >
      <span className="text-[11px] font-semibold tabular-nums">{id}</span>
      <span className="text-[8px] text-zinc-500">{label}</span>
    </div>
  );
}
