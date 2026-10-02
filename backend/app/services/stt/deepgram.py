"""Deepgram streaming STT (English) with speaker diarization and interim results.

The backend proxies audio to Deepgram so the API key never reaches the browser.
Docs: https://developers.deepgram.com/docs/live-streaming-audio
"""

import asyncio
import contextlib
import json
from typing import Any
from urllib.parse import urlencode

import websockets

from app.core.config import get_settings
from app.services.stt.base import STTProvider, STTSession, TranscriptEvent

URL = "wss://api.deepgram.com/v1/listen"


class DeepgramSession(STTSession):
    def __init__(self, language: str, participants: list[str]) -> None:
        super().__init__(language, participants)
        self.ws: Any = None
        self._reader: asyncio.Task[None] | None = None
        self._keepalive: asyncio.Task[None] | None = None

    async def start(self) -> None:
        s = get_settings()
        if s.deepgram_api_key is None:
            raise RuntimeError("STT_PROVIDER_EN=deepgram but DEEPGRAM_API_KEY is not set")
        params = {
            "model": s.deepgram_model,
            "language": "en" if self.language in ("en", "auto") else self.language,
            "encoding": "linear16",
            "sample_rate": 16000,
            "channels": 1,
            "diarize": "true",
            "punctuate": "true",
            "smart_format": "true",
            "interim_results": "true",
            "endpointing": 400,
        }
        self.ws = await websockets.connect(
            f"{URL}?{urlencode(params)}",
            additional_headers={"Authorization": f"Token {s.deepgram_api_key.get_secret_value()}"},
            max_size=None,
        )
        self._reader = asyncio.create_task(self._read())
        self._keepalive = asyncio.create_task(self._keep_alive())

    async def _keep_alive(self) -> None:
        with contextlib.suppress(Exception):
            while True:
                await asyncio.sleep(8)
                await self.ws.send(json.dumps({"type": "KeepAlive"}))

    async def _read(self) -> None:
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if msg.get("type") != "Results":
                    continue
                alt = (msg.get("channel", {}).get("alternatives") or [{}])[0]
                text = (alt.get("transcript") or "").strip()
                if not text:
                    continue
                words = alt.get("words") or []
                speaker = self.speaker_name(words[0].get("speaker")) if words else "Speaker"
                start = int(float(msg.get("start", 0)) * 1000)
                end = start + int(float(msg.get("duration", 0)) * 1000)
                if msg.get("is_final"):
                    # split on speaker changes inside a final result
                    for spk, chunk, s_ms, e_ms in _by_speaker(words, self) or [(speaker, text, start, end)]:
                        await self.emit(TranscriptEvent("final", chunk, spk, s_ms, e_ms, "en"))
                else:
                    await self.emit(TranscriptEvent("partial", text, speaker, start, end, "en"))
        except websockets.ConnectionClosed:
            pass
        except Exception as e:  # surface provider errors to the client
            await self.emit(TranscriptEvent("error", f"deepgram: {e}"))
        finally:
            await self.emit(None)

    async def send_audio(self, chunk: bytes) -> None:
        self.bytes_received += len(chunk)
        if self.ws is not None:
            await self.ws.send(chunk)

    async def finish(self) -> None:
        if self._keepalive:
            self._keepalive.cancel()
        if self.ws is not None:
            with contextlib.suppress(Exception):
                await self.ws.send(json.dumps({"type": "CloseStream"}))
            if self._reader:
                with contextlib.suppress(asyncio.TimeoutError):
                    await asyncio.wait_for(asyncio.shield(self._reader), timeout=10)
            with contextlib.suppress(Exception):
                await self.ws.close()
        else:
            await self.emit(None)


def _by_speaker(words: list[dict[str, Any]], session: STTSession) -> list[tuple[str, str, int, int]]:
    out: list[tuple[str, str, int, int]] = []
    cur: list[dict[str, Any]] = []
    for w in words:
        if cur and w.get("speaker") != cur[-1].get("speaker"):
            out.append(_flush(cur, session))
            cur = []
        cur.append(w)
    if cur:
        out.append(_flush(cur, session))
    return out


def _flush(ws: list[dict[str, Any]], session: STTSession) -> tuple[str, str, int, int]:
    text = " ".join(w.get("punctuated_word") or w.get("word", "") for w in ws)
    return session.speaker_name(ws[0].get("speaker")), text, int(ws[0]["start"] * 1000), int(ws[-1]["end"] * 1000)


class DeepgramSTT(STTProvider):
    name = "deepgram"

    def create_session(self, language: str, participants: list[str]) -> STTSession:
        return DeepgramSession(language, participants)
