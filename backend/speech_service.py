"""
speech_service.py

Async wrapper around the ElevenLabs Text-to-Speech REST API.
Maps each supported ShikshaAI language to a realistic, expressive
ElevenLabs voice and returns raw MP3 audio bytes ready to be
base64-encoded and sent to the frontend.

Free tier: 10,000 characters / month — sufficient for prototyping.
Upgrade at https://elevenlabs.io/pricing for production volume.
"""

from __future__ import annotations

import logging
import os

import httpx

from schemas import VoiceLanguage

logger = logging.getLogger("shiksha_ai.speech_service")

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
_REQUEST_TIMEOUT_SECONDS = 25.0


# --------------------------------------------------------------------- #
# Voice mapping
# ElevenLabs does not have region-locked voices the way Azure does.
# We pick expressive multilingual voices that sound natural when
# speaking English, Hindi, and Telugu content.
#
# "Rachel"  (voice_id: 21m00Tcm4TlvDq8ikWAM) — calm, clear, warm
#            Best for English explanations.
# "Aria"    (voice_id: 9BWtsMINqrJLrRacOk9x) — expressive, youthful
#            Best for Hindi-input responses (still speaks English output).
# "Sarah"   (voice_id: EXAVITQu4vr4xnSDxMaL) — soft, articulate
#            Best for Telugu-input responses (still speaks English output).
#
# All voices speak the English output text — the language mapping
# only adjusts the voice character / warmth to suit the cultural
# context of the user's input locale.
# --------------------------------------------------------------------- #
VOICE_MAP: dict[VoiceLanguage, dict] = {
    VoiceLanguage.ENGLISH: {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",  # Rachel
        "name": "Rachel",
        "stability": 0.55,
        "similarity_boost": 0.80,
        "style": 0.20,
        "use_speaker_boost": True,
    },
    VoiceLanguage.HINDI: {
        "voice_id": "9BWtsMINqrJLrRacOk9x",  # Aria
        "name": "Aria",
        "stability": 0.50,
        "similarity_boost": 0.78,
        "style": 0.25,
        "use_speaker_boost": True,
    },
    VoiceLanguage.TELUGU: {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",  # Sarah
        "name": "Sarah",
        "stability": 0.52,
        "similarity_boost": 0.75,
        "style": 0.22,
        "use_speaker_boost": True,
    },
}

MODEL_ID = "eleven_multilingual_v2"   # Best quality on the free tier


class SpeechServiceError(Exception):
    """Raised when the ElevenLabs API request fails."""


class ElevenLabsSpeechService:
    """
    Thin async client over the ElevenLabs v1 TTS endpoint.
    Returns raw MP3 bytes on success; raises SpeechServiceError
    on any API or network failure so the caller can degrade gracefully.
    """

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.getenv("ELEVENLABS_API_KEY")

    def _require_credentials(self) -> None:
        if not self._api_key:
            raise SpeechServiceError(
                "ELEVENLABS_API_KEY is not set. "
                "Add it to backend/.env — get a free key at https://elevenlabs.io"
            )

    async def synthesize_speech(
        self,
        text: str,
        voice_language: VoiceLanguage,
    ) -> bytes:
        """
        Synthesizes `text` into MP3 audio bytes using the ElevenLabs
        voice mapped to `voice_language`.

        Returns raw MP3 bytes ready to be base64-encoded and embedded
        in the ChatResponse JSON sent to the frontend.
        """
        self._require_credentials()

        if not text or not text.strip():
            raise SpeechServiceError("Cannot synthesize empty text.")

        voice = VOICE_MAP.get(voice_language, VOICE_MAP[VoiceLanguage.ENGLISH])
        url = ELEVENLABS_TTS_URL.format(voice_id=voice["voice_id"])

        payload = {
            "text": text.strip(),
            "model_id": MODEL_ID,
            "voice_settings": {
                "stability": voice["stability"],
                "similarity_boost": voice["similarity_boost"],
                "style": voice["style"],
                "use_speaker_boost": voice["use_speaker_boost"],
            },
        }

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            error_body = ""
            try:
                error_body = exc.response.json().get("detail", {}).get("message", "")
            except Exception:
                error_body = exc.response.text[:200]
            logger.error(
                "ElevenLabs TTS failed (%s) for voice %s: %s",
                exc.response.status_code,
                voice["name"],
                error_body,
            )
            raise SpeechServiceError(
                f"ElevenLabs synthesis failed ({exc.response.status_code}): {error_body}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("ElevenLabs request error: %s", exc)
            raise SpeechServiceError(f"ElevenLabs request failed: {exc}") from exc

        return response.content


# --------------------------------------------------------------------- #
# Singleton accessor
# --------------------------------------------------------------------- #
_speech_service_singleton: ElevenLabsSpeechService | None = None


def get_speech_service() -> ElevenLabsSpeechService:
    """Returns a process-wide singleton ElevenLabsSpeechService instance."""
    global _speech_service_singleton
    if _speech_service_singleton is None:
        _speech_service_singleton = ElevenLabsSpeechService()
    return _speech_service_singleton