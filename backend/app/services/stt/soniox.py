"""Soniox real-time STT — used for Urdu and mixed Urdu/English (code-switching) meetings.

Protocol (WebSocket): send a JSON config first, then binary audio, then an empty frame to finish.
Responses carry `tokens` with `is_final`, `speaker`, `language`, timing; `{"finished": true}` ends the stream.
Docs: https://soniox.com/docs/stt/rt/real-time-transcription
"""

import asyncio
import contextlib
import json
from typing import Any

import websockets

from app.core.config import get_settings
from app.services.stt.base import STTProvider, STTSession, TranscriptEvent

URL = "wss://stt-rt.soniox.com/transcribe-websocket"


class SonioxSession(STTSession):
    def __init__(self, language: str, participants: list[str]) -> None:
        super().__init__(language, participants)
        self.ws: Any = None
        self._reader: asyncio.Task[None] | None = None
        self._final: list[dict[str, Any]] = []

    async def start(self) -> None:
        s = get_settings()
        if s.soniox_api_key is None:
            raise RuntimeError("STT provider soniox selected but SONIOX_API_KEY is not set")
        hints = ["ur", "en"] if self.language in ("ur", "auto") else [self.language]
        self.ws = await websockets.connect(s.soniox_url or URL, max_size=None)
        await self.ws.send(
            json.dumps(
                {
                    "api_key": s.soniox_api_key.get_secret_value(),
                    "model": s.soniox_model,
                    "audio_format": "pcm_s16le",
                    "sample_rate": 16000,
                    "num_channels": 1,
                    "language_hints": hints,
                    "enable_speaker_diarization": True,
                    "enable_language_identification": True,
                    "enable_endpoint_detection": True,
                }
            )
        )
        self._reader = asyncio.create_task(self._read())

    async def _flush_final(self) -> None:
        toks = [t for t in self._final if t.get("text") and t.get("text") != "<end>"]
        self._final = []
        if not toks:
            return
        # split on speaker change
        group: list[dict[str, Any]] = []
        for t in toks:
            if group and t.get("speaker") != group[-1].get("speaker"):
                await self._emit_group(group)
                group = []
            group.append(t)
        if group:
            await self._emit_group(group)

    async def _emit_group(self, group: list[dict[str, Any]]) -> None:
        text = "".join(t["text"] for t in group).strip()
        if text:
            await self.emit(
                TranscriptEvent(
                    "final",
                    text,
                    self.speaker_name(group[0].get("speaker")),
                    int(group[0].get("start_ms", 0)),
                    int(group[-1].get("end_ms", 0)),
                    group[0].get("language") or self.language,
                )
            )

    async def _read(self) -> None:
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if msg.get("error_code"):
                    await self.emit(TranscriptEvent("error", f"soniox: {msg.get('error_message')}"))
                    break
                tokens = msg.get("tokens") or []
                endpoint = False
                partial: list[str] = []
                for t in tokens:
                    if t.get("text") == "<end>":
                        endpoint = True
                        continue
                    if t.get("is_final"):
                        self._final.append(t)
                    else:
                        partial.append(t.get("text", ""))
                if endpoint:
                    await self._flush_final()
                if partial or self._final:
                    preview = "".join(t["text"] for t in self._final) + "".join(partial)
                    spk = (self._final[0] if self._final else (tokens[0] if tokens else {})).get("speaker")
                    if preview.strip():
                        await self.emit(TranscriptEvent("partial", preview.strip(), self.speaker_name(spk)))
                if msg.get("finished"):
                    break
        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            await self.emit(TranscriptEvent("error", f"soniox: {e}"))
        finally:
            await self._flush_final()
            await self.emit(None)

    async def send_audio(self, chunk: bytes) -> None:
        self.bytes_received += len(chunk)
        if self.ws is not None:
            await self.ws.send(chunk)

    async def finish(self) -> None:
        if self.ws is None:
            await self.emit(None)
            return
        with contextlib.suppress(Exception):
            await self.ws.send("")  # empty frame = end of audio
        if self._reader:
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(asyncio.shield(self._reader), timeout=15)
        with contextlib.suppress(Exception):
            await self.ws.close()


class SonioxSTT(STTProvider):
    name = "soniox"

    def create_session(self, language: str, participants: list[str]) -> STTSession:
        return SonioxSession(language, participants)
