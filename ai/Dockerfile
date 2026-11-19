FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
COPY src ./src
COPY README.md ./README.md
RUN uv sync --frozen --no-dev
COPY app.py ./app.py
CMD ["sh", "-c", "exec .venv/bin/uvicorn app:app --host :: --port ${PORT:?PORT is required}"]
