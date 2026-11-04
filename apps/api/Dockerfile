# Built from the repo root: the web app is built and served by the API on one port. The demo's sample models are
# downloaded while building (they are too big for git).
FROM node:20-slim AS web
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web ./
COPY apps/api/app/database/seed/rate-card /repo/apps/api/app/database/seed/rate-card
RUN npm run build

FROM python:3.12-slim
# DejaVu: a face with the naira sign for the BOQ PDF
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core curl unzip && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /bin/uv
WORKDIR /repo/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY apps/api ./
RUN bash app/database/seed/samples/download.sh
COPY --from=web /repo/apps/web/dist /repo/apps/web/dist
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
