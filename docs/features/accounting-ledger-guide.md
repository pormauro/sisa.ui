# Guía de cuentas, asientos y transferencias

Esta guía resume los esquemas de datos y el uso de los endpoints `accounts`, `accounting_entries` y `transfers` en `sisa.api`. Todos los ejemplos asumen autenticación por token Bearer (`Authorization: Bearer <token>`), salvo el login. El super usuario (ID = 1) puede saltar cualquier restricción de compañía o de estado activo. La versión alineada es la `1.3.5` definida en `config/Index.ts` y debe mantenerse sincronizada con `config/version.json` en `sisa.api`.

## Scopes de permisos
- `listAccounts` para listar cuentas.
- `addAccount` para crear cuentas.
- `addTransfer` para crear transferencias.
- `listAccountingEntries` para consultar asientos.
> Nota: el super usuario (ID=1) ignora los scopes anteriores pero el resto de perfiles debe tenerlos habilitados.

> Al crear nuevas secciones o endpoints contables, registra sus scopes en PERMISOS, actualiza los seeds correspondientes y refleja el cambio en la colección de Postman con ejemplos de autorización Bearer.

## Esquemas de tablas

### accounts
- `id` (int): identificador interno.
- `company_id` (int): ámbito obligatorio para filtrar y validar unicidad lógica.
- `code` (string): código de cuenta único por compañía.
- `name` (string): nombre legible.
- `type` (string): `asset`, `liability`, `equity`, `income` o `expense`.
- `status` (string): `active` o `inactive`.
- `balance` (decimal): saldo actual.
- `related_cashbox_id` (int, nullable): vínculo lógico con `cash_boxes` para backfill y conciliación de cajas.
- `created_at`, `updated_at` (datetime).

### accounting_entries
- `id` (int) y `company_id` (int) con el mismo alcance por compañía.
- `account_id` (int): cuenta asociada; sin FOREIGN KEY, validar existencia vía servicio.
- `entry_type` (enum): `debit` o `credit`.
- `amount` (decimal): siempre positivo; el signo lo define `entry_type`.
- `origin_type` / `origin_id` (string/int): referencia cruzada lógica (facturas, recibos, transferencias, cierres manuales). No se usa clave foránea pero se debe registrar para trazabilidad.
- `reference` (string) y `notes` (text, opcional).
- `entry_date` (date), `user_id` (int), `created_at` (datetime).

### transfers
- `id` y `company_id` (int) bajo el mismo alcance.
- `origin_account_id` / `destination_account_id` (int): cuentas de origen/destino; sin FOREIGN KEY.
- `amount` (decimal): valor positivo del movimiento.
- `transfer_date` (date), `reference` (string) y `notes` (text) opcionales.
- `user_id` (int) creador, `created_at` (datetime).

## Alcance por compañía y validaciones
- **Scope obligatorio:** toda consulta o mutación filtra por `company_id`, salvo el super usuario (ID=1) que opera sin filtro.
- **Unicidad lógica:** `accounts.code`, combinada con `company_id`, debe ser única; las transferencias y asientos solo combinan registros dentro de la misma compañía.
- **Estado activo:** transfers y asientos requieren cuentas con `status = "active"`; solo el super usuario puede ignorar esta validación.
- **Montos positivos:** `amount` en `accounting_entries` y `transfers` siempre es mayor a cero; el sentido se define con `entry_type` o la dirección de las cuentas.
- **Paginación segura:** `page` mínimo 1 y `per_page` máximo 200, ordenando por `entry_date` o `id` para resultados deterministas.
- **Sin FOREIGN KEY:** la integridad se controla a nivel de aplicación/servicio, nunca con claves foráneas en la base `sisa.api`.
- **Backfill de cajas:** los seeds deben mapear `cash_boxes` a cuentas `CASHBOX-<cash_box_id>` rellenando `related_cashbox_id` para mantener la unicidad lógica por compañía.

## Instalación y despliegues
- **install.php completo:** cualquier cambio estructural debe reflejar el esquema íntegro en `install.php` de `sisa.api`.
- **update_install.php incremental:** agrega pasos al final sin modificar los anteriores, manteniendo compatibilidad con instalaciones existentes.
- **Sin FOREIGN KEY:** aplica tanto en migraciones nuevas como en los archivos de instalación.
- **Sincronización de versión:** actualiza `config/version.json` en `sisa.api` junto con `config/Index.ts` en la UI y documenta la versión en esta guía.
- **Colección de Postman:** toda nueva operación contable debe añadirse a `docs/postman/Sistema.postman_collection.json` con ejemplos y scopes.

