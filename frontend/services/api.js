/**
 * services/api.js
 *
 * Thin fetch wrapper around the backend's /api/chat endpoint. Requests
 * are sent to the relative path "/api/chat" so that Next.js's rewrite
 * rule in next.config.js transparently proxies them to the FastAPI
 * backend (http://localhost:8000/api/chat) without needing CORS at
 * all, since the browser only ever talks to the Next.js origin.
 */

const CHAT_ENDPOINT = "/api/chat";

// Matches (and stays comfortably under) the backend's own
// CHAT_PIPELINE_TIMEOUT_SECONDS in main.py, so the frontend times out
// gracefully instead of waiting on a connection the backend has already
// given up on.
const REQUEST_TIMEOUT_MS = 50_000;

/**
 * Sends a question to Tina and returns the parsed ChatResponse:
 *   { panel: VisualPanelResponse, audio_base64: string | null, audio_format: string }
 *
 * @param {Object} params
 * @param {string} params.queryText - The user's question (typed or transcribed).
 * @param {string} [params.voiceLanguage] - One of "en-IN" | "hi-IN" | "te-IN".
 * @param {string} [params.sessionId] - Optional client-generated session id.
 */
export async function sendChatMessage({
  queryText,
  voiceLanguage = "en-IN",
  sessionId,
}) {
  if (!queryText || !queryText.trim()) {
    throw new Error("queryText cannot be empty.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query_text: queryText.trim(),
        voice_language: voiceLanguage,
        session_id: sessionId ?? undefined,
      }),
      signal: controller.signal,
    });
  } catch (networkError) {
    if (networkError.name === "AbortError") {
      throw new Error(
        "The request took too long and was cancelled. Please check your connection and try again."
      );
    }
    // fetch() itself throws only on true network failures (backend down,
    // DNS failure, etc).
    throw new Error(
      `Could not reach the ShikshaAI backend. Is it running on port 8000? (${networkError.message})`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || detail;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(detail);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error(
      `The backend returned a response that couldn't be parsed as JSON. (${parseError.message})`
    );
  }

  if (!data || typeof data !== "object" || !data.panel) {
    throw new Error("The backend response was missing the expected 'panel' data.");
  }

  return data;
}

/**
 * Maps the language code used by the UI ("en" | "hi" | "te") to the
 * BCP-47-ish locale the backend's VoiceLanguage enum expects.
 */
export function toBackendLanguage(uiLanguageCode) {
  switch (uiLanguageCode) {
    case "hi":
      return "hi-IN";
    case "te":
      return "te-IN";
    case "en":
    default:
      return "en-IN";
  }
}

/**
 * Maps the backend's VisualPanelResponse shape onto the prop shape
 * VisualPanel.jsx already expects, so the component itself needs no
 * changes. Defensive against a partially-shaped panel so a malformed
 * or degraded response can never crash the render.
 */
export function mapPanelToVisualPanelContent(panel) {
  if (!panel) return null;

  return {
    title: panel.question ?? "",
    summary: panel.ai_conversation_summary ?? "",
    keyPoints: Array.isArray(panel.key_points) ? panel.key_points : [],
    images: Array.isArray(panel.images)
      ? panel.images
          .filter((img) => img && img.url)
          .map((img) => ({
            url: img.url,
            alt: img.alt_text,
            credit: img.photographer ? `Photo: ${img.photographer}` : undefined,
          }))
      : [],
    facts: Array.isArray(panel.interesting_facts) ? panel.interesting_facts : [],
    comparison:
      panel.comparison_table &&
      Array.isArray(panel.comparison_table.headers) &&
      Array.isArray(panel.comparison_table.rows)
        ? {
            headers: panel.comparison_table.headers,
            rows: panel.comparison_table.rows,
          }
        : null,
  };
}