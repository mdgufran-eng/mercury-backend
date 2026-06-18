# Mercury Backend — Project Babel

Mercury is the backend for **Babel**, an in-house translation management system built as a drop-in replacement for XTM Cloud. It exposes XTM-compatible REST endpoints so that existing Rosetta integrations require zero changes, while giving Headout full control over translation pipelines, costs, and quality.

## Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Start the API server (port 3001)
npm run dev:api

# 4. (Optional) Start the BullMQ worker
npm run dev:worker
```

## Workspace Structure

| Path              | Language   | Purpose                                              |
|-------------------|------------|------------------------------------------------------|
| `packages/core`   | TypeScript | Shared domain types, DB helpers, queue name constants |
| `apps/api`        | TypeScript | Fastify HTTP server — XTM-compat + admin endpoints   |
| `apps/worker`     | TypeScript | BullMQ worker — translation, webhook, cost/PO jobs   |
| `services/ml`     | Python     | FastAPI ML translation service (stub)                |

## Design Doc

Full design and implementation plan lives in the Rosetta repo at:
`thoughts/shared/plans/in-house-xtm.md`
