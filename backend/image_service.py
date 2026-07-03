"""
image_service.py

Async Pexels image lookup module. Queries the Pexels search API for
keywords relevant to a student's question and maps raw results into
clean, schema-valid RelatedImage objects for the Visual Knowledge Panel.
"""

from __future__ import annotations

import logging
import os
import re

import httpx

from schemas import RelatedImage

logger = logging.getLogger("shiksha_ai.image_service")

PEXELS_SEARCH_ENDPOINT = "https://api.pexels.com/v1/search"
_REQUEST_TIMEOUT_SECONDS = 10.0
_DEFAULT_RESULT_COUNT = 6
_MAX_RESULT_COUNT = 9

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "what", "why", "how",
    "does", "do", "did", "explain", "tell", "me", "about", "of", "in",
    "to", "and", "or", "for", "vs", "versus", "please", "can", "you",
}


class ImageServiceError(Exception):
    """Raised when the Pexels API request fails outright."""


def _derive_search_keywords(query_text: str, max_words: int = 5) -> str:
    """
    Falls back to a lightweight keyword extraction from the raw query
    when no AI-refined keywords are supplied — strips stopwords and
    punctuation so the search stays focused on concrete nouns/subjects.
    """
    words = re.findall(r"[A-Za-z]+", query_text.lower())
    keywords = [word for word in words if word not in _STOPWORDS]
    if not keywords:
        keywords = words
    return " ".join(keywords[:max_words]) or query_text


class PexelsImageService:
    """Thin async client over the Pexels v1 search API."""

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.getenv("PEXELS_API_KEY")

    def _require_credentials(self) -> None:
        if not self._api_key:
            raise ImageServiceError(
                "PEXELS_API_KEY is not set. Add it to backend/.env before "
                "fetching images."
            )

    async def search_images(
        self,
        query_text: str,
        count: int = _DEFAULT_RESULT_COUNT,
        keywords_override: str | None = None,
    ) -> list[RelatedImage]:
        """
        Searches Pexels for educational stock photos relevant to the
        given query and returns a clean, capped list of RelatedImage
        objects. Returns an empty list (never raises) on API failure or
        when no results are found, so a flaky image lookup never breaks
        the overall chat response.
        """
        self._require_credentials()

        capped_count = max(1, min(count, _MAX_RESULT_COUNT))
        search_term = keywords_override or _derive_search_keywords(query_text)

        params = {
            "query": search_term,
            "per_page": capped_count,
            "orientation": "square",
        }
        headers = {"Authorization": self._api_key}

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    PEXELS_SEARCH_ENDPOINT, params=params, headers=headers
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Pexels search failed (%s) for query '%s': %s",
                exc.response.status_code,
                search_term,
                exc.response.text[:200],
            )
            return []
        except httpx.RequestError as exc:
            logger.warning("Pexels request error for query '%s': %s", search_term, exc)
            return []

        payload = response.json()
        photos = payload.get("photos", [])

        return self._map_photos_to_assets(photos)

    @staticmethod
    def _map_photos_to_assets(photos: list[dict]) -> list[RelatedImage]:
        assets: list[RelatedImage] = []

        for photo in photos:
            src = photo.get("src", {})
            image_url = src.get("large") or src.get("medium") or src.get("original")
            if not image_url:
                continue

            assets.append(
                RelatedImage(
                    url=image_url,
                    alt_text=(photo.get("alt") or "Educational reference image").strip()
                    or "Educational reference image",
                    photographer=photo.get("photographer"),
                    source_url=photo.get("url"),
                )
            )

        return assets


_image_service_singleton: PexelsImageService | None = None


def get_image_service() -> PexelsImageService:
    """Returns a process-wide singleton PexelsImageService instance."""
    global _image_service_singleton
    if _image_service_singleton is None:
        _image_service_singleton = PexelsImageService()
    return _image_service_singleton