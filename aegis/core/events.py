"""Typed events for logging."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, Any


class EventType(str, Enum):
    """Event type enum."""
    EPISODE_START = "episode_start"
    TICK_START = "tick_start"
    TICK_END = "tick_end"
    PHASE_CHANGE = "phase_change"
    MOVE = "move"
    KILL = "kill"
    REPORT = "report"
    MEETING_START = "meeting_start"
    MEETING_END = "meeting_end"
    VOTE_CAST = "vote_cast"
    EJECTION = "ejection"
    VOTE_FAILED_LOW_CONFIDENCE = "vote_failed_low_confidence"
    DOOR_CLOSE = "door_close"
    DOOR_OPEN = "door_open"
    TASK_PROGRESS = "task_progress"
    TASK_STEP_COMPLETE = "task_step_complete"
    TASK_COMPLETE = "task_complete"
    MESSAGE_SENT = "message_sent"
    COMM_ACTION = "comm_action"
    EVAC_ACTIVATED = "evac_activated"
    EVAC_PROGRESS = "evac_progress"
    WIN = "win"
    KNOWER_REVEAL = "knower_reveal"
    ROLE_ASSIGNMENT = "role_assignment"
    TASK_ASSIGNMENT = "task_assignment"
    MEETING_SUMMARY = "meeting_summary"
    VOTE_RESOLUTION = "vote_resolution"
    POSE = "pose"
    ROOM_ENTER = "room_enter"
    ROOM_EXIT = "room_exit"
    MOVE_BLOCKED = "move_blocked"


@dataclass
class Event:
    """Base event class."""
    event_type: EventType
    tick: int
    data: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert event to dictionary."""
        return {
            "event_type": self.event_type.value,
            "tick": self.tick,
            **self.data
        }


def make_event(event_type: EventType, tick: int, **kwargs) -> Event:
    """Factory function to create events."""
    return Event(event_type=event_type, tick=tick, data=kwargs)



def kill_event(tick: int, killer_id: int, victim_id: int, room: int) -> Event:
    return make_event(EventType.KILL, tick, killer_id=killer_id, victim_id=victim_id, room=room)


def report_event(tick: int, reporter_id: int, body_id: int, room: int) -> Event:
    return make_event(EventType.REPORT, tick, reporter_id=reporter_id, body_id=body_id, room=room)


def meeting_start_event(tick: int, reporter_id: int, body_id: int, room: int) -> Event:
    return make_event(EventType.MEETING_START, tick, reporter_id=reporter_id, body_id=body_id, room=room)


def meeting_end_event(tick: int) -> Event:
    return make_event(EventType.MEETING_END, tick)


def vote_cast_event(tick: int, voter_id: int, target_id: Optional[int]) -> Event:
    return make_event(EventType.VOTE_CAST, tick, voter_id=voter_id, target_id=target_id)


def ejection_event(tick: int, ejected_id: int, role: int, votes: dict) -> Event:
    return make_event(EventType.EJECTION, tick, ejected_id=ejected_id, role=role, votes=votes)


def vote_failed_event(tick: int, max_score: float, threshold: float, num_candidates: int) -> Event:
    return make_event(EventType.VOTE_FAILED_LOW_CONFIDENCE, tick, 
                     max_score=max_score, threshold=threshold, num_candidates=num_candidates)


def door_close_event(tick: int, agent_id: int, edge: tuple[int, int]) -> Event:
    return make_event(EventType.DOOR_CLOSE, tick, agent_id=agent_id, edge=list(edge))


def door_open_event(tick: int, edge: tuple[int, int]) -> Event:
    return make_event(EventType.DOOR_OPEN, tick, edge=list(edge))


def task_progress_event(tick: int, agent_id: int, task_idx: int, step: int, progress: int, progress_max: int = 0) -> Event:
    """Log task progress.

    Args:
        progress: Ticks accumulated in current step.
        progress_max: Ticks required to complete this step (enables % computation by the player).
    """
    return make_event(EventType.TASK_PROGRESS, tick, agent_id=agent_id, task_idx=task_idx, step=step, progress=progress, progress_max=progress_max)


def task_step_complete_event(tick: int, agent_id: int, task_idx: int, step: int) -> Event:
    return make_event(EventType.TASK_STEP_COMPLETE, tick, agent_id=agent_id, task_idx=task_idx, step=step)


