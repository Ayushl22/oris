# Build from repository root: docker build -f backend/Dockerfile -t wind-api .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY backend/requirements*.txt /app/backend/
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && useradd --create-home --uid 10001 appuser
COPY backend/app /app/backend/app
COPY data/snapshot.json.gz /app/data/snapshot.json.gz
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
