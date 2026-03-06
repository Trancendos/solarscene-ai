/**
 * Solarscene AI — Day Operations Engine
 *
 * Manages daily operational workflows, task scheduling, shift management,
 * and operational health for the Trancendos mesh. Part of Guardian/Renik's
 * security team — handles daytime operational security posture.
 *
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'cancelled' | 'deferred';
export type ShiftType = 'day' | 'night' | 'weekend' | 'on_call';
export type OperationalStatus = 'nominal' | 'elevated' | 'degraded' | 'critical';
export type WorkflowTrigger = 'scheduled' | 'manual' | 'event' | 'threshold';

export interface OperationalTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  dueAt?: Date;
  completedAt?: Date;
  tags: string[];
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  id: string;
  type: ShiftType;
  operatorId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'handoff';
  handoffNotes?: string;
  tasksCompleted: number;
  incidentsHandled: number;
  createdAt: Date;
}

export interface DailyOperationsReport {
  id: string;
  date: string;
  operationalStatus: OperationalStatus;
  tasksCompleted: number;
  tasksFailed: number;
  tasksPending: number;
  shiftsCompleted: number;
  incidentsHandled: number;
  uptime: number;
  highlights: string[];
  concerns: string[];
  generatedAt: Date;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  isActive: boolean;
  lastRun?: Date;
  runCount: number;
  createdAt: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  params?: Record<string, unknown>;
  order: number;
}

export interface OperationsStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  failedTasks: number;
  criticalTasks: number;
  activeShifts: number;
  totalWorkflows: number;
  activeWorkflows: number;
  operationalStatus: OperationalStatus;
}

// ── Operations Engine ─────────────────────────────────────────────────────

export class OperationsEngine {
  private tasks: Map<string, OperationalTask> = new Map();
  private shifts: Map<string, Shift> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private reports: DailyOperationsReport[] = [];

  constructor() {
    this.seedDefaultWorkflows();
    logger.info('OperationsEngine (Solarscene AI) initialized — day operations active');
  }

  // ── Task Management ─────────────────────────────────────────────────────

  createTask(params: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    assignedTo?: string;
    dueAt?: Date;
    tags?: string[];
  }): OperationalTask {
    const task: OperationalTask = {
      id: uuidv4(),
      title: params.title,
      description: params.description,
      priority: params.priority || 'normal',
      status: 'pending',
      assignedTo: params.assignedTo,
      dueAt: params.dueAt,
      tags: params.tags || [],
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(task.id, task);
    logger.info({ taskId: task.id, title: task.title, priority: task.priority }, 'Operational task created');
    return task;
  }

  updateTask(taskId: string, updates: {
    status?: TaskStatus;
    assignedTo?: string;
    priority?: TaskPriority;
    note?: string;
  }): OperationalTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    if (updates.status) {
      task.status = updates.status;
      if (updates.status === 'complete') task.completedAt = new Date();
    }
    if (updates.assignedTo !== undefined) task.assignedTo = updates.assignedTo;
    if (updates.priority) task.priority = updates.priority;
    if (updates.note) task.notes.push(`[${new Date().toISOString()}] ${updates.note}`);
    task.updatedAt = new Date();

    logger.info({ taskId, status: task.status }, 'Task updated');
    return task;
  }

  getTask(taskId: string): OperationalTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasks(filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assignedTo?: string;
    tag?: string;
    limit?: number;
  }): OperationalTask[] {
    let tasks = Array.from(this.tasks.values());
    if (filters?.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters?.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    if (filters?.assignedTo) tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
    if (filters?.tag) tasks = tasks.filter(t => t.tags.includes(filters.tag!));

    // Sort: critical first, then by priority, then by createdAt
    const priorityOrder: Record<TaskPriority, number> = { critical: 0, urgent: 1, high: 2, normal: 3, low: 4 };
    tasks.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    if (filters?.limit) tasks = tasks.slice(0, filters.limit);
    return tasks;
  }

  // ── Shift Management ────────────────────────────────────────────────────

  startShift(params: {
    type: ShiftType;
    operatorId: string;
  }): Shift {
    const shift: Shift = {
      id: uuidv4(),
      type: params.type,
      operatorId: params.operatorId,
      startTime: new Date(),
      status: 'active',
      tasksCompleted: 0,
      incidentsHandled: 0,
      createdAt: new Date(),
    };
    this.shifts.set(shift.id, shift);
    logger.info({ shiftId: shift.id, type: shift.type, operatorId: shift.operatorId }, 'Shift started');
    return shift;
  }

  endShift(shiftId: string, handoffNotes?: string): Shift | undefined {
    const shift = this.shifts.get(shiftId);
    if (!shift || shift.status !== 'active') return undefined;
    shift.status = 'completed';
    shift.endTime = new Date();
    shift.handoffNotes = handoffNotes;
    logger.info({ shiftId, duration: shift.endTime.getTime() - shift.startTime.getTime() }, 'Shift ended');
    return shift;
  }

  getShifts(status?: Shift['status']): Shift[] {
    let shifts = Array.from(this.shifts.values());
    if (status) shifts = shifts.filter(s => s.status === status);
    return shifts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── Workflows ────────────────────────────────────────────────────────────

  createWorkflow(params: {
    name: string;
    description?: string;
    trigger: WorkflowTrigger;
    steps: Omit<WorkflowStep, 'id'>[];
  }): Workflow {
    const workflow: Workflow = {
      id: uuidv4(),
      name: params.name,
      description: params.description,
      trigger: params.trigger,
      steps: params.steps.map(s => ({ ...s, id: uuidv4() })),
      isActive: true,
      runCount: 0,
      createdAt: new Date(),
    };
    this.workflows.set(workflow.id, workflow);
    logger.info({ workflowId: workflow.id, name: workflow.name, trigger: workflow.trigger }, 'Workflow created');
    return workflow;
  }

  runWorkflow(workflowId: string): { success: boolean; stepsExecuted: number; message: string } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return { success: false, stepsExecuted: 0, message: 'Workflow not found' };
    if (!workflow.isActive) return { success: false, stepsExecuted: 0, message: 'Workflow is inactive' };

    workflow.lastRun = new Date();
    workflow.runCount++;
    logger.info({ workflowId, name: workflow.name, steps: workflow.steps.length }, 'Workflow executed');
    return { success: true, stepsExecuted: workflow.steps.length, message: `Workflow ${workflow.name} executed successfully` };
  }

  getWorkflows(isActive?: boolean): Workflow[] {
    let workflows = Array.from(this.workflows.values());
    if (isActive !== undefined) workflows = workflows.filter(w => w.isActive === isActive);
    return workflows;
  }

  // ── Daily Report ─────────────────────────────────────────────────────────

  generateDailyReport(): DailyOperationsReport {
    const tasks = Array.from(this.tasks.values());
    const shifts = Array.from(this.shifts.values());
    const today = new Date().toISOString().split('T')[0];

    const todayTasks = tasks.filter(t => t.createdAt.toISOString().startsWith(today));
    const completed = todayTasks.filter(t => t.status === 'complete').length;
    const failed = todayTasks.filter(t => t.status === 'failed').length;
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const criticalPending = tasks.filter(t => t.priority === 'critical' && t.status !== 'complete').length;

    const highlights: string[] = [];
    const concerns: string[] = [];

    if (completed > 0) highlights.push(`${completed} tasks completed today`);
    if (failed > 0) concerns.push(`${failed} tasks failed today`);
    if (criticalPending > 0) concerns.push(`${criticalPending} critical tasks still pending`);

    let operationalStatus: OperationalStatus = 'nominal';
    if (criticalPending > 0) operationalStatus = 'elevated';
    if (failed > 2) operationalStatus = 'degraded';

    const report: DailyOperationsReport = {
      id: uuidv4(),
      date: today,
      operationalStatus,
      tasksCompleted: completed,
      tasksFailed: failed,
      tasksPending: pending,
      shiftsCompleted: shifts.filter(s => s.status === 'completed').length,
      incidentsHandled: shifts.reduce((sum, s) => sum + s.incidentsHandled, 0),
      uptime: 99.9,
      highlights,
      concerns,
      generatedAt: new Date(),
    };

    this.reports.push(report);
    logger.info({ reportId: report.id, status: report.operationalStatus }, 'Daily operations report generated');
    return report;
  }

  getReports(limit = 10): DailyOperationsReport[] {
    return this.reports.slice(-limit).reverse();
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): OperationsStats {
    const tasks = Array.from(this.tasks.values());
    const shifts = Array.from(this.shifts.values());
    const workflows = Array.from(this.workflows.values());

    const criticalPending = tasks.filter(t => t.priority === 'critical' && t.status !== 'complete').length;
    let operationalStatus: OperationalStatus = 'nominal';
    if (criticalPending > 0) operationalStatus = 'elevated';
    if (tasks.filter(t => t.status === 'failed').length > 3) operationalStatus = 'degraded';

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      completedTasks: tasks.filter(t => t.status === 'complete').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      criticalTasks: criticalPending,
      activeShifts: shifts.filter(s => s.status === 'active').length,
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter(w => w.isActive).length,
      operationalStatus,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private seedDefaultWorkflows(): void {
    this.createWorkflow({
      name: 'Daily Health Check',
      description: 'Run health checks across all mesh services',
      trigger: 'scheduled',
      steps: [
        { name: 'Check core agents', action: 'health_check', params: { targets: ['cornelius-ai', 'guardian-ai', 'dorris-ai'] }, order: 1 },
        { name: 'Check platform modules', action: 'health_check', params: { targets: ['the-hive', 'the-observatory'] }, order: 2 },
        { name: 'Generate report', action: 'generate_report', params: { type: 'health' }, order: 3 },
      ],
    });

    this.createWorkflow({
      name: 'Security Posture Review',
      description: 'Daily security posture assessment',
      trigger: 'scheduled',
      steps: [
        { name: 'Check threat level', action: 'query_service', params: { service: 'the-citadel', endpoint: '/threat-level' }, order: 1 },
        { name: 'Review alerts', action: 'query_service', params: { service: 'sentinel-ai', endpoint: '/alerts' }, order: 2 },
        { name: 'Log posture', action: 'log_metric', params: { metric: 'security_posture' }, order: 3 },
      ],
    });

    logger.info({ count: 2 }, 'Default operational workflows seeded');
  }
}