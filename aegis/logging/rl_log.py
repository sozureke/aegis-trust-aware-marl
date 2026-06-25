from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Optional, TextIO

import numpy as np


def numpy_to_json(obj: Any) -> Any:
    if isinstance(obj, (np.integer, np.floating)):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: numpy_to_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [numpy_to_json(x) for x in obj]
    return obj


def flatten_obs_hash(obs_flat: np.ndarray) -> str:
    b = np.asarray(obs_flat, dtype=np.float32).tobytes()
    return hashlib.sha256(b).hexdigest()[:16]


class RlJsonlWriter:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file: Optional[TextIO] = None
        self._lines = 0

    def _ensure_open(self) -> TextIO:
        if self._file is None:
            self._file = open(self.path, "a")
        return self._file

    def write_record(self, record: dict) -> None:
        f = self._ensure_open()
        f.write(json.dumps(numpy_to_json(record)) + "\n")
        self._lines += 1

    def flush(self) -> None:
        if self._file:
            self._file.flush()

    def close(self) -> None:
        if self._file:
            self._file.close()
            self._file = None

    def __enter__(self) -> RlJsonlWriter:
        return self

    def __exit__(self, *args) -> None:
        self.close()
