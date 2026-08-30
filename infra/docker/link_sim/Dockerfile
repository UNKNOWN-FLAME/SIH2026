FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi uvicorn[standard] pydantic httpx structlog

COPY . .

EXPOSE 8300

CMD ["uvicorn", "simulator.link_sim.main:app", "--host", "0.0.0.0", "--port", "8300"]
