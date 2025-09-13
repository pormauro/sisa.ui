// src/utils/errorLogger.ts

/**
 * Simple in-memory error logging utility.
 * Stores error information in a local array instead of using SQLite.
 */

interface ErrorLogEntry {
  id: number;
  error_message: string;
  error_stack: string;
  timestamp: string;
}

const errorLogs: ErrorLogEntry[] = [];

/**
 * Registers an error in memory.
 * @param error - Error object to be logged.
 */
export function logError(error: Error) {
  const timestamp = new Date().toISOString();
  const errorMessage = error.message || 'Unknown error';
  const errorStack = error.stack || '';
  errorLogs.push({
    id: errorLogs.length + 1,
    error_message: errorMessage,
    error_stack: errorStack,
    timestamp,
  });
}

/**
 * Retrieves all stored error logs in reverse order (latest first).
 */
export function getErrorLogs(): ErrorLogEntry[] {
  return [...errorLogs].reverse();
}

/**
 * Clears all stored error logs.
 */
export function clearErrorLogs() {
  errorLogs.length = 0;
}
