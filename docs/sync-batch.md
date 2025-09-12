# Sync Batch API

Este documento describe el uso del endpoint `POST /sync/batch` para aplicar múltiples operaciones de sincronización en una sola llamada.

## Campos del batch

- **`batch_id`**: identificador único del lote. Debe ser un UUID v4.
- **`since_history_id`**: (opcional) último `id` procesado de `sync_history` desde el cual se desean obtener cambios.
- **`ops`**: arreglo de operaciones a ejecutar.

### Estructura de cada operación (`ops`)

Cada elemento dentro de `ops` debe incluir:

- **`entity`**: nombre de la entidad a manipular (por ejemplo, `clients`).
- **`action`**: tipo de operación, puede ser `create`, `update` o `delete`.
- **`id`**: identificador del registro cuando aplica.
- **`local_id`**: identificador local generado por el cliente. Debe ser un UUID v4.
- **`request_id`**: identificador único de la operación. Debe ser un UUID v4.
- **`data`**: objeto con los campos a crear o actualizar.
- **`depends`**: (opcional) arreglo de `id` de otras operaciones que deben ejecutarse previamente.

## Respuesta

La respuesta siempre incluye un campo `status`:

- `ok`: el lote fue procesado correctamente.
- `duplicate`: el `batch_id` ya fue recibido anteriormente.

## Ejemplo para `clients`

```http
POST /sync/batch HTTP/1.1
Host: api.example.com
Content-Type: application/json
Idempotency-Key: 3a6f0d05-1b6d-41a7-b5f8-50ff2f0e7d4a

{
  "batch_id": "44b14887-85c9-4231-b8e3-8a1c1d8c0001",
  "since_history_id": null,
  "ops": [
    {
      "id": "c1",
      "entity": "clients",
      "action": "create",
      "local_id": "31b613c7-f148-4b8e-9336-00e9cdfe690a",
      "request_id": "c49f1cb9-a97e-452e-b8fd-a55fa5d523ec",
      "data": {
        "business_name": "ACME Corp",
        "tax_id": "A-1234567",
        "email": "info@acme.com",
        "phone": "123456",
        "address": "Main Street 1",
        "tariff_id": null
      }
    }
  ]
}
```

Respuesta:

```json
{ "status": "ok" }
```

## Requisitos de base de datos (`sisa.api`)

El sistema debe contar con las siguientes tablas **sin restricciones de FOREIGN KEY**:

- **`sync_batches`**: `batch_id`, `payload`, `status`, `created_at`, `updated_at`.
- **`sync_items`**: `batch_id`, `entity`, `entity_id`, `hash`, `payload`, `status`, `created_at`, `updated_at`.
- **`sync_history`**: `entity`, `entity_id`, `batch_id`, `payload`, `created_at`.

## Idempotencia

Es obligatorio enviar el encabezado `Idempotency-Key` en cada solicitud y tanto `local_id` como `request_id` deben generarse usando UUID v4 para garantizar operaciones idempotentes.
