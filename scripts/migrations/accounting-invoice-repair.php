#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Reparación de facturación/contabilidad para MySQL.
 *
 * Uso:
 *   php scripts/migrations/accounting-invoice-repair.php --dry-run
 *   php scripts/migrations/accounting-invoice-repair.php --apply
 *
 * Variables de entorno esperadas:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
 */


final class AccountingInvoiceRepairMigration
{
    private \PDO $pdo;
    private bool $dryRun;

    public function __construct(\PDO $pdo, bool $dryRun)
    {
        $this->pdo = $pdo;
        $this->dryRun = $dryRun;
    }

    public function run(): void
    {
        $this->printHeader();

        $this->ensureAccountingAccountsTable();
        $this->ensureAccountingEntriesTable();
        $this->ensureTransfersTable();
        $this->ensureInvoiceItemsJobIdColumn();
        $this->seedCashboxAccounts();
        $this->backfillInvoiceItemsJobId();

        $this->printValidationHints();
    }

    private function printHeader(): void
    {
        $mode = $this->dryRun ? 'DRY-RUN (sin cambios)' : 'APPLY (aplicando cambios)';
        $version = $this->pdo->query('SELECT VERSION()')->fetchColumn();

        echo "== Accounting Invoice Repair Migration ==\n";
        echo "Mode: {$mode}\n";
        echo "MySQL version: {$version}\n\n";
    }

