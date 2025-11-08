# Contexto de facturación en la app móvil

Este documento describe cómo la aplicación Expo sincroniza el módulo de Facturación con `sisa.api`, cómo se persiste la caché local y de qué manera se resuelven las referencias a trabajos sin utilizar claves foráneas.

## Sincronización y caché local
- `InvoicesProvider` mantiene la colección en memoria utilizando `useCachedState('invoices', [])` y reordena automáticamente por fecha de emisión o creación para evitar saltos en la interfaz al volver desde formularios.【F:contexts/InvoicesContext.tsx†L397-L404】
- El método `loadInvoices()` ejecuta `GET /invoices` con encabezado `Authorization: Bearer`, valida la sesión mediante `ensureAuthResponse` y sobrescribe la caché con la respuesta ordenada del backend.【F:contexts/InvoicesContext.tsx†L405-L438】

## Operaciones expuestas
- `addInvoice(payload)` serializa IDs numéricos, adjuntos y conceptos antes de llamar a `POST /invoices`. Ante respuestas parciales, vuelve a consultar el listado para mantener la caché alineada con la base sin claves foráneas.【F:contexts/InvoicesContext.tsx†L440-L503】
- `updateInvoice(id, payload)` reutiliza la normalización anterior y acepta respuestas que sólo confirman la actualización. Después de cada cambio refresca el listado remoto para evitar divergencias en montos o estados.【F:contexts/InvoicesContext.tsx†L505-L566】
- `voidInvoice(id, reason)` invoca `POST /invoices/{id}/void`, interpreta respuestas con o sin objeto `invoice` y actualiza el estado local a `void` antes de volver a sincronizarse.【F:contexts/InvoicesContext.tsx†L568-L628】

## Mapeo de trabajos sin claves foráneas
- El parser interno convierte arreglos, cadenas JSON y listados separados por coma en un array de `job_ids` numéricos, ya que la base `sisa.api` sólo expone identificadores planos.【F:contexts/InvoicesContext.tsx†L76-L156】
- Al preparar payloads se vuelven a serializar los IDs y se limpian los conceptos (cantidad, precio unitario, `job_id`) para evitar inconsistencias con datos de versiones anteriores o campos opcionales.【F:contexts/InvoicesContext.tsx†L333-L395】【F:contexts/InvoicesContext.tsx†L118-L212】

## Consumo en la interfaz
- Desde la vista "Trabajos no facturados" (`/clients/finalizedJobs`) se habilita un panel de acciones cuando el usuario cuenta con `listInvoices` y `addInvoice`. La selección de trabajos viaja como parámetro hacia `/invoices` y `/invoices/create`, lo que precarga cliente, IDs y totales calculados con `calculateJobTotal` antes de confirmar la facturación o la vinculación con comprobantes existentes.【F:app/clients/finalizedJobs.tsx†L24-L247】【F:app/invoices/create.tsx†L1-L219】【F:app/invoices/index.tsx†L1-L220】【F:app/invoices/[id].tsx†L1-L255】
- El listado de `/invoices` usa el contexto para refrescar al hacer pull-to-refresh, validar permisos (`listInvoices`, `voidInvoice`) y mostrar acciones inmediatas de anulación, manteniendo oculto el FAB cuando falta `addInvoice`.【F:app/invoices/index.tsx†L59-L212】
- La pantalla de creación verifica `addInvoice`, transforma números de cliente y trabajos antes de llamar a `addInvoice`, oculta el botón principal si falta el permiso y redirige al listado al completar.【F:app/invoices/create.tsx†L59-L140】【F:app/invoices/create.tsx†L240-L293】
- El formulario de edición comprueba `updateInvoice`, precarga datos normalizados desde el contexto, esconde la acción de guardado cuando no hay permiso y persiste los cambios con `updateInvoice` manteniendo la navegación intacta.【F:app/invoices/[id].tsx†L87-L207】【F:app/invoices/[id].tsx†L312-L386】
- Ambas pantallas (creación y edición) incluyen un editor de conceptos que permite agregar, quitar o regenerar ítems desde los trabajos seleccionados, calculando automáticamente el total y validando que al menos un concepto tenga cantidad y precio antes de enviar el payload.【F:app/invoices/create.tsx†L137-L356】【F:app/invoices/[id].tsx†L196-L449】
- `utils/invoiceItems.ts` centraliza la normalización de cantidades, precios y referencias a trabajos para que las pantallas y el contexto compartan la misma lógica de serialización, evitando datos inválidos en la API sin claves foráneas.【F:utils/invoiceItems.ts†L1-L121】

## Permisos y colección de Postman
- El grupo "Invoices" en la pantalla de permisos permite asignar `listInvoices`, `addInvoice`, `updateInvoice`, `voidInvoice`, `issueInvoice`, `downloadInvoicePdf` y `listInvoiceHistory`, manteniendo coherencia con la colección compartida de Postman para auditorías.【F:app/permission/PermissionScreen.tsx†L20-L45】
- Cada petición al backend se ejecuta con token Bearer activo, en línea con las políticas globales documentadas para `sisa.api`.【F:contexts/InvoicesContext.tsx†L411-L628】
