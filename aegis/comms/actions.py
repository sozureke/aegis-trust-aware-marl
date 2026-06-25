from __future__ import annotations

from enum import IntEnum
from typing import Optional


class CommAction(IntEnum):
    """Discrete communication actions for agent interaction.

    Layout (6-agent vocabulary):
      0        NO_OP
      1–6      SUPPORT_0..5
      7–12     ACCUSE_0..5
      13       DEFEND_SELF
      14–19    QUESTION_0..5
    """
    NO_OP = 0
    SUPPORT_0 = 1
    SUPPORT_1 = 2
    SUPPORT_2 = 3
    SUPPORT_3 = 4
    SUPPORT_4 = 5
    SUPPORT_5 = 6
    ACCUSE_0 = 7
    ACCUSE_1 = 8
    ACCUSE_2 = 9
    ACCUSE_3 = 10
    ACCUSE_4 = 11
    ACCUSE_5 = 12
    DEFEND_SELF = 13
    QUESTION_0 = 14
    QUESTION_1 = 15
    QUESTION_2 = 16
    QUESTION_3 = 17
    QUESTION_4 = 18
    QUESTION_5 = 19


class CommVocab:
    """Communication vocabulary helper class."""

    VOCAB_SIZE = 20

    NO_OP = 0
    SUPPORT_BASE = 1
    SUPPORT_END = 7   # exclusive: agents 0..5
    ACCUSE_BASE = 7
    ACCUSE_END = 13   # exclusive: agents 0..5
    DEFEND_SELF = 13
    QUESTION_BASE = 14
    QUESTION_END = 20  # exclusive: agents 0..5

    @classmethod
    def is_support(cls, action_id: int) -> bool:
        return cls.SUPPORT_BASE <= action_id < cls.SUPPORT_END

    @classmethod
    def is_accuse(cls, action_id: int) -> bool:
        return cls.ACCUSE_BASE <= action_id < cls.ACCUSE_END

    @classmethod
    def is_question(cls, action_id: int) -> bool:
        return cls.QUESTION_BASE <= action_id < cls.QUESTION_END

    @classmethod
    def is_defend(cls, action_id: int) -> bool:
        return action_id == cls.DEFEND_SELF

    @classmethod
    def get_support_target(cls, action_id: int) -> Optional[int]:
        if cls.is_support(action_id):
            return action_id - cls.SUPPORT_BASE
        return None

    @classmethod
    def get_accuse_target(cls, action_id: int) -> Optional[int]:
        if cls.is_accuse(action_id):
            return action_id - cls.ACCUSE_BASE
        return None

    @classmethod
    def get_question_target(cls, action_id: int) -> Optional[int]:
        if cls.is_question(action_id):
            return action_id - cls.QUESTION_BASE
        return None

    @classmethod
    def make_support(cls, agent_id: int) -> int:
        return cls.SUPPORT_BASE + agent_id

    @classmethod
    def make_accuse(cls, agent_id: int) -> int:
        return cls.ACCUSE_BASE + agent_id

    @classmethod
    def make_question(cls, agent_id: int) -> int:
        return cls.QUESTION_BASE + agent_id

    @classmethod
    def action_to_string(cls, action_id: int) -> str:
        if action_id == cls.NO_OP:
            return "NO_OP"
        elif cls.is_support(action_id):
            return f"SUPPORT({cls.get_support_target(action_id)})"
        elif cls.is_accuse(action_id):
            return f"ACCUSE({cls.get_accuse_target(action_id)})"
        elif cls.is_defend(action_id):
            return "DEFEND_SELF"
        elif cls.is_question(action_id):
            return f"QUESTION({cls.get_question_target(action_id)})"
        else:
            return f"UNKNOWN_ACTION_{action_id}"
