"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapGrid } from "@/components/aegis/MapGrid";
import { MeetingChat } from "@/components/aegis/MeetingChat";
import { EventLog } from "@/components/aegis/EventLog";
import { ReplayHud } from "@/components/aegis/ReplayHud";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { buildSnapshotAtTick, eventsThroughTick } from "@/lib/replay/buildSnapshot";
import { inferNumAgents, parseJsonlFromBlob, splitEpisodes } from "@/lib/replay/parseEvents";
import { parseAgentAliases } from "@/lib/dialogue/agentAliases";
import { enrichAllMeetings } from "@/lib/dialogue/enrichMeetings";
import {
  fallbackUtterancesForMeeting,
  type Utterance,
} from "@/lib/dialogue/fallbackUtterances";
import { extractMeetingsFromEpisode } from "@/lib/dialogue/extractMeetings";
import type { EpisodeSlice, PhaseName } from "@/lib/replay/types";
import { Pause, Play, SkipBack, SkipForward, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PHASE_TOAST_LABEL: Record<PhaseName, string> = {
  FREE_PLAY: "Free play",
  MEETING: "Meeting",
  VOTING: "Voting",
  UNKNOWN: "Unknown phase",
};

const SPEED_OPTIONS = [1, 2, 4, 8, 16, 24] as const;

function isEventLogFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type;
  return (
    name.endsWith(".jsonl") ||
    name.endsWith(".json") ||
    name.endsWith(".txt") ||
    type === "application/json" ||
    type === "application/x-ndjson" ||
    type === "text/plain" ||
    type === ""
  );
}

type LoadedMeta = { name: string; eventCount: number; episodeCount: number };

