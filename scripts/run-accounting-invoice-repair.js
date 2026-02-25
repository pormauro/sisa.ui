#!/usr/bin/env node

const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const migrationPath = join(__dirname, 'migrations', 'accounting-invoice-repair.php');

if (process.env.SKIP_ACCOUNTING_INVOICE_REPAIR === '1') {
  console.log('[accounting-invoice-repair] Omitida por SKIP_ACCOUNTING_INVOICE_REPAIR=1.');
  process.exit(0);
}

if (!existsSync(migrationPath)) {
  console.log('[accounting-invoice-repair] Script no encontrado, se omite ejecución automática.');
  process.exit(0);
}

const phpCheck = spawnSync('php', ['-v'], { stdio: 'ignore' });
if (phpCheck.status !== 0) {
  console.log('[accounting-invoice-repair] PHP no está disponible en PATH, se omite ejecución automática.');
  process.exit(0);
}

const requiredEnv = ['DB_NAME', 'DB_USER'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.log(
    `[accounting-invoice-repair] Faltan variables (${missingEnv.join(', ')}), se omite ejecución automática.`
  );
  process.exit(0);
}

console.log('[accounting-invoice-repair] Ejecutando migración automática (--apply)...');
const result = spawnSync('php', [migrationPath, '--apply'], {
  stdio: 'inherit',
  env: process.env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

console.error('[accounting-invoice-repair] No se pudo determinar el resultado de la migración.');
process.exit(1);
