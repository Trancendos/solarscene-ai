# Solarscene AI ☀️

> Operational task management, shift management, workflow execution, and daily reporting for the Trancendos mesh.
> Zero-cost compliant — no LLM calls, all rule-based operations.

**Port:** `3024`
**Architecture:** Trancendos Industry 6.0 / 2060 Standard

---

## Overview

Solarscene AI manages day-to-day operations for the Trancendos mesh. It tracks operational tasks with priority ordering, manages operator shifts, executes automated workflows, and generates daily operations reports with highlights and concerns.

---

## Task Priorities

`low` · `normal` · `high` · `urgent` · `critical`

## Task Statuses

`pending` · `in_progress` · `complete` · `failed` · `cancelled` · `deferred`

## Shift Types

`day` · `night` · `weekend` · `on_call`

## Workflow Triggers

`scheduled` · `manual` · `event` · `threshold`

---

## Operational Status

| Status | Description |
|--------|-------------|
| `nominal` | All systems operating normally |
| `elevated` | Minor issues detected, monitoring closely |
| `degraded` | Significant issues affecting operations |
| `critical` | Critical failures requiring immediate action |

---

## API Reference

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + operational status |
| GET | `/metrics` | Runtime metrics + operations stats |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List tasks (filter by status, priority, assignedTo, tags) |
| GET | `/tasks/:id` | Get a specific task |
| POST | `/tasks` | Create a task |
| PATCH | `/tasks/:id` | Update a task |

### Shifts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/shifts` | List shifts (filter by status) |
| POST | `/shifts` | Start a shift |
| PATCH | `/shifts/:id/end` | End a shift |

### Workflows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/workflows` | List workflows (filter by isActive) |
| POST | `/workflows` | Create a workflow |
| POST | `/workflows/:id/run` | Run a workflow |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports` | List recent daily reports |
| POST | `/reports` | Generate a daily report |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Operations statistics |

---

## Usage Examples

### Create a Task

```bash
curl -X POST http://localhost:3024/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review security posture",
    "description": "Check Renik AI security posture and rotate expired keys",
    "priority": "high",
    "assignedTo": "norman-ai",
    "tags": ["security", "maintenance"]
  }'
```

### Run a Workflow

```bash
curl -X POST http://localhost:3024/workflows/<workflow-id>/run
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3024` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server host |
| `LOG_LEVEL` | `info` | Pino log level |
| `REPORT_INTERVAL_MS` | `86400000` | Daily report generation interval (ms) |

---

## Development

```bash
npm install
npm run dev       # tsx watch mode
npm run build     # compile TypeScript
npm start         # run compiled output
```

---

## Default Workflows

Solarscene AI seeds 2 workflows on startup:
- **Daily Health Check** — runs health checks across all mesh services
- **Security Posture Review** — reviews security posture via Renik AI

---

*Part of the Trancendos Industry 6.0 mesh — 2060 Standard*