def task_complete_event(tick: int, agent_id: int, task_idx: int) -> Event:
    return make_event(EventType.TASK_COMPLETE, tick, agent_id=agent_id, task_idx=task_idx)


def message_sent_event(tick: int, sender_id: int, token_id: int) -> Event:
    return make_event(EventType.MESSAGE_SENT, tick, sender_id=sender_id, token_id=token_id)


def comm_action_event(
    tick: int, 
    sender_id: int, 
    action_id: int, 
    action_name: str,
    sender_role: Optional[int] = None,
    target_id: Optional[int] = None,
    target_role: Optional[int] = None,
    meeting_tick_start: Optional[int] = None,
    meeting_reporter_id: Optional[int] = None,
    meeting_body_room: Optional[int] = None,
) -> Event:
    """
    Create a communication action event with full context for scientific analysis.
    
    Args:
        tick: Current game tick
        sender_id: Agent who sent the communication
        action_id: Communication action ID
        action_name: Human-readable action name (e.g., "ACCUSE(1)")
        sender_role: Role of sender (0=survivor, 1=impostor)
        target_id: Target agent ID (if applicable, e.g., for ACCUSE/SUPPORT/QUESTION)
        target_role: Role of target (0=survivor, 1=impostor, if applicable)
        meeting_tick_start: Tick when current meeting started
        meeting_reporter_id: Agent who reported the body (triggered meeting)
        meeting_body_room: Room where the body was found
    """
    data = {
        "sender_id": sender_id,
        "action_id": action_id,
        "action_name": action_name,
    }
    

    if sender_role is not None:
        data["sender_role"] = sender_role
    if target_id is not None:
        data["target_id"] = target_id
    if target_role is not None:
        data["target_role"] = target_role
    if meeting_tick_start is not None:
        data["meeting_tick_start"] = meeting_tick_start
    if meeting_reporter_id is not None:
        data["meeting_reporter_id"] = meeting_reporter_id
    if meeting_body_room is not None:
        data["meeting_body_room"] = meeting_body_room
    
    return make_event(EventType.COMM_ACTION, tick, **data)


def move_event(tick: int, agent_id: int, from_room: int, to_room: int) -> Event:
    return make_event(EventType.MOVE, tick, agent_id=agent_id, from_room=from_room, to_room=to_room)


def phase_change_event(tick: int, old_phase: int, new_phase: int) -> Event:
    return make_event(EventType.PHASE_CHANGE, tick, old_phase=old_phase, new_phase=new_phase)


def evac_activated_event(tick: int, reason: str) -> Event:
    return make_event(EventType.EVAC_ACTIVATED, tick, reason=reason)


def evac_progress_event(tick: int, count: int, agents_in_evac: list[int]) -> Event:
    return make_event(EventType.EVAC_PROGRESS, tick, count=count, agents_in_evac=agents_in_evac)


def win_event(tick: int, winner: int, reason: str) -> Event:
    return make_event(EventType.WIN, tick, winner=winner, reason=reason)


def knower_reveal_event(tick: int, knower_id: int, target_id: int, target_role: int) -> Event:
    return make_event(EventType.KNOWER_REVEAL, tick, knower_id=knower_id, target_id=target_id, target_role=target_role)


def role_assignment_event(tick: int, roles: list[int]) -> Event:
    """Ground-truth crew (0) / impostor (1) for every agent index; logged once at episode start."""
    return make_event(EventType.ROLE_ASSIGNMENT, tick, roles=roles)


def pose_event(
    tick: int,
    agent_id: int,
    room: int,
    x: float,
    y: float,
    theta: float,
    env_step: Optional[int] = None,
) -> Event:
    data: dict = {
        "agent_id": agent_id,
        "room": room,
        "x": x,
        "y": y,
        "theta": theta,
    }
    if env_step is not None:
        data["env_step"] = env_step
    return make_event(EventType.POSE, tick, **data)


def room_exit_event(tick: int, agent_id: int, room: int) -> Event:
    return make_event(EventType.ROOM_EXIT, tick, agent_id=agent_id, room=room)


def room_enter_event(tick: int, agent_id: int, room: int) -> Event:
    return make_event(EventType.ROOM_ENTER, tick, agent_id=agent_id, room=room)


