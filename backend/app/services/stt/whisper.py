"""Local open-source STT with faster-whisper (CTranslate2 Whisper).

Streaming strategy: buffer audio and cut an utterance at a pause (simple energy VAD) or after
MAX_WINDOW seconds, then transcribe that window in a worker thread. Whisper has no diarization,
so segments are attributed to "Speaker". Install with: pip install '.[whisper]'
"""

import asyncio
import math
import struct
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.stt.base import BYTES_PER_SECOND, STTProvider, STTSession, TranscriptEvent

log = get_logger(__name__)

MIN_WINDOW = 2.0
MAX_WINDOW = 12.0
SILENCE_RMS = 350  # int16 RMS below which a 300 ms frame counts as silence
FRAME = int(BYTES_PER_SECOND * 0.3)

_model: Any = None
_model_lock = asyncio.Lock()


async def _get_model() -> Any:
    global _model
    async with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            s = get_settings()
            log.info("loading faster-whisper model", extra={"data": {"model": s.whisper_model}})
            _model = await asyncio.to_thread(
                WhisperModel, s.whisper_model, device=s.whisper_device, compute_type=s.whisper_compute_type
            )
    return _model


def _rms(frame: bytes) -> float:
    n = len(frame) // 2
    if n == 0:
        return 0.0
    samples = struct.unpack(f"<{n}h", frame[: n * 2])
    return math.sqrt(sum(x * x for x in samples) / n)


class WhisperSession(STTSession):
    def __init__(self, language: str, participants: list[str]) -> None:
        super().__init__(language, participants)
        self.buffer = bytearray()
        self.offset_ms = 0
        self.silent_frames = 0
        self._tasks: list[asyncio.Task[None]] = []
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        await _get_model()

    async def send_audio(self, chunk: bytes) -> None:
        self.bytes_received += len(chunk)
        self.buffer.extend(chunk)
        if len(chunk) >= 320:
            self.silent_frames = self.silent_frames + 1 if _rms(chunk[-FRAME:]) < SILENCE_RMS else 0
        seconds = len(self.buffer) / BYTES_PER_SECOND
        if (seconds >= MIN_WINDOW and self.silent_frames >= 2) or seconds >= MAX_WINDOW:
            self._cut()

    def _cut(self) -> None:
        if not self.buffer:
            return
        audio = bytes(self.buffer)
        start = self.offset_ms
        self.offset_ms += int(len(audio) / BYTES_PER_SECOND * 1000)
        self.buffer.clear()
        self.silent_frames = 0
        self._tasks.append(asyncio.create_task(self._transcribe(audio, start)))

    async def _transcribe(self, audio: bytes, start_ms: int) -> None:
        import numpy as np

        model = await _get_model()
        pcm = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
        lang = None if self.language == "auto" else self.language

        def run() -> list[Any]:
            segments, _info = model.transcribe(pcm, language=lang, vad_filter=True, beam_size=1)
            return list(segments)

        async with self._lock:  # keep output ordered
            try:
                segs = await asyncio.to_thread(run)
            except Exception as e:
                await self.emit(TranscriptEvent("error", f"whisper failed: {e}"))
                return
            text = " ".join(s.text.strip() for s in segs).strip()
            if text:
                end = start_ms + int(len(audio) / BYTES_PER_SECOND * 1000)
                await self.emit(TranscriptEvent("final", text, "Speaker", start_ms, end, lang))

    async def finish(self) -> None:
        self._cut()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        await self.emit(None)


class WhisperSTT(STTProvider):
    name = "whisper"

    def create_session(self, language: str, participants: list[str]) -> STTSession:
        return WhisperSession(language, participants)