## Checklist de completitud funcional
- Autenticación Bearer obligatoria en todos los endpoints (excepto login), declarada en ejemplos y en la colección de Postman.
- Super usuario (ID=1) con bypass total de scopes, `company_id` y estado activo; el resto valida pertenencia de compañía antes de paginar o mutar.
- Scopes mínimos configurados y seed-eados: `listAccounts`, `addAccount`, `addTransfer`, `listAccountingEntries`, extendiendo PERMISOS cuando aparezcan nuevas secciones.
- Validaciones activas: `per_page` ≤ 200, `page` ≥ 1, montos positivos, cuentas en `status=active` y unicidad lógica `(company_id, code)` para cuentas.
- Sin FOREIGN KEY en tablas o migraciones nuevas; referencias cruzadas documentadas con `origin_type`/`origin_id`.
- Backfill de cajas respetado: cuentas `CASHBOX-<cash_box_id>` con `related_cashbox_id` y `company_id` correcto.
- Documentación y Postman actualizados a la versión en `config/Index.ts` (v1.3.5) y reflejados en `config/version.json` de `sisa.api`.

## Paginación segura
- Utiliza paginación basada en parámetros explícitos (`page` y `per_page` o `limit`/`offset`) y orden determinista (`created_at DESC` o `id DESC`).
- Devuelve `total` o `total_count` para que el cliente sepa cuántas páginas hay.
- Nunca confíes en auto-incrementos cruzados entre compañías; el super usuario puede ver todo pero debe mantener el mismo ordenamiento.

## Ejemplos de endpoints

### /accounts
- **GET /accounts** (filtrado por estado y scope de compañía)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Ejemplo: `/accounts?status=active`
  - Respuesta:
  ```json
  {
    "accounts": [
      {"id": 18, "company_id": 10, "code": "CAJA-001", "name": "Caja principal", "type": "asset", "status": "active", "balance": 15400.00, "related_cashbox_id": 3},
      {"id": 19, "company_id": 10, "code": "BANCO-USD", "name": "Cuenta USD", "type": "asset", "status": "active", "balance": 9800.50, "related_cashbox_id": null}
    ]
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
    "type": "asset",
    "status": "active"
  }
  ```
  - Respuesta (201):
  ```json
  {"account": {"id": 18, "company_id": 10, "code": "CAJA-001", "name": "Caja principal", "type": "asset", "status": "active", "current_balance": 0.00}}
  ```

### /transfers
- **POST /transfers** (creación y generación de asientos)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Body:
  ```json
  {
    "origin_account_id": 18,
    "destination_account_id": 19,
    "amount": 1200.00,
    "transfer_date": "2024-06-01",
    "description": "Transferencia a cuenta USD"
  }
  ```
  - Respuesta (201) con enlace lógico de origen:
  ```json
  {
    "transfer": {"id": 33, "origin_account_id": 18, "destination_account_id": 19, "amount": 1200.00},
    "entries": {
      "origin": {"id": 210, "account_id": 18, "entry_type": "credit", "amount": 1200.00, "origin_type": "transfer", "origin_id": 33},
      "destination": {"id": 211, "account_id": 19, "entry_type": "debit", "amount": 1200.00, "origin_type": "transfer", "origin_id": 33}
    }
  }
  ```

- **GET /accounting-entries** (paginado, con control de compañía y activo)
  - Headers: `Authorization: Bearer {{auth_token}}`
  - Ejemplo: `/accounting-entries?account_id=18&page=1&per_page=25&origin_type=transfer&origin_id=33&start_date=2024-06-01&end_date=2024-06-30`
  - Respuesta:
  ```json
  {
    "entries": [
      {
        "id": 210,
        "account_id": 18,
        "entry_type": "credit",
        "amount": 1200.00,
        "origin_type": "transfer",
        "origin_id": 33,
        "description": "Transferencia a cuenta USD",
        "entry_date": "2024-06-01",
        "user_id": 8
      },
      {
        "id": 211,
        "account_id": 19,
        "entry_type": "debit",
        "amount": 1200.00,
        "origin_type": "transfer",
        "origin_id": 33,
        "description": "Transferencia a cuenta USD",
        "entry_date": "2024-06-01",
        "user_id": 8
      }
    ],
    "pagination": {"page": 1, "per_page": 25, "total_entries": 2, "total_pages": 1},
    "totals": {"debit": 1200.00, "credit": 1200.00, "net": 0.00}
  }
  ```

> Nota: actualmente no existe `GET /transfers` ni `POST /accounting-entries` en las rutas públicas de `sisa.api`; la carga de asientos se genera a partir de transferencias y otros módulos contables.

> Nota: cualquier endpoint que incluya `company_id` puede omitirse para el super usuario (ID=1); aun así, los ejemplos mantienen el parámetro para mantener consistencia y paginación segura.