def move_blocked_event(
    tick: int,
    agent_id: int,
    reason: str,
    from_room: int,
    to_room: int,
    edge: Optional[list[int]] = None,
) -> Event:
    d = {
        "agent_id": agent_id,
        "reason": reason,
        "from_room": from_room,
        "to_room": to_room,
    }
    if edge is not None:
        d["edge"] = edge
    return make_event(EventType.MOVE_BLOCKED, tick, **d)


def meeting_summary_event(
    tick: int,
    meeting_tick_start: int,
    reporter_id: int,
    body_room: int,
    comm_actions: list[dict],
    votes: dict[int, Optional[int]],
    ejected_id: Optional[int] = None,
    ejected_role: Optional[int] = None,
    body_agent_id: Optional[int] = None,
) -> Event:
    """
    Create a meeting summary event with all communications and voting results.

    Useful for scientific analysis: shows complete meeting context, all communications,
    and final outcome in one event.

    Args:
        tick: Current tick (end of meeting)
        meeting_tick_start: Tick when meeting started
        reporter_id: Agent who reported the body
        body_room: Room where body was found
        comm_actions: List of communication actions during meeting (with full context)
        votes: Final votes cast (voter_id -> target_id or None)
        ejected_id: Agent who was ejected (if any)
        ejected_role: Role of ejected agent (0=survivor, 1=impostor, if applicable)
        body_agent_id: Agent ID of the dead body that triggered the meeting (for full traceability)
    """
    data: dict = dict(
        meeting_tick_start=meeting_tick_start,
        reporter_id=reporter_id,
        body_room=body_room,
        comm_actions=comm_actions,
        votes=votes,
        ejected_id=ejected_id,
        ejected_role=ejected_role,
    )
    if body_agent_id is not None:
        data["body_agent_id"] = body_agent_id
    return make_event(EventType.MEETING_SUMMARY, tick, **data)


def episode_start_event(
    tick: int,
    seed: int,
    num_agents: int,
    num_survivors: int,
    num_impostors: int,
    num_rooms: int,
    evac_room: int,
    max_ticks: int,
) -> Event:
    """Metadata event emitted once at the very start of each episode (before role_assignment).

    Allows the player to display experiment context without needing an external config file.
    All values needed to fully interpret the log are included here.
    """
    return make_event(
        EventType.EPISODE_START,
        tick,
        seed=seed,
        num_agents=num_agents,
        num_survivors=num_survivors,
        num_impostors=num_impostors,
        num_rooms=num_rooms,
        evac_room=evac_room,
        max_ticks=max_ticks,
    )


def task_assignment_event(
    tick: int,
    agent_id: int,
    tasks: list[dict],
) -> Event:
    """Ground-truth task layout for a survivor, emitted once at tick 0.

    Each element of `tasks` is a dict:
      { task_idx, task_type, rooms: list[int], ticks_required: list[int] }

    Allows the player to show which rooms each survivor is targeting and
    to understand movement patterns relative to task objectives.
    """
    return make_event(EventType.TASK_ASSIGNMENT, tick, agent_id=agent_id, tasks=tasks)


def vote_resolution_event(
    tick: int,
    suspicion_scores: dict[int, float],
    accuse_counts: dict[int, int],
    eligible_candidates: list[int],
    has_coordination: bool,
    voting_noise: float,
    ejected_id: Optional[int],
) -> Event:
    """Environment-internal vote resolution record, emitted just before meeting_summary.

    Captures the full probabilistic ejection mechanism so it is fully auditable:
    - suspicion_scores: composite score (suspicion + trust) per alive agent at vote time
    - accuse_counts: ACCUSE actions received by each agent during this meeting
    - eligible_candidates: agents whose score was >= confidence_threshold
    - has_coordination: whether accuse_counts met voting_coordination_threshold
    - voting_noise: noise magnitude used in probabilistic selection
    - ejected_id: agent selected for ejection (None if confidence gate failed)
    """
    return make_event(
        EventType.VOTE_RESOLUTION,
        tick,
        suspicion_scores={str(k): round(v, 4) for k, v in suspicion_scores.items()},
        accuse_counts={str(k): v for k, v in accuse_counts.items()},
        eligible_candidates=eligible_candidates,
        has_coordination=has_coordination,
        voting_noise=round(voting_noise, 4),
        ejected_id=ejected_id,
    )