export function AegisPlayer() {
  const [episodes, setEpisodes] = useState<EpisodeSlice[]>([]);
  const [episodeIdx, setEpisodeIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(4);
  const [dragActive, setDragActive] = useState(false);
  const [loadedMeta, setLoadedMeta] = useState<LoadedMeta | null>(null);
  const [meetingUtterances, setMeetingUtterances] = useState<Map<number, Utterance[]>>(
    () => new Map(),
  );
  const [symbolicMeetingIndices, setSymbolicMeetingIndices] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phaseToastRef = useRef<{ episodeKey: string; phase: PhaseName } | null>(null);
  const ejectionToastTickRef = useRef<number | null>(null);

  const hasLog = episodes.length > 0;
  const episode = episodes[episodeIdx] ?? null;
  const maxTick = episode?.maxTick ?? 0;

  const snapshot = useMemo(() => {
    if (!episode) return null;
    return buildSnapshotAtTick(episode.events, tick);
  }, [episode, tick]);

  const logEvents = useMemo(() => {
    if (!episode) return [];
    return eventsThroughTick(episode.events, tick, 80);
  }, [episode, tick]);

  const meetingsInEpisode = useMemo(
    () => (episode ? extractMeetingsFromEpisode(episode.events) : []),
    [episode],
  );

  const numAgentsForLabels = useMemo(
    () => (episode ? inferNumAgents(episode.events) : 6),
    [episode],
  );

  const agentLabels = useMemo(
    () => parseAgentAliases("", numAgentsForLabels),
    [numAgentsForLabels],
  );

  useEffect(() => {
    if (!episode) return;
    const meetings = extractMeetingsFromEpisode(episode.events);
    const init = new Map<number, Utterance[]>();
    for (const m of meetings) {
      init.set(m.index, fallbackUtterancesForMeeting(m));
    }
    setMeetingUtterances(init);
    setSymbolicMeetingIndices([]);

    if (meetings.length === 0) {
      return;
    }

    let cancelled = false;
    void enrichAllMeetings(episode.events, meetings, true, 2).then((result) => {
      if (cancelled) return;
      setMeetingUtterances(result.map);
      setSymbolicMeetingIndices(result.symbolicMeetingIndices);

      const nSym = result.symbolicMeetingIndices.length;
      const nOk = meetings.length - nSym;
      if (meetings.length === 0) return;
      if (nSym === meetings.length) {
        toast.warning("Meeting chat: shorthand only", {
          description:
            "Natural dialogue failed for every meeting — check OPENROUTER_API_KEY, quotas, or try again.",
        });
      } else if (nSym > 0) {
        toast.message("Meeting chat ready (partial)", {
          description: `${nOk} voiced · ${nSym} shorthand (NLG unavailable or echoed protocol)`,
        });
      } else {
        toast.success("Meeting dialogue ready", {
          description: `${meetings.length} meeting(s)`,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [episode, episodeIdx]);

  useEffect(() => {
    if (!episode || !snapshot) return;
    const episodeKey = `${episodeIdx}-${episode.index}-${episode.maxTick}-${episode.events.length}`;
    const p = snapshot.phase;
    const prev = phaseToastRef.current;
    if (!prev || prev.episodeKey !== episodeKey) {
      phaseToastRef.current = { episodeKey, phase: p };
      return;
    }
    if (prev.phase !== p) {
      phaseToastRef.current = { episodeKey, phase: p };
      toast.message(`Phase: ${PHASE_TOAST_LABEL[p] ?? p}`, {
        description: `Tick ${tick}`,
      });
    }
  }, [episode, snapshot, episodeIdx, tick]);

  useEffect(() => {
    ejectionToastTickRef.current = null;
  }, [episode?.index, episodeIdx, episode?.events.length]);

  useEffect(() => {
    const ej = snapshot?.lastEjection;
    if (!ej) return;
    if (tick < ej.tick) {
      ejectionToastTickRef.current = null;
      return;
    }
    if (ejectionToastTickRef.current === ej.tick) return;
    ejectionToastTickRef.current = ej.tick;
    const roleWord = ej.role === 0 ? "crew" : ej.role === 1 ? "impostor" : `role code ${ej.role}`;
    toast.message(`Ejection · agent ${ej.ejectedId}`, {
      description: `Voted out as ${roleWord}.`,
    });
  }, [snapshot?.lastEjection, tick]);

  // Auto-pause when playback reaches the win tick so agents don't keep "moving"
  // after the game has already ended.
  const winToastTickRef = useRef<number | null>(null);
  useEffect(() => {
    const win = snapshot?.lastWin;
    if (!win) return;
    if (tick < win.tick) {
      winToastTickRef.current = null;
      return;
    }
    if (winToastTickRef.current === win.tick) return;
    winToastTickRef.current = win.tick;
    setPlaying(false);
    const winner = win.winner === 0 ? "Survivors" : win.winner === 1 ? "Impostors" : `Team ${win.winner}`;
    toast.success(`${winner} win`, { description: `t${win.tick} · ${win.reason}` });
  }, [snapshot?.lastWin, tick]);

  const clearSession = useCallback(() => {
    phaseToastRef.current = null;
    ejectionToastTickRef.current = null;
    setEpisodes([]);
    setEpisodeIdx(0);
    setTick(0);
    setPlaying(false);
    setLoadedMeta(null);
    setMeetingUtterances(new Map());
    setSymbolicMeetingIndices([]);
  }, []);

  useEffect(() => {
    if (!episode) return;
    setTick((t) => Math.min(t, maxTick));
  }, [episode, maxTick]);

  useEffect(() => {
    if (!playing || !episode) return;
    const ms = 1000 / Math.max(0.25, speed);
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t >= maxTick) {
          setPlaying(false);
          return maxTick;
        }
        return t + 1;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [playing, episode, maxTick, speed]);

  useEffect(() => {
    if (!episode) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        setTick((x) => Math.max(0, x - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        setTick((x) => Math.min(maxTick, x + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [episode, maxTick]);

  const loadFromFile = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!isEventLogFile(file)) {
      toast.error("Wrong file type", {
        description: "Use .jsonl, .json, or .txt (one JSON per line).",
      });
      return;
    }
    if (file.size === 0) {
      toast.error("Empty file");
      return;
    }
    try {
      const all = await parseJsonlFromBlob(file);
      const eps = splitEpisodes(all);
      if (eps.length === 0) {
        toast.error("No events parsed", {
          description: "Each line must be JSON with event_type and tick.",
        });
        setPlaying(false);
        return;
      }
      phaseToastRef.current = null;
      ejectionToastTickRef.current = null;
      setEpisodes(eps);
      setEpisodeIdx(0);
      setTick(0);
      setPlaying(true);
      setLoadedMeta({
        name: file.name,
        eventCount: all.length,
        episodeCount: eps.length,
      });
      toast.success("Log loaded", {
        description: `${file.name} · ${eps.length} episode(s) · ${all.length.toLocaleString()} events`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Could not load file", { description: msg || undefined });
      setPlaying(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      void loadFromFile(f ?? null);
    },
    [loadFromFile],
  );

  const speedSelectValue = SPEED_OPTIONS.includes(speed as (typeof SPEED_OPTIONS)[number])
    ? String(speed)
    : String(SPEED_OPTIONS.reduce((p, c) => (Math.abs(c - speed) < Math.abs(p - speed) ? c : p)));

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-3 py-4 sm:px-4">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-2">
        <span className="text-sm font-medium tracking-tight text-zinc-200">AEGIS</span>
        {hasLog && loadedMeta && (
          <>
            <span className="hidden h-3 w-px bg-zinc-800 sm:block" aria-hidden />
            <Select
              value={String(episodeIdx)}
              onValueChange={(v) => {
                setEpisodeIdx(Number(v));
                setTick(0);
                setPlaying(true);
              }}
            >
              <SelectTrigger className="h-7 w-[130px] border-zinc-800 bg-zinc-950 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {episodes.map((ep) => (
                  <SelectItem key={ep.index} value={String(ep.index)} className="text-xs">
                    Ep {ep.index + 1} · t≤{ep.maxTick}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-500"
                onClick={() => fileInputRef.current?.click()}
                aria-label="New file"
              >
                <FileUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-500"
                onClick={() => clearSession()}
                aria-label="Close"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </>
        )}
      </header>

      {!hasLog && (
        <div
          role="region"
          aria-label="Load event log"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "rounded-lg border border-dashed py-8 text-center transition-colors",
            dragActive
              ? "border-zinc-500 bg-zinc-900/60"
              : "border-zinc-800 bg-zinc-950/30",
          )}
        >
          <p className="text-xs text-zinc-500">
            Drop <span className="font-mono text-zinc-400">.jsonl</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-7 border-zinc-800 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.json,.txt,application/json,text/plain,*/*"
        className="sr-only"
        onChange={(e) => {
          void loadFromFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {episode && snapshot && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 border-zinc-800"
                onClick={() => {
                  setTick(0);
                  setPlaying(false);
                }}
                aria-label="Start"
              >
                <SkipBack className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn("h-8 gap-1.5 px-3", playing && "bg-zinc-800")}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                <span className="text-xs">{playing ? "Pause" : "Play"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 border-zinc-800"
                onClick={() => {
                  setTick(maxTick);
                  setPlaying(false);
                }}
                aria-label="End"
              >
                <SkipForward className="size-3.5" />
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500">
                {tick}/{maxTick}
              </span>
              <Slider
                value={[tick]}
                min={0}
                max={maxTick}
                step={1}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v;
                  setTick(typeof next === "number" ? next : 0);
                  setPlaying(false);
                }}
                className="min-w-0 flex-1 py-0"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={speedSelectValue} onValueChange={(v) => setSpeed(Number(v))}>
                <SelectTrigger className="h-8 w-[100px] border-zinc-800 bg-zinc-950 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)} className="text-xs">
                      {s}/s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span
                className="hidden max-w-[10rem] truncate font-mono text-[10px] text-muted-foreground sm:inline"
                title={snapshot.phase}
              >
                {PHASE_TOAST_LABEL[snapshot.phase]}
              </span>
            </div>
          </div>

          {snapshot.lastWin && snapshot.lastWin.tick <= tick && (
            <p className="text-[10px] text-zinc-500">
              win t{snapshot.lastWin.tick}{" "}
              <span className="text-zinc-600">{snapshot.lastWin.reason}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <div className="min-w-0 flex-1">
              <MapGrid snapshot={snapshot} />
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72 xl:w-96">
              <ReplayHud
                snapshot={snapshot}
                suppressCommStreams={meetingsInEpisode.length > 0}
              />
              <MeetingChat
                phase={snapshot.phase}
                meetings={meetingsInEpisode}
                utterancesByMeetingIdx={meetingUtterances}
                symbolicMeetingIndices={symbolicMeetingIndices}
                currentTick={tick}
                agentLabels={agentLabels}
                agentRoles={snapshot.roles}
              />
              {(snapshot.phase === "FREE_PLAY" || snapshot.phase === "UNKNOWN") && (
                <EventLog events={logEvents} currentTick={tick} className="border-zinc-800/80" />
              )}
            </div>
          </div>

          <p className="text-[9px] text-zinc-700">Space · ← →</p>
        </>
      )}
    </div>
  );
}
