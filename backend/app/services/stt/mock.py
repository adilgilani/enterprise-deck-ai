"""Development STT: replays a realistic scripted conversation, paced by the audio actually received,
so the full live pipeline (WebSocket → segments → live insights → processing) is exercised without
an STT key or model download."""

from app.services.stt.base import BYTES_PER_SECOND, STTProvider, STTSession, TranscriptEvent

SCRIPT_EN = [
    (0, "We should focus the next quarter on enterprise customers."),
    (1, "I agree, but we need to reduce implementation time."),
    (2, "Right now onboarding averages 41 days. The target should be under 21 days."),
    (0, "Let's make that a decision: 21-day onboarding by end of Q4."),
    (3, "We'll need two more solutions engineers to hit that. Budget is roughly $380K."),
    (1, "Can finance confirm the hiring budget by next Friday?"),
    (4, "Pipeline for banking is up 34%. ABC Bank alone is a $2.4M opportunity."),
    (2, "One risk: the EU data region won't be ready before January."),
    (0, "Then we position private AI mode for European banks in the meantime. We agreed on that."),
    (3, "I'll own the enablement deck for the sales team by October 14."),
    (4, "I'll finalize the ABC Bank proposal by Tuesday."),
    (1, "Let's review progress in two weeks with the full leadership team."),
]
SCRIPT_UR = [
    (0, "ہمیں اگلی سہ ماہی میں انٹرپرائز کسٹمرز پر توجہ دینی چاہیے۔"),
    (1, "میں متفق ہوں، لیکن ہمیں عمل درآمد کا وقت کم کرنا ہوگا۔"),
    (2, "اس وقت آن بورڈنگ میں اوسطاً 41 دن لگتے ہیں۔ ہدف 21 دن سے کم ہونا چاہیے۔"),
    (0, "ٹھیک ہے، یہ فیصلہ ہے: سہ ماہی کے آخر تک 21 دن کی آن بورڈنگ۔"),
    (3, "اس کے لیے ہمیں دو مزید سلوشن انجینئرز کی ضرورت ہوگی۔ بجٹ تقریباً 380 ہزار ڈالر ہے۔"),
    (1, "کیا فنانس اگلے جمعہ تک بجٹ کی تصدیق کر سکتا ہے؟"),
    (2, "ایک خطرہ یہ ہے کہ یورپی ڈیٹا ریجن جنوری سے پہلے تیار نہیں ہوگا۔"),
    (3, "سیلز ٹیم کے لیے اینیبلمنٹ ڈیک میں بناؤں گی۔"),
]
SCRIPT_UR_ROMAN = [
    (0, "Hamein agli quarter mein enterprise customers par focus karna chahiye."),
    (1, "Main agree karti hoon, lekin hamein implementation time kam karna hoga."),
    (2, "Is waqt onboarding mein average 41 din lagte hain. Target 21 din se kam hona chahiye."),
    (0, "Theek hai, yeh decision hai: quarter ke end tak 21 din ki onboarding."),
    (3, "Is ke liye hamein do mazeed solution engineers chahiye honge. Budget taqreeban 380K dollars hai."),
    (1, "Kya finance agle Friday tak budget confirm kar sakta hai?"),
    (2, "Ek risk yeh hai ke EU data region January se pehle ready nahi hoga."),
    (3, "Sales team ke liye enablement deck main bana doon gi, October 14 tak."),
]
DEFAULT_NAMES = ["Ahmed Raza", "Sara Malik", "Omar Shah", "Priya Nair", "Lena Ortiz"]
SECONDS_PER_LINE = 3.2


class MockSession(STTSession):
    def __init__(self, language: str, participants: list[str]) -> None:
        super().__init__(language, participants)
        self.script = SCRIPT_UR_ROMAN if language == "ur-Latn" else SCRIPT_UR if language == "ur" else SCRIPT_EN
        self.names = participants or DEFAULT_NAMES
        self.index = 0
        self.partial_sent = False

    async def send_audio(self, chunk: bytes) -> None:
        self.bytes_received += len(chunk)
        if self.index >= len(self.script):
            return
        line_start = self.index * SECONDS_PER_LINE
        elapsed = self.bytes_received / BYTES_PER_SECOND
        who, text = self.script[self.index]
        speaker = self.names[who % len(self.names)]
        if not self.partial_sent and elapsed >= line_start + SECONDS_PER_LINE * 0.5:
            words = text.split()
            await self.emit(TranscriptEvent("partial", " ".join(words[: max(2, len(words) // 2)]) + "…", speaker))
            self.partial_sent = True
        if elapsed >= line_start + SECONDS_PER_LINE:
            await self.emit(
                TranscriptEvent(
                    "final", text, speaker, int(line_start * 1000), int((line_start + SECONDS_PER_LINE) * 1000), self.language
                )
            )
            self.index += 1
            self.partial_sent = False

    async def finish(self) -> None:
        await self.emit(None)


class MockSTT(STTProvider):
    name = "mock"

    def create_session(self, language: str, participants: list[str]) -> STTSession:
        return MockSession(language, participants)
