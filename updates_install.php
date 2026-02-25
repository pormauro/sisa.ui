#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Hook de instalación/actualización.
 *
 * Este script centraliza migraciones que deben ejecutarse al instalar
 * o actualizar la app desde flujos que llaman `updates_install.php`.
 */

$rootDir = __DIR__;
$migrationPath = $rootDir . '/scripts/migrations/accounting-invoice-repair.php';

if (!is_file($migrationPath)) {
    fwrite(STDOUT, "[updates_install] Migración no encontrada, se omite: {$migrationPath}\n");
    exit(0);
}

$phpBinary = PHP_BINARY ?: 'php';
$command = escapeshellarg($phpBinary)
    . ' '
    . escapeshellarg($migrationPath)
    . ' --apply';

fwrite(STDOUT, "[updates_install] Ejecutando accounting-invoice-repair (--apply)...\n");
passthru($command, $exitCode);

if ((int) $exitCode !== 0) {
    fwrite(STDERR, "[updates_install] La migración finalizó con código {$exitCode}.\n");
    exit((int) $exitCode);
}

fwrite(STDOUT, "[updates_install] Migración completada correctamente.\n");
exit(0);
