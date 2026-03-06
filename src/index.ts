/**
 * Solarscene AI — Entry Point
 *
 * Operational task management, shift management, workflow execution,
 * and daily reporting service for the Trancendos mesh.
 * Zero-cost compliant — no LLM calls.
 *
 * Port: 3024
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { app, operations } from './api/server';
import { logger } from './utils/logger';

const PORT = Number(process.env.PORT ?? 3024);
const HOST = process.env.HOST ?? '0.0.0.0';

// ── Startup ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info('Solarscene AI starting up...');

  const server = app.listen(PORT, HOST, () => {
    logger.info(
      { port: PORT, host: HOST, env: process.env.NODE_ENV ?? 'development' },
      '☀️  Solarscene AI is online — Operations management active',
    );
  });

  // ── Daily Report Generation (every 24 hours) ─────────────────────────────
  const REPORT_INTERVAL = Number(process.env.REPORT_INTERVAL_MS ?? 24 * 60 * 60 * 1000);
  const reportTimer = setInterval(() => {
    try {
      const report = operations.generateDailyReport();
      const stats = operations.getStats();
      logger.info(
        {
          reportId: report.id,
          operationalStatus: report.operationalStatus,
          totalTasks: report.totalTasks,
          completedTasks: report.completedTasks,
          failedTasks: report.failedTasks,
          highlights: report.highlights.length,
          concerns: report.concerns.length,
          activeTasks: stats.activeTasks,
          activeWorkflows: stats.activeWorkflows,
        },
        '☀️  Solarscene daily operations report generated',
      );

      if (report.concerns.length > 0) {
        logger.warn({ concerns: report.concerns }, '⚠️  Operational concerns detected');
      }
    } catch (err) {
      logger.error({ err }, 'Daily report generation failed');
    }
  }, REPORT_INTERVAL);

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    clearInterval(reportTimer);
    server.close(() => {
      logger.info('Solarscene AI shut down cleanly');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Bootstrap failed');
  process.exit(1);
});