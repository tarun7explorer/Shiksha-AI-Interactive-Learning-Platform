"""
schemas.py

Strict Pydantic v2 data contracts shared across ShikshaAI's FastAPI
backend. Every request entering the API and every response leaving
ai_service.py is validated against these models — no untyped dicts
are allowed to cross the API boundary.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --------------------------------------------------------------------- #
# Shared enums
# --------------------------------------------------------------------- #
class VoiceLanguage(str, Enum):
    """BCP-47-style locale codes supported by Tina's voice pipeline."""

    ENGLISH = "en-IN"
    HINDI = "hi-IN"
    TELUGU = "te-IN"


# --------------------------------------------------------------------- #
# Request models
# --------------------------------------------------------------------- #
class ChatRequest(BaseModel):
    """
    Incoming payload from the frontend's ChatBox / VoiceInput flow.
    `query_text` is the transcribed or typed question; `voice_language`
    indicates which locale the user spoke or selected in the UI.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query_text: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="The user's question, either typed or transcribed from speech.",
    )
    voice_language: VoiceLanguage = Field(
        default=VoiceLanguage.ENGLISH,
        description="Locale of the user's spoken or selected input language.",
    )
    session_id: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Optional client-generated session identifier for conversation continuity.",
    )

    @field_validator("query_text")
    @classmethod
    def query_must_not_be_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("query_text cannot be empty or whitespace-only.")
        return value


# --------------------------------------------------------------------- #
# Response sub-models
# --------------------------------------------------------------------- #
class RelatedImage(BaseModel):
    """A single Pexels-sourced image rendered in the Visual Knowledge Panel."""

    model_config = ConfigDict(extra="forbid")

    url: str = Field(..., description="Direct, hot-linkable image URL.")
    alt_text: str = Field(
        ..., min_length=1, max_length=200, description="Accessible description of the image."
    )
    photographer: Optional[str] = Field(
        default=None, max_length=120, description="Photographer credit, if available."
    )
    source_url: Optional[str] = Field(
        default=None, description="Link back to the original Pexels page."
    )


class ComparisonTable(BaseModel):
    """A strictly-typed comparison matrix (e.g. CPU vs GPU)."""

    model_config = ConfigDict(extra="forbid")

    headers: list[str] = Field(
        ..., min_length=2, description="Column headers; first column is typically the attribute name."
    )
    rows: list[list[str]] = Field(
        ..., min_length=1, description="Row data; each row's length must match `headers`."
    )

    @field_validator("rows")
    @classmethod
    def rows_must_match_header_width(
        cls, rows: list[list[str]], info
    ) -> list[list[str]]:
        headers = info.data.get("headers")
        if headers:
            expected_width = len(headers)
            for index, row in enumerate(rows):
                if len(row) != expected_width:
                    raise ValueError(
                        f"Row {index} has {len(row)} cells; expected {expected_width} "
                        f"to match the {expected_width} headers."
                    )
        return rows


# --------------------------------------------------------------------- #
# Primary response model
# --------------------------------------------------------------------- #
class VisualPanelResponse(BaseModel):
    """
    The fully structured, English-only payload rendered by
    VisualPanel.jsx on the frontend. This is the strict contract that
    ai_service.py must populate after calling the Gemini API.
    """

    model_config = ConfigDict(extra="forbid")

    question: str = Field(
        ..., min_length=1, max_length=1000, description="The original user question, normalized to English."
    )
    ai_conversation_summary: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Tina's spoken-style summary, used to drive avatar speech and the panel headline.",
    )
    key_points: list[str] = Field(
        ...,
        min_length=1,
        max_length=12,
        description="Concise, ordered bullet points breaking down the concept.",
    )
    images: list[RelatedImage] = Field(
        default_factory=list,
        max_length=9,
        description="Related visuals sourced from the Pexels API.",
    )
    examples: list[str] = Field(
        default_factory=list,
        max_length=8,
        description="Concrete, real-world examples illustrating the concept.",
    )
    interesting_facts: list[str] = Field(
        default_factory=list,
        max_length=6,
        description="Short, gold-accented quick-fact callouts shown in the panel.",
    )
    comparison_table: Optional[ComparisonTable] = Field(
        default=None,
        description="Optional structured comparison matrix, populated only when relevant.",
    )

    @field_validator("key_points", "examples", "interesting_facts")
    @classmethod
    def strip_and_drop_empty_entries(cls, items: list[str]) -> list[str]:
        cleaned = [item.strip() for item in items if item and item.strip()]
        return cleaned


# --------------------------------------------------------------------- #
# Misc utility models
# --------------------------------------------------------------------- #
class HealthCheckResponse(BaseModel):
    """Lightweight liveness/readiness payload for the root + health routes."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="ok")
    service: str = Field(default="shiksha-ai-backend")
    version: str = Field(default="1.0.0")


class ErrorResponse(BaseModel):
    """Normalized error envelope returned by global exception handlers."""

    model_config = ConfigDict(extra="forbid")

    error: str
    detail: Optional[str] = None