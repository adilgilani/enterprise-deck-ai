"""Deterministic repair of almost-JSON produced by LLMs (code fences, prose wrappers, trailing commas,
truncated output). Runs before falling back to an LLM-driven repair pass."""

import json
import re
from typing import Any

_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_TRAILING_COMMA = re.compile(r",\s*([}\]])")
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def extract_json_text(text: str) -> str:
    text = _THINK.sub("", text).strip()
    m = _FENCE.search(text)
    if m:
        text = m.group(1).strip()
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    if start > 0:
        text = text[start:]
    return text


def _close_truncated(text: str) -> str:
    """Close unterminated strings/brackets in a truncated JSON document."""
    stack: list[str] = []
    in_str = False
    esc = False
    last_safe = 0
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if stack:
                stack.pop()
            if not stack:
                last_safe = i + 1
    if not stack and not in_str:
        return text[: last_safe or len(text)]
    out = text
    if in_str:
        out += '"'
    out = re.sub(r",\s*$", "", out.rstrip())
    out = re.sub(r":\s*$", ": null", out)
    return out + "".join(reversed(stack))


def parse_lenient(text: str) -> Any:
    """Best-effort parse. Raises json.JSONDecodeError if nothing works."""
    candidate = extract_json_text(text)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    fixed = _TRAILING_COMMA.sub(r"\1", candidate)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    return json.loads(_TRAILING_COMMA.sub(r"\1", _close_truncated(fixed)))
