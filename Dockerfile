FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY backend/requirements*.txt /app/backend/
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && useradd --create-home --uid 10001 appuser
COPY backend/app /app/backend/app
COPY data/snapshot.json.gz /app/data/snapshot.json.gz
COPY --from=frontend /build/dist /app/frontend/dist
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
