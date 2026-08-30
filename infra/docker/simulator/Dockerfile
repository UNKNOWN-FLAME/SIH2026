FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi uvicorn[standard] pydantic pyyaml httpx structlog

COPY . .

# Expose the simulator control API port
EXPOSE 8200

CMD ["uvicorn", "simulator.station_sim.main:app", "--host", "0.0.0.0", "--port", "8200"]
