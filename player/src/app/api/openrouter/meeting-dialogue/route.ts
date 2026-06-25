import type { MeetingTurn } from "@/lib/dialogue/extractMeetings"
import { mergeModelTextsWithTurns } from "@/lib/dialogue/parseModelDialogue"
import { NextResponse } from "next/server"

const MAX_PAYLOAD = 60_000;
const DEFAULT_MODEL = "anthropic/claude-3.5-haiku";

type AgentTaskInfo = {
  agentId: number;
  /** Unique rooms this agent has tasks in. */
  rooms: number[];
};

type Body = {
  includeDirectorRoles?: boolean;
  reporterId: number;
  bodyId: number;
  room: number;
  turns: MeetingTurn[];
  recentKillSummaries?: string[];
  /** roles[i] = 0 (survivor) | 1 (impostor). From role_assignment event. */
  roles?: number[];
  /** Task room destinations per survivor, from task_assignment events at tick 0. */
  tasksByAgent?: AgentTaskInfo[];
  /** Agent IDs alive at the moment the meeting started. */
  aliveAtMeeting?: number[];
  /** Tick when this meeting started. */
  meetingTick?: number;
};

/**
 * Compact system prompt — tells the model exactly what to do and what NOT to output.
 * Kept short on purpose: each token in the system prompt is paid per API call.
 */
function systemPrompt(): string {
  return (
    "You voice agents in a hidden-role deduction game. " +
    "Each agent knows ONLY their own role — they have NO knowledge of any other agent's role. " +
    "Survivors try to identify the killer through deduction and accusation. " +
    "Impostors blend in by sounding helpful and calm while misdirecting blame. " +
    "CRITICAL: Never write dialogue that reveals, implies, or assumes knowledge of another agent's role. " +
    "No agent should say or imply 'I know you are crew/impostor' or 'we impostors'. " +
    "All agents speak as genuinely uncertain about who is guilty. " +
    "Style: casual real-time VOIP, 8–22 words per line, no game jargon. " +
    "Return ONLY a raw JSON array — no markdown, no commentary. " +
    'Shape: [{"text":"..."},...] — one object per turn, same count, same order. ' +
    "NEVER output inside text: NO_OP DEFEND_SELF SUPPORT( ACCUSE( QUESTION( token# *ping* →codes. " +
    "Translate symbolic intent to natural casual speech only."
  );
}

const ACTION_LABEL: Record<string, string> = {
  DEFEND_SELF: "defends self",
  NO_OP: "silent",
};

function shortAction(t: Extract<MeetingTurn, { kind: "comm_action" }>): string {
  const raw = (t.action_name ?? String(t.action_id ?? "?")).trim();
  if (ACTION_LABEL[raw]) return ACTION_LABEL[raw]!;
  // SUPPORT(N) → "backs AgN", ACCUSE(N) → "accuses AgN", QUESTION(N) → "questions AgN"
  const m = /^(SUPPORT|ACCUSE|QUESTION)\((\d+)\)$/i.exec(raw);
  if (m) {
    const verb = { SUPPORT: "backs", ACCUSE: "accuses", QUESTION: "questions" }[m[1]!.toUpperCase()] ?? m[1]!.toLowerCase();
    return `${verb} Ag${m[2]}`;
  }
  return raw;
}

function roleTag(role: number | null | undefined, includeRoles: boolean): string {
  if (!includeRoles || role == null) return "";
  return role === 1 ? "[I]" : "[S]";
}

/**
 * Dense prompt format: minimal whitespace, all critical context on few lines.
 * Typical size: ~150–250 tokens for a 10-turn meeting with full context.
 */
function buildUserPrompt(b: Body): string {
  const parts: string[] = [];
  const dir = !!b.includeDirectorRoles;

  // Context line
  const tickPfx = b.meetingTick != null ? `t${b.meetingTick} ` : "";
  parts.push(`${tickPfx}Ag${b.reporterId} found body Ag${b.bodyId} room ${b.room}.`);

  // Roster (only when director roles enabled — costs a few tokens, huge quality gain)
  if (dir && b.roles && b.roles.length > 0) {
    const surv = b.roles.map((r, i) => (r === 0 ? i : -1)).filter((i) => i >= 0);
    const imp = b.roles.map((r, i) => (r === 1 ? i : -1)).filter((i) => i >= 0);
    parts.push(`Roster — S:[${surv}] I:[${imp}]`);
  }

  if (b.aliveAtMeeting && b.aliveAtMeeting.length > 0) {
    parts.push(`Alive:[${b.aliveAtMeeting}]`);
  }

  // Task destinations — lets survivors claim route as alibi ("I had to go to room 5")
  if (b.tasksByAgent && b.tasksByAgent.length > 0) {
    const taskLine = b.tasksByAgent
      .map(({ agentId, rooms }) => `Ag${agentId}→[${rooms}]`)
      .join(" ");
    parts.push(`Tasks: ${taskLine}`);
  }

  // Recent kills
  if (b.recentKillSummaries && b.recentKillSummaries.length > 0) {
    parts.push(`Before: ${b.recentKillSummaries.join("; ")}`);
  }

  // Turns
  parts.push(`Turns:`);
  b.turns.forEach((t, i) => {
    if (t.kind === "comm_action") {
      const sr = roleTag(t.sender_role, dir);
      const tr = roleTag(t.target_role, dir);
      const tgt = t.target_id != null ? ` Ag${t.target_id}${tr}` : "";
      parts.push(`${i + 1}. Ag${t.sender_id}${sr} ${shortAction(t)}${tgt}`);
    } else {
      parts.push(`${i + 1}. Ag${t.sender_id} [radio static]`);
    }
  });

  parts.push(`JSON array (${b.turns.length} items):`);
  return parts.join("\n");
}

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "Server misconfiguration: OPENROUTER_API_KEY is not set." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const turns = Array.isArray(body.turns) ? body.turns : [];
  if (turns.length === 0) {
    return NextResponse.json({ lines: [], model: null });
  }

  const userText = buildUserPrompt(body);
  if (userText.length > MAX_PAYLOAD) {
    return NextResponse.json({ error: "Meeting payload too large." }, { status: 413 });
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "http://localhost:3000";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "AEGIS Player";

  // Budget: ~70 tokens/turn for 15-25 word sentences. Higher cap than before since
  // caller now pre-filters to ≤50 meaningful turns (no NO_OP bloat).
  const maxTokens = Math.min(8192, 300 + turns.length * 70);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Referer: referer,
        "X-Title": title,
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userText },
        ],
      }),
    });

    const rawText = await res.text();
    if (!res.ok) {
      let detail = rawText.slice(0, 400);
      try {
        const j = JSON.parse(rawText) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {
        /* keep raw */
      }
      return NextResponse.json(
        { error: `OpenRouter error (${res.status})`, detail },
        { status: 502 },
      );
    }

    const data = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }

    // mergeModelTextsWithTurns extracts only `text` from the model array and
    // pins speaker_id / tick / kind from the original turns — the model never needs to echo them.
    const merged = mergeModelTextsWithTurns(turns, content);
    if (merged && merged.length === turns.length) {
      return NextResponse.json({ lines: merged, model });
    }

    return NextResponse.json(
      { error: "Could not parse model JSON.", rawPreview: content.slice(0, 600) },
      { status: 502 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Request failed.", detail: msg }, { status: 502 });
  }
}
