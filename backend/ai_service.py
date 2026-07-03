"""
ai_service.py

Inference layer using Hugging Face Inference Providers via
huggingface_hub.InferenceClient.

--------------------------------------------------------------------
ROOT CAUSE OF THE `socket.gaierror: [Errno 11001] getaddrinfo failed`
--------------------------------------------------------------------
This is NOT a Windows-only quirk. Hugging Face decommissioned the old
serverless endpoint `api-inference.huggingface.co` in favor of the new
routing layer at `router.huggingface.co`. Any client (old pinned
`huggingface_hub` versions, raw `requests`/`aiohttp` calls, curl, etc.)
that still targets the old hostname will fail DNS resolution for
*everyone*, on any OS — that's exactly the class of error you're
seeing. Pexels works because it's an unrelated host.

The fix has two independent parts, both implemented below:

  1. Stop calling the dead hostname. `InferenceClient(provider="auto")`
     (huggingface_hub >= 0.27) talks to `router.huggingface.co` and lets
     HF pick whichever live provider currently serves the requested
     model. Bump `huggingface-hub` in requirements.txt to `>=0.28,<1.0`
     — 0.25.2 predates this routing behaviour being the default.

  2. Run the call via the *synchronous* `InferenceClient` inside
     `loop.run_in_executor`, not `AsyncInferenceClient`. The sync client
     uses `requests` (not `aiohttp`), which sidesteps aiohttp's own
     connector/resolver quirks on Windows entirely — this was the
     secondary ask and is cheap insurance on top of fix #1.

--------------------------------------------------------------------
On the "just return mock data on any error" ask
--------------------------------------------------------------------
Silently returning fabricated content on ANY exception is dangerous —
it would also swallow real bugs (bad JSON from the model, a wrong
model id, an expired token) and make them invisible during grading,
which is the opposite of what you want for "high-stakes evaluations."

So this file draws a line:
  - Connectivity-class failures (DNS, connection refused, timeout) are
    transient and environmental → degrade gracefully, but the
    fallback content is honestly labeled as a connectivity fallback
    inside the JSON itself, never dressed up as a real answer.
  - Everything else (malformed model output, auth errors, schema
    violations) is a real bug → it still raises AIServiceError, which
    main.py turns into a clean 502. You want to see those, not hide
    them.

If you'd rather NEVER fall back silently (recommended for a graded
submission, so a real outage is visibly obvious rather than papered
over), set `HF_FALLBACK_ON_NETWORK_ERROR=false` in backend/.env.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import socket

from huggingface_hub import InferenceClient
from huggingface_hub import __version__ as HFHUB_VERSION
from huggingface_hub.errors import HfHubHTTPError

from prompts import TINA_SYSTEM_PROMPT, build_user_turn_prompt
from schemas import VisualPanelResponse, VoiceLanguage

logger = logging.getLogger("shiksha_ai.ai_service")


def _assert_hfhub_version_supports_providers() -> None:
    """
    Fails fast and loudly on import if the installed huggingface_hub is
    too old to support `provider=` (i.e. it's still wired to the dead
    api-inference.huggingface.co endpoint). Without this check, an
    outdated environment (stale venv, uncached Docker layer, etc.)
    surfaces as a confusing `TypeError: unexpected keyword argument
    'provider'` deep inside a request traceback instead of a clear
    startup error.
    """
    try:
        major, minor = (int(x) for x in HFHUB_VERSION.split(".")[:2])
    except (ValueError, AttributeError):
        return  # unknown/dev version string - don't block startup on it
    if (major, minor) < (0, 28):
        raise RuntimeError(
            f"huggingface_hub {HFHUB_VERSION} is installed, but >=0.28.0 is "
            "required for Inference Providers routing (provider=). The old "
            "api-inference.huggingface.co endpoint this library used to "
            "target has been decommissioned. Fix: run "
            "pip install --upgrade \"huggingface_hub>=0.28.0,<1.0.0\" "
            "--force-reinstall in THIS environment (venv/Docker image) and "
            "restart. Editing requirements.txt alone does not upgrade an "
            "already-installed package."
        )


_assert_hfhub_version_supports_providers()

# Model to request. "auto" provider selection means HF's router will pick
# whichever live Inference Provider currently hosts this model. If this
# specific model isn't served by any provider right now, check
# https://huggingface.co/settings/inference-providers or the model's own
# page for which providers list it, and override via HF_MODEL_NAME.
DEFAULT_HF_MODEL = "Qwen/Qwen2.5-72B-Instruct"

# "auto" = HF picks the fastest live provider for the model (recommended).
# Set HF_PROVIDER to a specific provider name (e.g. "novita", "together",
# "nebius", "fireworks-ai") if you want to pin one instead.
DEFAULT_HF_PROVIDER = "auto"

_REQUEST_TIMEOUT_SECONDS = 30.0

# Errors in this tuple are treated as *connectivity* failures eligible for
# graceful (clearly labeled) degradation rather than a hard 502.
_CONNECTIVITY_ERRORS = (
    socket.gaierror,
    ConnectionError,
    TimeoutError,
    OSError,
)

_client: InferenceClient | None = None


def _get_client() -> InferenceClient:
    """
    Builds (and caches) a synchronous InferenceClient pointed at HF's
    current Inference Providers router. Synchronous on purpose — see
    module docstring point #2.
    """
    global _client
    if _client is None:
        token = os.getenv("HF_TOKEN")
        if not token:
            raise RuntimeError(
                "HF_TOKEN is not set. Add your Hugging Face token to backend/.env. "
                "Get one free at https://huggingface.co/settings/tokens"
            )
        provider = os.getenv("HF_PROVIDER", DEFAULT_HF_PROVIDER)
        _client = InferenceClient(
            provider=provider,
            api_key=token,
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
    return _client


class AIServiceError(Exception):
    """Raised when the HF model fails to produce a schema-valid response
    for reasons that are NOT a transient connectivity failure — i.e. a
    real bug that should surface, not be papered over."""


def _extract_json_object(raw: str) -> dict:
    """
    Robustly extracts the first complete JSON object from model output.
    Handles cases where the model emits:
      - a bare JSON object (ideal)
      - ```json ... ``` fences
      - leading prose before the opening brace
    Raises AIServiceError if no valid JSON object is found.
    """
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    else:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIServiceError(
                f"Model output contained no JSON object. Raw output (first 400 chars): "
                f"{raw[:400]!r}"
            )
        candidate = raw[start : end + 1]

    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise AIServiceError(
            f"JSON parse failed after extraction: {exc}. "
            f"Candidate (first 400 chars): {candidate[:400]!r}"
        ) from exc


def _call_hf_sync(query_text: str, voice_language: VoiceLanguage) -> str:
    """
    Blocking HF call — executed off the event loop via run_in_executor.
    Kept as a plain sync function so it can run on a worker thread with
    a plain `requests`-based transport (no event-loop/aiohttp coupling).
    """
    client = _get_client()
    user_prompt = build_user_turn_prompt(query_text, voice_language)
    model = os.getenv("HF_MODEL_NAME", DEFAULT_HF_MODEL)

    messages = [
        {"role": "system", "content": TINA_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    completion = client.chat_completion(
        messages=messages,
        model=model,
        max_tokens=2048,
        temperature=0.6,
        top_p=0.9,
    )
    return completion.choices[0].message.content or ""


def _build_connectivity_fallback(query_text: str) -> VisualPanelResponse:
    """
    Honest, clearly-labeled degraded response used ONLY when the HF
    router itself is unreachable (DNS/connection/timeout) — never used
    to mask a real bug. The content plainly says it's a fallback so a
    grader or teammate never mistakes it for a genuine AI explanation.
    """
    return VisualPanelResponse(
        question=query_text,
        ai_conversation_summary=(
            "I couldn't reach the AI service just now, so this is a placeholder "
            "response rather than a real explanation. Please check your internet "
            "connection or Hugging Face Inference Providers status and try again."
        ),
        key_points=[
            "This is a connectivity fallback, not a generated answer.",
            "The backend could not reach Hugging Face's Inference Providers router.",
            "Retry once your network connection is restored.",
        ],
        examples=[],
        interesting_facts=[],
        comparison_table=None,
        images=[],
    )


async def generate_visual_panel(
    query_text: str,
    voice_language: VoiceLanguage,
) -> VisualPanelResponse:
    """
    Calls HF's Inference Providers router (via a sync client on a worker
    thread) with Tina's system persona + the user question, extracts and
    validates the JSON response, and returns a VisualPanelResponse.
    The `images` field is left empty — populated by image_service.py and
    merged in by /api/chat.
    """
    loop = asyncio.get_event_loop()
    allow_fallback = os.getenv("HF_FALLBACK_ON_NETWORK_ERROR", "true").lower() != "false"

    try:
        raw_text = await asyncio.wait_for(
            loop.run_in_executor(None, _call_hf_sync, query_text, voice_language),
            timeout=_REQUEST_TIMEOUT_SECONDS + 5,
        )
    except _CONNECTIVITY_ERRORS as exc:
        logger.error(
            "HF Inference Providers router unreachable (connectivity error): %s", exc
        )
        if allow_fallback:
            return _build_connectivity_fallback(query_text)
        raise AIServiceError(
            f"Could not reach Hugging Face's Inference Providers router: {exc}. "
            "If you're still targeting api-inference.huggingface.co, that host has "
            "been decommissioned — upgrade huggingface_hub and use "
            "InferenceClient(provider='auto')."
        ) from exc
    except asyncio.TimeoutError as exc:
        logger.error("HF Inference request timed out after %ss", _REQUEST_TIMEOUT_SECONDS)
        if allow_fallback:
            return _build_connectivity_fallback(query_text)
        raise AIServiceError(f"HF Inference request timed out: {exc}") from exc
    except HfHubHTTPError as exc:
        # Real API-level error (auth, model not served by any provider, rate
        # limit, etc). This is a bug to fix, not something to paper over.
        logger.exception("HF Inference API returned an error for query: %s", query_text)
        raise AIServiceError(f"HF Inference API error: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 - last-resort, still re-raised
        logger.exception("Unexpected error calling HF Inference for query: %s", query_text)
        raise AIServiceError(f"HF Inference request failed unexpectedly: {exc}") from exc

    if not raw_text.strip():
        raise AIServiceError("HF model returned an empty response.")

    payload = _extract_json_object(raw_text)

    # The model must never populate `images` — strip defensively
    payload.pop("images", None)

    try:
        return VisualPanelResponse(
            question=payload.get("question", query_text),
            ai_conversation_summary=payload["ai_conversation_summary"],
            key_points=payload.get("key_points", []),
            examples=payload.get("examples", []),
            interesting_facts=payload.get("interesting_facts", []),
            comparison_table=payload.get("comparison_table"),
            images=[],
        )
    except (KeyError, TypeError) as exc:
        logger.error(
            "Schema mapping failed. Payload keys: %s. Error: %s",
            list(payload.keys()),
            exc,
        )
        raise AIServiceError(
            f"Model output is missing required field: {exc}"
        ) from exc