# Dr. Kuzbury — Database & Backend Architecture

This directory houses the Python `FastAPI` logic and the `.sql` schemas required to fully deploy the N=1 Cardiovascular Intelligence system in a production or staging cloud environment.

## 1. Database Architecture (Dual-Engine)
As outlined in the Functional Specification, this platform abandons basic NoSQL approaches in favor of a hybrid **Relational + Time-Series + Vector** model.
- **Transactions & Profile**: Standard PostgreSQL handles relational state (prescriptions, target bounds, demographics).
- **Telemetry**: **TimescaleDB** (a Postgres extension) partitions the high-frequency Apple Watch vitals into hyper-tables for ultra-fast time-based aggregation.
- **RAG Memory**: `pgvector` encodes Dr. Kuzbury's episodic and semantic memory to allow for geometric similarity RAG queries alongside the 2025 ESC Guidelines.

**To Deploy the Database:**
```bash
# We recommend using a Docker container with all 3 extensions pre-packaged natively:
docker run -d --name kuzbury-db -p 5432:5432 -e POSTGRES_PASSWORD=secret timescale/timescaledb-ha:pg16

# Run the schema definitions
psql -h localhost -U postgres -d postgres -f app/db/db_schemas.sql
```

## 2. API Architecture (FastAPI)
The backend routes telemetry away from the front-end directly into Python, enabling secure, invisible integrations with LLMs (Gemini/Claude) and shielding API Keys from the iOS client.

**To Run Locally:**
```bash
# 1. Activate your virtual environment
source venv/bin/activate

# 2. Launch Uvicorn development server
uvicorn app.main:app --reload --port 8000
```
Then navigate to `http://localhost:8000/docs` to test the Kuzbury ingestion endpoints via Swagger.
