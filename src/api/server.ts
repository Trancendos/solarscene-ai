/**
 * Solarscene AI — REST API Server
 *
 * Exposes operational task management, shift management, workflow
 * execution, and daily reporting endpoints for the Trancendos mesh.
 *
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  OperationsEngine,
  TaskPriority,
  TaskStatus,
  ShiftType,
  WorkflowTrigger,
} from '../operations/operations-engine';
import { logger } from '../utils/logger';

// ── Bootstrap ──────────────────────────────────────────────────────────────

const app = express();
export const operations = new OperationsEngine();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}

function fail(res: Response, message: string, status = 400): void {
  res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

// ── Health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  const stats = operations.getStats();
  ok(res, {
    status: 'healthy',
    service: 'solarscene-ai',
    uptime: process.uptime(),
    operationalStatus: stats.operationalStatus,
    activeTasks: stats.activeTasks,
  });
});

app.get('/metrics', (_req, res) => {
  ok(res, {
    ...operations.getStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// ── Tasks ──────────────────────────────────────────────────────────────────

// GET /tasks — list tasks with optional filters
app.get('/tasks', (req, res) => {
  const { status, priority, assignedTo, tags } = req.query;
  const tasks = operations.getTasks({
    status: status as TaskStatus | undefined,
    priority: priority as TaskPriority | undefined,
    assignedTo: assignedTo as string | undefined,
    tags: tags ? (tags as string).split(',') : undefined,
  });
  ok(res, { tasks, count: tasks.length });
});

// GET /tasks/:id — get a specific task
app.get('/tasks/:id', (req, res) => {
  const task = operations.getTask(req.params.id);
  if (!task) return fail(res, 'Task not found', 404);
  ok(res, task);
});

// POST /tasks — create a task
app.post('/tasks', (req, res) => {
  const { title, description, priority, assignedTo, dueDate, tags, metadata } = req.body;
  if (!title) return fail(res, 'title is required');
  const validPriorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    return fail(res, `priority must be one of: ${validPriorities.join(', ')}`);
  }
  try {
    const task = operations.createTask({
      title,
      description,
      priority: priority as TaskPriority | undefined,
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      metadata,
    });
    ok(res, task, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// PATCH /tasks/:id — update a task
app.patch('/tasks/:id', (req, res) => {
  const { status, priority, assignedTo, dueDate, tags, notes } = req.body;
  const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'complete', 'failed', 'cancelled', 'deferred'];
  if (status && !validStatuses.includes(status)) {
    return fail(res, `status must be one of: ${validStatuses.join(', ')}`);
  }
  const task = operations.updateTask(req.params.id, {
    status: status as TaskStatus | undefined,
    priority: priority as TaskPriority | undefined,
    assignedTo,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    tags,
    notes,
  });
  if (!task) return fail(res, 'Task not found', 404);
  ok(res, task);
});

// ── Shifts ─────────────────────────────────────────────────────────────────

// GET /shifts — list shifts
app.get('/shifts', (req, res) => {
  const { status } = req.query;
  const shifts = operations.getShifts(status as 'active' | 'complete' | undefined);
  ok(res, { shifts, count: shifts.length });
});

// POST /shifts — start a shift
app.post('/shifts', (req, res) => {
  const { operatorId, operatorName, type, notes } = req.body;
  if (!operatorId || !operatorName || !type) {
    return fail(res, 'operatorId, operatorName, type are required');
  }
  const validTypes: ShiftType[] = ['day', 'night', 'weekend', 'on_call'];
  if (!validTypes.includes(type)) {
    return fail(res, `type must be one of: ${validTypes.join(', ')}`);
  }
  try {
    const shift = operations.startShift({
      operatorId,
      operatorName,
      type: type as ShiftType,
      notes,
    });
    ok(res, shift, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// PATCH /shifts/:id/end — end a shift
app.patch('/shifts/:id/end', (req, res) => {
  const { handoffNotes } = req.body;
  const shift = operations.endShift(req.params.id, handoffNotes);
  if (!shift) return fail(res, 'Shift not found or already ended', 404);
  ok(res, shift);
});

// ── Workflows ──────────────────────────────────────────────────────────────

// GET /workflows — list workflows
app.get('/workflows', (req, res) => {
  const isActive = req.query.isActive !== undefined
    ? req.query.isActive === 'true'
    : undefined;
  const workflows = operations.getWorkflows(isActive);
  ok(res, { workflows, count: workflows.length });
});

// POST /workflows — create a workflow
app.post('/workflows', (req, res) => {
  const { name, description, trigger, steps, schedule } = req.body;
  if (!name || !trigger || !steps) {
    return fail(res, 'name, trigger, steps are required');
  }
  const validTriggers: WorkflowTrigger[] = ['scheduled', 'manual', 'event', 'threshold'];
  if (!validTriggers.includes(trigger)) {
    return fail(res, `trigger must be one of: ${validTriggers.join(', ')}`);
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return fail(res, 'steps must be a non-empty array');
  }
  try {
    const workflow = operations.createWorkflow({
      name,
      description,
      trigger: trigger as WorkflowTrigger,
      steps,
      schedule,
    });
    ok(res, workflow, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// POST /workflows/:id/run — run a workflow
app.post('/workflows/:id/run', (req, res) => {
  const result = operations.runWorkflow(req.params.id);
  ok(res, result, result.success ? 200 : 422);
});

// ── Reports ────────────────────────────────────────────────────────────────

// GET /reports — list recent daily reports
app.get('/reports', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const reports = operations.getReports(limit);
  ok(res, { reports, count: reports.length });
});

// POST /reports — generate a daily report
app.post('/reports', (_req, res) => {
  const report = operations.generateDailyReport();
  ok(res, report, 201);
});

// ── Stats ──────────────────────────────────────────────────────────────────

app.get('/stats', (_req, res) => {
  ok(res, operations.getStats());
});

// ── Error Handler ──────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  fail(res, err.message || 'Internal server error', 500);
});

export { app };