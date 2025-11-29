# Guía de cuentas, asientos y transferencias

Esta guía resume los esquemas de datos y el uso de los endpoints `accounts`, `accounting_entries` y `transfers` en `sisa.api`. Todos los ejemplos asumen autenticación por token Bearer (`Authorization: Bearer <token>`), salvo el login. El super usuario (ID = 1) puede saltar cualquier restricción de compañía o de estado activo.

## Esquemas de tablas

### accounts
- `id` (int): identificador interno.
- `company_id` (int): ámbito obligatorio para filtrar y validar unicidad lógica.
- `code` (string): código de cuenta único por compañía.
- `name` (string): nombre legible.
- `active` (boolean): indica si la cuenta puede usarse.
- `current_balance` (decimal): saldo estimado (no depende de FOREIGN KEY; las sumatorias se recalculan en app/servicio).
- `created_at`, `updated_at` (datetime).

### accounting_entries
- `id` (int) y `company_id` (int) con el mismo alcance por compañía.
- `account_id` (int): cuenta asociada; sin FOREIGN KEY, validar existencia vía servicio.
- `entry_type` (enum): `debit` o `credit`.
- `amount` (decimal): siempre positivo; el signo lo define `entry_type`.
- `origin_type` / `origin_id` (string/int): referencia cruzada lógica (facturas, recibos, transferencias, cierres manuales). No se usa clave foránea pero se debe registrar para trazabilidad.
- `description` (string) y `entry_date` (date/datetime).
- `active` (boolean): evita usar asientos anulados.

### transfers
- `id` y `company_id` (int) bajo el mismo alcance.
- `from_account_id` / `to_account_id` (int): cuentas de origen/destino; sin FOREIGN KEY.
- `amount` (decimal): valor positivo del movimiento.
- `currency` (string) y `reference` (string) opcionales.
- `status` (string): `draft`, `posted` o `void` para controlar si genera asientos.
- `active` (boolean) y `transfer_date` (date/datetime).

## Alcance por compañía y validaciones
- **Scope obligatorio:** toda consulta o mutación filtra por `company_id`, salvo el super usuario (ID=1) que opera sin filtro.
- **Unicidad lógica:** `accounts.code`, combinada con `company_id`, debe ser única; las transferencias y asientos solo combinan registros dentro de la misma compañía.
- **Estado activo:** rechazar operaciones sobre `active = false` para cuentas o asientos; solo el super usuario puede ignorar este check.
- **Montos positivos:** `amount` en `accounting_entries` y `transfers` siempre es mayor a cero; el sentido se define con `entry_type` o la dirección de las cuentas.
- **Sin FOREIGN KEY:** la integridad se controla a nivel de aplicación/servicio, nunca con claves foráneas en la base `sisa.api`.

## Paginación segura
- Utiliza paginación basada en parámetros explícitos (`page` y `per_page` o `limit`/`offset`) y orden determinista (`created_at DESC` o `id DESC`).
- Devuelve `total` o `total_count` para que el cliente sepa cuántas páginas hay.
- Nunca confíes en auto-incrementos cruzados entre compañías; el super usuario puede ver todo pero debe mantener el mismo ordenamiento.

## Ejemplos de endpoints

### /accounts
- **GET /accounts** (paginado y filtrado por compañía)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Ejemplo: `/accounts?company_id=10&page=1&per_page=20&active=1`
  - Respuesta:
  ```json
  {
    "data": [
      {"id": 18, "company_id": 10, "code": "CAJA-001", "name": "Caja principal", "active": true, "current_balance": 15400.00},
      {"id": 19, "company_id": 10, "code": "BANCO-USD", "name": "Cuenta USD", "active": true, "current_balance": 9800.50}
    ],
    "page": 1,
    "per_page": 20,
    "total": 2
  }
  ```
- **POST /accounts** (creación)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Body:
  ```json
  {
    "company_id": 10,
    "code": "CAJA-001",
    "name": "Caja principal",
    "active": true
  }
  ```
  - Respuesta (201):
  ```json
  {"id": 18, "company_id": 10, "code": "CAJA-001", "name": "Caja principal", "active": true}
  ```

### /transfers
- **GET /transfers** (paginado)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Ejemplo: `/transfers?company_id=10&page=1&per_page=10&status=posted`
  - Respuesta:
  ```json
  {
    "data": [
      {
        "id": 33,
        "company_id": 10,
        "from_account_id": 18,
        "to_account_id": 19,
        "amount": 1200.00,
        "status": "posted",
        "transfer_date": "2024-06-01"
      }
    ],
    "page": 1,
    "per_page": 10,
    "total": 1
  }
  ```
- **POST /transfers** (creación y generación de asientos)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Body:
  ```json
  {
    "company_id": 10,
    "from_account_id": 18,
    "to_account_id": 19,
    "amount": 1200.00,
    "currency": "USD",
    "reference": "Transferencia a cuenta USD",
    "status": "posted"
  }
  ```
  - Respuesta (201) con enlace lógico de origen:
  ```json
  {
    "id": 33,
    "company_id": 10,
    "status": "posted",
    "origin_entry_ids": [210, 211]
  }
  ```

### /accounting-entries
- **GET /accounting-entries** (paginado, con control de compañía y activo)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Ejemplo: `/accounting-entries?company_id=10&page=1&per_page=25&origin_type=transfer&origin_id=33`
  - Respuesta:
  ```json
  {
    "data": [
      {
        "id": 210,
        "company_id": 10,
        "account_id": 18,
        "entry_type": "credit",
        "amount": 1200.00,
        "origin_type": "transfer",
        "origin_id": 33,
        "description": "Salida de caja",
        "entry_date": "2024-06-01",
        "active": true
      },
      {
        "id": 211,
        "company_id": 10,
        "account_id": 19,
        "entry_type": "debit",
        "amount": 1200.00,
        "origin_type": "transfer",
        "origin_id": 33,
        "description": "Ingreso a cuenta USD",
        "entry_date": "2024-06-01",
        "active": true
      }
    ],
    "page": 1,
    "per_page": 25,
    "total": 2
  }
  ```
- **POST /accounting-entries** (asiento manual o vinculado)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Body:
  ```json
  {
    "company_id": 10,
    "account_id": 18,
    "entry_type": "debit",
    "amount": 500.00,
    "origin_type": "manual-adjustment",
    "origin_id": null,
    "description": "Ajuste de reapertura",
    "entry_date": "2024-06-05",
    "active": true
  }
  ```
  - Reglas: `amount` > 0, `entry_type` define el signo, y `origin_type`/`origin_id` documentan el vínculo sin FOREIGN KEY.

> Nota: cualquier endpoint que incluya `company_id` puede omitirse para el super usuario (ID=1); aun así, los ejemplos mantienen el parámetro para mantener consistencia y paginación segura.
