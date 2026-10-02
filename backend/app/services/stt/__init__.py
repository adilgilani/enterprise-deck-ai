"""STT provider routing by meeting language.

    en   → STT_PROVIDER_EN  (mock | whisper | deepgram)
    ur / ur-Latn → STT_PROVIDER_UR  (mock | soniox | whisper); ur-Latn is transliterated to Roman Urdu
    auto → Urdu provider (Soniox handles Urdu/English code-switching)
"""

from app.core.config import get_settings
from app.services.stt.base import STTProvider, STTSession, TranscriptEvent


def get_stt_provider(language: str) -> STTProvider:
    s = get_settings()
    name = s.stt_provider_en if language == "en" else s.stt_provider_ur
    if name == "deepgram":
        from app.services.stt.deepgram import DeepgramSTT

        return DeepgramSTT()
    if name == "soniox":
        from app.services.stt.soniox import SonioxSTT

        return SonioxSTT()
    if name == "whisper":
        from app.services.stt.whisper import WhisperSTT

        return WhisperSTT()
    from app.services.stt.mock import MockSTT

    return MockSTT()


__all__ = ["STTProvider", "STTSession", "TranscriptEvent", "get_stt_provider"]
