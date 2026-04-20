"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapGrid } from "@/components/aegis/MapGrid";
import { EventLog } from "@/components/aegis/EventLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { buildSnapshotAtTick, eventsThroughTick } from "@/lib/replay/buildSnapshot";
import { parseJsonl, splitEpisodes } from "@/lib/replay/parseEvents";
import type { EpisodeSlice } from "@/lib/replay/types";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

export function AegisPlayer() {
  const [rawText, setRawText] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSlice[]>([]);
  const [episodeIdx, setEpisodeIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Playback speed: ticks per second (scaled). */
  const [speed, setSpeed] = useState(4);
  const [loadError, setLoadError] = useState<string | null>(null);

  const episode = episodes[episodeIdx] ?? null;
  const maxTick = episode?.maxTick ?? 0;

  const snapshot = useMemo(() => {
    if (!episode) return null;
    return buildSnapshotAtTick(episode.events, tick);
  }, [episode, tick]);

  const logEvents = useMemo(() => {
    if (!episode) return [];
    return eventsThroughTick(episode.events, tick, 100);
  }, [episode, tick]);

  const meetingSummary = useMemo(() => {
    if (!episode) return null;
    for (let i = episode.events.length - 1; i >= 0; i--) {
      const e = episode.events[i];
      if (e.tick <= tick && e.event_type === "meeting_summary") {
        return e;
      }
    }
    return null;
  }, [episode, tick]);

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

  const onFile = useCallback(async (file: File | null) => {
    setLoadError(null);
    if (!file) return;
    try {
      const text = await file.text();
      setRawText(text);
      const all = parseJsonl(text);
      const eps = splitEpisodes(all);
      setEpisodes(eps);
      setEpisodeIdx(0);
      setTick(0);
      setPlaying(false);
      if (eps.length === 0) {
        setLoadError("No valid events found in file.");
      }
    } catch {
      setLoadError("Could not read file.");
    }
  }, []);

  const commActions =
    meetingSummary && Array.isArray(meetingSummary.comm_actions)
      ? (meetingSummary.comm_actions as Record<string, unknown>[])
      : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-zinc-100">
          AEGIS · event replay
        </h1>
        <p className="text-sm text-zinc-500">
          Load <span className="font-mono text-zinc-400">events.jsonl</span> from a training
          seed. Dark schematic map; NLG via OpenRouter can plug into the comm panel later.
        </p>
      </header>

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-200">Source</CardTitle>
          <CardDescription className="text-zinc-500">
            One episode per segment (tick reset in the log starts a new segment).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="events-file" className="text-zinc-400">
              events.jsonl
            </Label>
            <Input
              id="events-file"
              type="file"
              accept=".jsonl,.json,.txt"
              className="cursor-pointer border-zinc-800 bg-black file:text-zinc-300"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {episodes.length > 0 && (
            <div className="w-full space-y-2 sm:w-56">
              <Label className="text-zinc-400">Episode</Label>
              <Select
                value={String(episodeIdx)}
                onValueChange={(v) => {
                  setEpisodeIdx(Number(v));
                  setTick(0);
                  setPlaying(false);
                }}
              >
                <SelectTrigger className="border-zinc-800 bg-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {episodes.map((ep) => (
                    <SelectItem key={ep.index} value={String(ep.index)}>
                      Episode {ep.index + 1} · max tick {ep.maxTick}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
        {loadError && (
          <CardContent className="pt-0">
            <p className="text-sm text-red-400/90">{loadError}</p>
          </CardContent>
        )}
      </Card>

      {episode && snapshot && (
        <>
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base text-zinc-200">Transport</CardTitle>
                <CardDescription className="text-zinc-500">
                  Tick {tick} / {maxTick} · phase{" "}
                  <span className="font-mono text-zinc-400">{snapshot.phase}</span>
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {snapshot.lastWin && snapshot.lastWin.tick <= tick && (
                  <Badge variant="secondary" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                    win t{snapshot.lastWin.tick}: {snapshot.lastWin.reason}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() => setTick(0)}
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={playing ? "secondary" : "default"}
                  size="sm"
                  className={playing ? "border-zinc-700" : ""}
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() => setTick(maxTick)}
                >
                  <SkipForward className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Seek</span>
                  <span className="font-mono tabular-nums">{tick}</span>
                </div>
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
                  className="py-1"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Speed (ticks / sec)</span>
                  <span className="font-mono tabular-nums">{speed.toFixed(2)}</span>
                </div>
                <Slider
                  value={[speed]}
                  min={0.25}
                  max={32}
                  step={0.25}
                  onValueChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : v;
                    setSpeed(typeof next === "number" ? next : 4);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Map · 3×3
              </h2>
              <MapGrid snapshot={snapshot} />
            </div>
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Event tail
                </h2>
                <EventLog events={logEvents} currentTick={tick} />
              </div>
              <Separator className="bg-zinc-800" />
              <div>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Last meeting summary (≤ current tick)
                </h2>
                <ScrollArea className="h-[200px] rounded-md border border-zinc-800">
                  {commActions.length === 0 ? (
                    <p className="p-3 text-xs text-zinc-600">
                      No meeting summary yet at this tick — scrub forward after a meeting ends.
                    </p>
                  ) : (
                    <ul className="space-y-2 p-3">
                      {commActions.map((c, i) => (
                        <li
                          key={i}
                          className="rounded border border-zinc-800/80 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-zinc-400"
                        >
                          <span className="text-zinc-600">t{String(c.tick)}</span> agent{" "}
                          {String(c.sender_id)} ·{" "}
                          <span className="text-zinc-200">{String(c.action_name)}</span>
                          {c.target_id != null ? (
                            <span className="text-zinc-500"> → {String(c.target_id)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
                <p className="mt-2 text-[10px] text-zinc-600">
                  Future: OpenRouter NLG replaces or augments <span className="font-mono">action_name</span>{" "}
                  for readable dialogue.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {!rawText && (
        <p className="text-center text-sm text-zinc-600">
          Load a log file to begin replay.
        </p>
      )}
    </div>
  );
}
