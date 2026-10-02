"""Speech-to-text abstraction.

All providers consume 16 kHz mono PCM16 little-endian audio (what the browser AudioWorklet sends) and
emit TranscriptEvents. The live meeting WebSocket never knows which vendor is behind a session.

    STTProvider.create_session() → STTSession
        send_audio(bytes)   push audio as it arrives
        events()            async iterator of partial/final transcript events
        finish()            flush remaining audio; events() ends afterwards
"""

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass

SAMPLE_RATE = 16000
BYTES_PER_SECOND = SAMPLE_RATE * 2


@dataclass
class TranscriptEvent:
    kind: str  # partial | final | error
    text: str
    speaker: str = "Speaker"
    start_ms: int = 0
    end_ms: int = 0
    language: str | None = None


class STTSession(ABC):
    def __init__(self, language: str, participants: list[str]) -> None:
        self.language = language
        self.participants = participants
        self._queue: asyncio.Queue[TranscriptEvent | None] = asyncio.Queue()
        self.bytes_received = 0

    async def start(self) -> None:  # noqa: B027 - optional hook
        return None

    @abstractmethod
    async def send_audio(self, chunk: bytes) -> None: ...

    @abstractmethod
    async def finish(self) -> None: ...

    async def emit(self, event: TranscriptEvent | None) -> None:
        await self._queue.put(event)

    async def events(self) -> AsyncIterator[TranscriptEvent]:
        while True:
            ev = await self._queue.get()
            if ev is None:
                return
            yield ev

    def speaker_name(self, label: str | int | None) -> str:
        """Map diarization labels (0, 1, '1', 'S2'…) to participant names in order of appearance."""
        if label is None or label == "":
            return "Speaker"
        if not hasattr(self, "_speaker_map"):
            self._speaker_map: dict[str, str] = {}
        key = str(label)
        if key not in self._speaker_map:
            idx = len(self._speaker_map)
            self._speaker_map[key] = self.participants[idx] if idx < len(self.participants) else f"Speaker {idx + 1}"
        return self._speaker_map[key]


class STTProvider(ABC):
    name = "base"

    @abstractmethod
    def create_session(self, language: str, participants: list[str]) -> STTSession: ...
