# ===== Backend Dockerfile (FastAPI) =====
FROM python:3.11-slim

WORKDIR /app

# System deps (poppler for any PDF tools, build essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend source
COPY backend/ /app/

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8001/api/health || exit 1

EXPOSE 8001

# Use Uvicorn with sensible production settings
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers"]
