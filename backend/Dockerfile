# Build from the REPOSITORY ROOT:
#   docker build -f backend/Dockerfile -t finsight-backend .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# build-essential for wheels; JRE only needed by opt-in tabula PDF tables.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-jre-headless \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ ./
COPY data/companies/ ./data/companies/

EXPOSE 8000

# Seed is idempotent and creates the schema on a fresh Neon database.
CMD python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
