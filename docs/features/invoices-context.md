# Contexto de facturación en la app móvil

Este documento describe cómo la aplicación Expo sincroniza el módulo de Facturación con `sisa.api`, cómo se persiste la caché local y de qué manera se normalizan los ítems y totales calculados sin depender de claves foráneas.

## Sincronización y caché local
- `InvoicesProvider` mantiene la colección en memoria utilizando `useCachedState('invoices', [])` y reordena automáticamente por fecha de emisión o creación para evitar saltos en la interfaz al volver desde formularios.【F:contexts/InvoicesContext.tsx†L397-L404】
- El método `loadInvoices()` ejecuta `GET /invoices` con encabezado `Authorization: Bearer`, valida la sesión mediante `ensureAuthResponse` y sobrescribe la caché con la respuesta ordenada del backend.【F:contexts/InvoicesContext.tsx†L405-L438】

## Operaciones expuestas
- `addInvoice(payload)` serializa IDs numéricos, adjuntos e ítems antes de llamar a `POST /invoices`. Además normaliza montos (`subtotal_amount`, `tax_amount`, `total_amount`) y fechas (`invoice_date`, `due_date`), interpreta respuestas sin cuerpo JSON mediante `parseJsonSafely`, reutiliza encabezados `Location`/`invoice_id` y vuelve a consultar el listado para mantener la caché alineada con la base sin claves foráneas.【F:contexts/InvoicesContext.tsx†L603-L651】
- `updateInvoice(id, payload)` reutiliza la normalización anterior, admite respuestas mínimas generando un fallback con los datos enviados y siempre refresca el listado remoto para evitar divergencias en montos, estados o secuencias de ítems.【F:contexts/InvoicesContext.tsx†L665-L716】
- `deleteInvoice(id)` ejecuta `DELETE /invoices/{id}` filtrando la factura local y re-sincronizando el listado. Consume el cuerpo opcional sólo si la respuesta es JSON y maneja expiraciones del token sin interrumpir la navegación.【F:contexts/InvoicesContext.tsx†L730-L770】
- `voidInvoice(id, reason)` invoca `POST /invoices/{id}/void`, interpreta respuestas con o sin objeto `invoice`, genera un fallback cuando el backend sólo confirma el cambio y actualiza el estado local a `canceled` antes de volver a sincronizarse.【F:contexts/InvoicesContext.tsx†L775-L829】

## Normalización sin claves foráneas
- El parser interno convierte arreglos, cadenas JSON y listados separados por coma en un array de `job_ids` numéricos para mantener compatibilidad con integraciones previas, aun cuando los formularios ya no generan ítems desde trabajos seleccionados.【F:contexts/InvoicesContext.tsx†L76-L156】
- Al preparar payloads se normalizan los ítems (`items`) calculando cantidades, descuentos, impuestos y posiciones (`order_index`), además de limpiar referencias opcionales (`product_id`, `invoice_id`). Los metadatos se preservan sólo cuando contienen valores definidos.【F:contexts/InvoicesContext.tsx†L333-L395】
- `utils/invoiceItems.ts` centraliza el cálculo de subtotal, impuestos y total, así como la serialización de cada ítem para evitar datos inválidos en la API sin claves foráneas.【F:utils/invoiceItems.ts†L1-L163】

## Consumo en la interfaz
- El listado de `/invoices` usa el contexto para refrescar al hacer pull-to-refresh, validar permisos (`listInvoices`, `voidInvoice`) y mostrar acciones inmediatas de anulación, manteniendo oculto el FAB cuando falta `addInvoice`. También prioriza la `invoice_date` al mostrar la fecha formateada.【F:app/invoices/index.tsx†L59-L212】
- La pantalla de creación verifica `addInvoice`, exige cliente y al menos un ítem válido, deja el número de factura como opcional hasta la emisión definitiva, permite adjuntar archivos reutilizando `FileGallery` y calcula subtotal, impuestos y total en vivo, aplicando porcentajes globales de impuestos cuando se ingresan en la sección de metadatos.【F:app/invoices/create.tsx†L1-L820】
- El formulario de edición comprueba `updateInvoice`, precarga encabezado, ítems, adjuntos y notas, habilita los mismos bloques colapsables y persiste los cambios mediante `updateInvoice`, manteniendo el resumen de costos sincronizado con los valores ingresados o con el porcentaje global de impuestos cuando se completa. También habilita la eliminación cuando el perfil cuenta con `deleteInvoice` y confirma el resultado antes de volver al listado.【F:app/invoices/[id].tsx†L1-L760】

## Permisos y colección de Postman
- El grupo "Invoices" en la pantalla de permisos permite asignar `listInvoices`, `addInvoice`, `updateInvoice`, `deleteInvoice`, `voidInvoice`, `issueInvoice`, `downloadInvoicePdf` y `listInvoiceHistory`, manteniendo coherencia con la colección compartida de Postman para auditorías.【F:app/permission/PermissionScreen.tsx†L20-L45】
- Cada petición al backend se ejecuta con token Bearer activo, en línea con las políticas globales documentadas para `sisa.api`.【F:contexts/InvoicesContext.tsx†L562-L829】