    private function ensureAccountingAccountsTable(): void
    {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('asset','liability','equity','income','expense') NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  related_cashbox_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounting_accounts_company_code (company_id, code),
  KEY idx_accounting_accounts_company (company_id),
  KEY idx_accounting_accounts_status (status),
  KEY idx_accounting_accounts_related_cashbox (related_cashbox_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;

        $this->exec($sql, 'Crear tabla accounting_accounts si falta');
    }

    private function ensureAccountingEntriesTable(): void
    {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS accounting_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  entry_type ENUM('debit','credit') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  origin_type VARCHAR(64) NULL,
  origin_id BIGINT UNSIGNED NULL,
  reference VARCHAR(255) NULL,
  notes TEXT NULL,
  entry_date DATE NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_accounting_entries_company_date (company_id, entry_date),
  KEY idx_accounting_entries_account (account_id),
  KEY idx_accounting_entries_origin (origin_type, origin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;

        $this->exec($sql, 'Crear tabla accounting_entries si falta');
    }

    private function ensureTransfersTable(): void
    {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS transfers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  origin_account_id BIGINT UNSIGNED NOT NULL,
  destination_account_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  transfer_date DATE NOT NULL,
  reference VARCHAR(255) NULL,
  notes TEXT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_transfers_company_date (company_id, transfer_date),
  KEY idx_transfers_origin (origin_account_id),
  KEY idx_transfers_destination (destination_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;

        $this->exec($sql, 'Crear tabla transfers si falta');
    }

    private function ensureInvoiceItemsJobIdColumn(): void
    {
        if (!$this->tableExists('invoice_items')) {
            echo "[skip] Tabla invoice_items no existe, no se agrega columna job_id.\n";
            return;
        }

        if (!$this->columnExists('invoice_items', 'job_id')) {
            $this->exec(
                'ALTER TABLE invoice_items ADD COLUMN job_id BIGINT UNSIGNED NULL AFTER invoice_id',
                'Agregar columna invoice_items.job_id'
            );
        }

        if (!$this->indexExists('invoice_items', 'idx_invoice_items_job_id')) {
            $this->exec(
                'ALTER TABLE invoice_items ADD KEY idx_invoice_items_job_id (job_id)',
                'Agregar índice idx_invoice_items_job_id'
            );
        }
    }

    private function seedCashboxAccounts(): void
    {
        if (!$this->tableExists('cash_boxes') || !$this->tableExists('accounting_accounts')) {
            echo "[skip] cash_boxes o accounting_accounts no existe, se omite seed de cuentas CASHBOX-<id>.\n";
            return;
        }

        $sql = <<<SQL
INSERT INTO accounting_accounts (
  company_id,
  code,
  name,
  type,
  status,
  balance,
  related_cashbox_id,
  created_at,
  updated_at
)
SELECT
  cb.company_id,
  CONCAT('CASHBOX-', cb.id),
  CONCAT('Caja ', COALESCE(cb.name, cb.id)),
  'asset',
  'active',
  0.00,
  cb.id,
  NOW(),
  NOW()
FROM cash_boxes cb
LEFT JOIN accounting_accounts aa
  ON aa.company_id = cb.company_id
 AND aa.related_cashbox_id = cb.id
WHERE aa.id IS NULL
SQL;

        $this->exec($sql, 'Crear cuentas contables para cajas faltantes (seed idempotente)');
    }

    private function backfillInvoiceItemsJobId(): void
    {
        if (!$this->tableExists('invoices') || !$this->tableExists('invoice_items')) {
            echo "[skip] invoices o invoice_items no existe, no se ejecuta backfill job_id.\n";
            return;
        }

        if (!$this->columnExists('invoices', 'job_ids') || !$this->columnExists('invoice_items', 'job_id')) {
            echo "[skip] Falta invoices.job_ids o invoice_items.job_id, no se ejecuta backfill job_id.\n";
            return;
        }

        $supportsJsonTable = version_compare((string) $this->pdo->query('SELECT VERSION()')->fetchColumn(), '8.0.0', '>=');

        if ($supportsJsonTable) {
            $sql = <<<SQL
WITH jobs AS (
  SELECT
    i.id AS invoice_id,
    jt.ord AS job_pos,
    jt.job_id
  FROM invoices i
  JOIN JSON_TABLE(
    i.job_ids,
    '$[*]' COLUMNS (
      ord FOR ORDINALITY,
      job_id BIGINT PATH '$'
    )
  ) AS jt
),
ranked_items AS (
  SELECT
    ii.id AS invoice_item_id,
    ii.invoice_id,
    ROW_NUMBER() OVER (
      PARTITION BY ii.invoice_id
      ORDER BY COALESCE(ii.order_index, ii.id)
    ) AS item_pos
  FROM invoice_items ii
  WHERE ii.job_id IS NULL
)
UPDATE invoice_items ii
JOIN ranked_items ri ON ri.invoice_item_id = ii.id
JOIN jobs j ON j.invoice_id = ri.invoice_id AND j.job_pos = ri.item_pos
SET ii.job_id = j.job_id
SQL;

            $this->exec($sql, 'Backfill invoice_items.job_id (MySQL 8+)');
            return;
        }

        if (!$this->tableExists('seq_1_to_100')) {
            $this->exec('CREATE TABLE IF NOT EXISTS seq_1_to_100 (n INT NOT NULL PRIMARY KEY)', 'Crear tabla secuencia seq_1_to_100');
            $this->exec(
                "INSERT IGNORE INTO seq_1_to_100 (n)
                SELECT ones.n + tens.n * 10 + 1
                FROM (
                  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                ) ones
                CROSS JOIN (
                  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                ) tens",
                'Poblar secuencia 1..100'
            );
        }

        $sql = <<<SQL
UPDATE invoice_items ii
JOIN (
  SELECT
    ii2.id,
    ii2.invoice_id,
    (@rn := IF(@cur = ii2.invoice_id, @rn + 1, 1)) AS item_pos,
    (@cur := ii2.invoice_id) AS cur_invoice
  FROM invoice_items ii2
  JOIN (SELECT @rn := 0, @cur := 0) vars
  ORDER BY ii2.invoice_id, COALESCE(ii2.order_index, ii2.id)
) ranked ON ranked.id = ii.id
JOIN (
  SELECT
    i.id AS invoice_id,
    s.n AS job_pos,
    CAST(
      JSON_UNQUOTE(JSON_EXTRACT(i.job_ids, CONCAT('$[', s.n - 1, ']')))
      AS UNSIGNED
    ) AS job_id
  FROM invoices i
  JOIN seq_1_to_100 s ON s.n <= JSON_LENGTH(i.job_ids)
) jobs ON jobs.invoice_id = ranked.invoice_id AND jobs.job_pos = ranked.item_pos
SET ii.job_id = jobs.job_id
WHERE ii.job_id IS NULL
SQL;

        $this->exec($sql, 'Backfill invoice_items.job_id (MySQL 5.7)');
    }

    private function printValidationHints(): void
    {
        echo "\n== Validaciones recomendadas ==\n";
        echo "SHOW TABLES LIKE 'accounting_%';\n";
        echo "SHOW CREATE TABLE accounting_accounts;\n";
        echo "SHOW INDEX FROM accounting_accounts;\n";
        echo "SELECT company_id, code, COUNT(*) c FROM accounting_accounts GROUP BY company_id, code HAVING c > 1;\n";
        echo "SELECT SUM(job_id IS NOT NULL) AS items_con_job, SUM(job_id IS NULL) AS items_sin_job, COUNT(*) AS total_items FROM invoice_items;\n";
    }

    private function exec(string $sql, string $label): void
    {
        echo "- {$label}\n";

        if ($this->dryRun) {
            echo "  [dry-run] {$sql}\n";
            return;
        }

        $affected = $this->pdo->exec($sql);
        $affectedLabel = $affected === false ? 'n/a' : (string) $affected;
        echo "  [ok] Ejecutado. Filas afectadas: {$affectedLabel}\n";
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table'
        );
        $stmt->execute(['table' => $table]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function columnExists(string $table, string $column): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column'
        );
        $stmt->execute(['table' => $table, 'column' => $column]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function indexExists(string $table, string $index): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :index'
        );
        $stmt->execute(['table' => $table, 'index' => $index]);

        return (int) $stmt->fetchColumn() > 0;
    }
}

function loadOptions(array $argv): array
{
    return [
        'dryRun' => in_array('--dry-run', $argv, true) || !in_array('--apply', $argv, true),
    ];
}

function createPdoFromEnv(): \PDO
{
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $dbName = getenv('DB_NAME') ?: '';
    $user = getenv('DB_USER') ?: '';
    $pass = getenv('DB_PASS') ?: '';

    if ($dbName === '' || $user === '') {
        fwrite(STDERR, "Faltan DB_NAME o DB_USER en variables de entorno.\n");
        exit(1);
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $dbName);

    return new \PDO($dsn, $user, $pass, [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
    ]);
}

$options = loadOptions($argv);
$pdo = createPdoFromEnv();
$migration = new AccountingInvoiceRepairMigration($pdo, $options['dryRun']);
$migration->run();
