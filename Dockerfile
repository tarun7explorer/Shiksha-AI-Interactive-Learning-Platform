# syntax=docker/dockerfile:1

# ===================================================================== #
# Stage 1 — Frontend builder
# Builds the Next.js app into a minimal "standalone" server bundle.
# ===================================================================== #
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ===================================================================== #
# Stage 2 — Backend dependency builder
# Resolves Python dependencies into a self-contained wheel cache.
# ===================================================================== #
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend

RUN pip install --no-cache-dir --upgrade pip
COPY backend/requirements.txt ./
RUN pip wheel --no-cache-dir --wheel-dir /app/backend/wheels -r requirements.txt


# ===================================================================== #
# Stage 3 — Production runtime
# Single container running both Uvicorn (FastAPI, port 8000) and the
# Next.js standalone server (port 7860 — the conventional Hugging Face
# Spaces Docker port). Next.js proxies /api/* to the FastAPI process
# internally via next.config.js rewrites, so only one port is exposed.
# ===================================================================== #
FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=7860 \
    BACKEND_PORT=8000 \
    BACKEND_INTERNAL_URL=http://localhost:8000

# --- Install Node.js 20 runtime alongside Python ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# --- Create a non-root user (required by Hugging Face Spaces) ---
RUN useradd --create-home --uid 1000 shiksha
WORKDIR /app

# --- Install backend Python dependencies from prebuilt wheels ---
COPY backend/requirements.txt /app/backend/requirements.txt
COPY --from=backend-builder /app/backend/wheels /app/backend/wheels
RUN pip install --no-cache-dir --no-index --find-links=/app/backend/wheels \
        -r /app/backend/requirements.txt \
    && rm -rf /app/backend/wheels

# --- Copy backend application source ---
COPY backend/ /app/backend/

# --- Copy the built Next.js standalone server, static assets, and public files ---
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

# --- Entrypoint orchestrating both processes ---
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/backend && chown -R shiksha:shiksha /app

USER shiksha

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/ || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]