import { config } from '../config';
import { logger } from '../utils/logger';
import { scannerCyclesTotal } from '../utils/metrics';
import { checkAllRepositories } from './releaseChecker';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function runCycle(): Promise<void> {
  if (isRunning) {
    logger.warn('Scanner: previous cycle still running, skipping');
    return;
  }

  isRunning = true;

  try {
    await checkAllRepositories();
    scannerCyclesTotal.inc();
  } catch (error) {
    logger.error('Scanner: cycle failed:', error);
  } finally {
    isRunning = false;
  }
}

export function startScanner(): void {
  logger.info(`Scanner started, interval: ${config.SCAN_INTERVAL_MS}ms`);
  runCycle();
  intervalId = setInterval(runCycle, config.SCAN_INTERVAL_MS);
}

export function stopScanner(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Scanner stopped');
  }
}
