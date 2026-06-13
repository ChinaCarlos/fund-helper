FROM node:22-alpine AS web-build

WORKDIR /app/web

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build


FROM python:3.12-slim AS runtime

LABEL org.opencontainers.image.title="fund-helper" \
      org.opencontainers.image.description="Fund portfolio monitor powered by Yangjibao API"

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    STATIC_DIR=/app/web/dist \
    SERVE_STATIC=true \
    API_PORT=8080 \
    MONGODB_URI=mongodb://mongo:27017 \
    MONGODB_DB=fund_helper \
    ADMIN_USERNAME=admin \
    ADMIN_PASSWORD=123456

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        gcc \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=web-build /app/web/dist /app/web/dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${API_PORT:-8080}"]
