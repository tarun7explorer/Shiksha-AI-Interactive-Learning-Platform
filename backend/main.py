"""
main.py

FastAPI application entrypoint for the ShikshaAI backend. Wires up
permissive local CORS for the Next.js dev server, exposes baseline
health/root routes, and orchestrates the primary /api/chat endpoint
across Hugging Face (ai_service), ElevenLabs (speech_service), and
Pexels (image_service) using asyncio.gather wherever the underlying
calls are independent of one another.

Concurrency note: the HF structured-output call and the Pexels image
lookup do not depend on each other's results (image search runs off
the raw question, not Tina's generated answer), so they are launched
together via asyncio.gather. Audio synthesis narrates Tina's generated
`ai_conversation_summary`, so it necessarily starts once the HF call
resolves — it is fired immediately after, without blocking on
anything else, keeping the overall critical path as short as possible.

Resilience note: ai_service.py already distinguishes connectivity
failures (which it degrades gracefully and honestly labels) from real
bugs (which it still raises as AIServiceError -> 502 here). This file
adds one more layer: a hard wall-clock timeout around the whole chat
pipeline so that if a dependency hangs instead of erroring outright
(e.g. a TCP connection that never resolves and never times out on its
own), the request still fails fast with a clean error instead of
hanging the connection forever.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

import asyncio
import base64
import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from ai_service import AIServiceError, generate_visual_panel
from image_service import ImageServiceError, get_image_service
from schemas import ChatRequest, ErrorResponse, HealthCheckResponse, VisualPanelResponse
from speech_service import SpeechServiceError, get_speech_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("shiksha_ai.main")

APP_VERSION = "1.0.1"

# Hard ceiling on the whole /api/chat pipeline (HF + Pexels + ElevenLabs).
# Keeps the request from hanging forever if a dependency stalls instead of
# erroring cleanly.
CHAT_PIPELINE_TIMEOUT_SECONDS = 45.0

app = FastAPI(
    title="ShikshaAI Backend",
    description=(
        "API surface for ShikshaAI's multilingual AI tutor — handles "
        "chat orchestration, structured knowledge-panel generation, "
        "speech synthesis, and image retrieval."
    ),
    version=APP_VERSION,
)

# --------------------------------------------------------------------- #
# CORS — permissive for local development against the Next.js dev server
# --------------------------------------------------------------------- #
LOCAL_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://0.0.0.0:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# --------------------------------------------------------------------- #
# Request timing + logging middleware
# --------------------------------------------------------------------- #
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "%s %s -> %s (%.2fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
    return response


# --------------------------------------------------------------------- #
# Global exception handlers
# --------------------------------------------------------------------- #
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(error="validation_error", detail=str(exc)).model_dump(),
    )


@app.exception_handler(AIServiceError)
async def ai_service_exception_handler(request: Request, exc: AIServiceError):
    logger.error("AI service error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content=ErrorResponse(
            error="ai_service_error",
            detail="Tina is having trouble generating a response right now.",
        ).model_dump(),
    )


@app.exception_handler(asyncio.TimeoutError)
async def timeout_exception_handler(request: Request, exc: asyncio.TimeoutError):
    logger.error("Request timed out on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        content=ErrorResponse(
            error="timeout",
            detail="The request took too long to complete. Please try again.",
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="internal_server_error",
            detail="An unexpected error occurred while processing the request.",
        ).model_dump(),
    )


# --------------------------------------------------------------------- #
# Response envelope for /api/chat
# --------------------------------------------------------------------- #
class ChatResponse(BaseModel):
    """
    Wraps the strict VisualPanelResponse contract together with the
    base64-encoded narration audio, so the frontend can render the
    panel and play Tina's voice from a single round trip.
    """

    model_config = ConfigDict(extra="forbid")

    panel: VisualPanelResponse
    audio_base64: str | None = None
    audio_format: str = "audio/mpeg"


# --------------------------------------------------------------------- #
# Baseline routes
# --------------------------------------------------------------------- #
@app.get("/", response_model=HealthCheckResponse, tags=["system"])
async def read_root() -> HealthCheckResponse:
    """Root route — quick confirmation the API is up and reachable."""
    return HealthCheckResponse(status="ok", service="shiksha-ai-backend", version=APP_VERSION)


@app.get("/health", response_model=HealthCheckResponse, tags=["system"])
async def health_check() -> HealthCheckResponse:
    """Liveness/readiness probe used by orchestration and uptime checks."""
    return HealthCheckResponse(status="ok", service="shiksha-ai-backend", version=APP_VERSION)


# --------------------------------------------------------------------- #
# Core chat route — concurrent LLM + image pipeline, then speech
# --------------------------------------------------------------------- #
@app.post(
    "/api/chat",
    response_model=ChatResponse,
    tags=["chat"],
    summary="Submit a question to Tina and receive a structured knowledge panel with narration audio.",
)
async def chat(payload: ChatRequest) -> ChatResponse:
    """
    Orchestrates the full ShikshaAI response pipeline:

    1. Launches the Hugging Face structured-output call and the Pexels
       image lookup concurrently via asyncio.gather, since neither
       depends on the other's result.
    2. Merges the resulting images into the validated VisualPanelResponse.
    3. Synthesizes narration audio from Tina's generated summary using
       ElevenLabs, in the language the user spoke or selected.
    4. Returns the combined panel + audio payload in a single response.

    Image and speech failures degrade gracefully (empty image list /
    null audio) rather than failing the whole request, since the panel
    text is the core deliverable. A genuine AI-service failure (not a
    transient connectivity hiccup — see ai_service.py) still surfaces
    as a 502 rather than being hidden, so real regressions stay visible.
    The whole pipeline is wall-clock bounded so a hung dependency can't
    hang the request indefinitely.
    """
    logger.info(
        "Received chat request | language=%s | query_len=%d",
        payload.voice_language.value,
        len(payload.query_text),
    )

    async def _run_pipeline() -> ChatResponse:
        image_service = get_image_service()

        ai_task = generate_visual_panel(payload.query_text, payload.voice_language)
        image_task = _safe_image_lookup(image_service, payload.query_text)

        panel, images = await asyncio.gather(ai_task, image_task)
        panel.images = images

        audio_base64 = await _safe_speech_synthesis(
            panel.ai_conversation_summary, payload.voice_language
        )

        return ChatResponse(panel=panel, audio_base64=audio_base64)

    return await asyncio.wait_for(_run_pipeline(), timeout=CHAT_PIPELINE_TIMEOUT_SECONDS)


async def _safe_image_lookup(image_service, query_text: str) -> list:
    """Wraps the Pexels lookup so an image-provider hiccup never fails the chat request."""
    try:
        return await image_service.search_images(query_text)
    except ImageServiceError as exc:
        logger.warning("Image lookup degraded gracefully: %s", exc)
        return []
    except Exception as exc:  # noqa: BLE001
        logger.warning("Image lookup failed unexpectedly, degrading gracefully: %s", exc)
        return []


async def _safe_speech_synthesis(text: str, voice_language) -> str | None:
    """Wraps ElevenLabs speech synthesis so a TTS outage never fails the chat request."""
    try:
        speech_service = get_speech_service()
        audio_bytes = await speech_service.synthesize_speech(text, voice_language)
        return base64.b64encode(audio_bytes).decode("utf-8")
    except SpeechServiceError as exc:
        logger.warning("Speech synthesis degraded gracefully: %s", exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Speech synthesis failed unexpectedly, degrading gracefully: %s", exc)
        return None