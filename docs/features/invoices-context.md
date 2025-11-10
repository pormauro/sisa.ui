# Contexto de facturación en la app móvil

Este documento describe cómo la aplicación Expo sincroniza el módulo de Facturación con `sisa.api`, cómo se persiste la caché local y de qué manera se normalizan los ítems y totales calculados sin depender de claves foráneas.

## Sincronización y caché local
- `InvoicesProvider` mantiene la colección en memoria utilizando `useCachedState('invoices', [])` y reordena automáticamente por fecha de emisión o creación para evitar saltos en la interfaz al volver desde formularios.【F:contexts/InvoicesContext.tsx†L397-L404】
- El método `loadInvoices()` ejecuta `GET /invoices` con encabezado `Authorization: Bearer`, valida la sesión mediante `ensureAuthResponse` y sobrescribe la caché con la respuesta ordenada del backend.【F:contexts/InvoicesContext.tsx†L405-L438】

## Operaciones expuestas
- `addInvoice(payload)` serializa IDs numéricos, adjuntos e ítems antes de llamar a `POST /invoices`. Además persiste montos parciales (`subtotal_amount`, `tax_amount`, `total_amount`) y fechas (`invoice_date`, `due_date`), normalizando el campo `currency_code` para respetar el contrato del backend. Ante respuestas parciales vuelve a consultar el listado para mantener la caché alineada con la base sin claves foráneas.【F:contexts/InvoicesContext.tsx†L440-L514】
- `updateInvoice(id, payload)` reutiliza la normalización anterior y acepta respuestas que sólo confirman la actualización. Después de cada cambio refresca el listado remoto para evitar divergencias en montos, estados o secuencias de ítems.【F:contexts/InvoicesContext.tsx†L516-L583】
- `deleteInvoice(id)` ejecuta `DELETE /invoices/{id}` filtrando la factura local y re-sincronizando el listado. Consume el cuerpo opcional sólo si la respuesta es JSON y maneja expiraciones del token sin interrumpir la navegación.【F:contexts/InvoicesContext.tsx†L585-L628】
- `voidInvoice(id, reason)` invoca `POST /invoices/{id}/void`, interpreta respuestas con o sin objeto `invoice` y actualiza el estado local a `void` antes de volver a sincronizarse.【F:contexts/InvoicesContext.tsx†L630-L699】

## Normalización sin claves foráneas
- El parser interno convierte arreglos, cadenas JSON y listados separados por coma en un array de `job_ids` numéricos para mantener compatibilidad con integraciones previas, aun cuando los formularios ya no generan ítems desde trabajos seleccionados.【F:contexts/InvoicesContext.tsx†L76-L156】
- Al preparar payloads se normalizan los ítems (`items`) calculando cantidades, descuentos, impuestos y posiciones (`order_index`), además de limpiar referencias opcionales (`product_id`, `invoice_id`). Los metadatos se preservan sólo cuando contienen valores definidos.【F:contexts/InvoicesContext.tsx†L333-L395】
- `utils/invoiceItems.ts` centraliza el cálculo de subtotal, impuestos y total, así como la serialización de cada ítem para evitar datos inválidos en la API sin claves foráneas.【F:utils/invoiceItems.ts†L1-L163】

## Consumo en la interfaz
- El listado de `/invoices` usa el contexto para refrescar al hacer pull-to-refresh, validar permisos (`listInvoices`, `voidInvoice`) y mostrar acciones inmediatas de anulación, manteniendo oculto el FAB cuando falta `addInvoice`. También prioriza la `invoice_date` al mostrar la fecha formateada.【F:app/invoices/index.tsx†L59-L212】
- La pantalla de creación verifica `addInvoice`, solicita mínimo el número de factura, cliente y un ítem válido, expone el campo de número de factura directamente en el encabezado y mantiene secciones colapsables sólo para metadatos y notas adicionales, calculando subtotal, impuestos y total en vivo antes de invocar al contexto.【F:app/invoices/create.tsx†L1-L310】
- El formulario de edición comprueba `updateInvoice`, precarga encabezado, ítems y notas, habilita los mismos bloques colapsables y persiste los cambios mediante `updateInvoice`, manteniendo el resumen de costos sincronizado con los valores ingresados. También habilita la eliminación cuando el perfil cuenta con `deleteInvoice` y confirma el resultado antes de volver al listado.【F:app/invoices/[id].tsx†L1-L596】

## Permisos y colección de Postman
- El grupo "Invoices" en la pantalla de permisos permite asignar `listInvoices`, `addInvoice`, `updateInvoice`, `deleteInvoice`, `voidInvoice`, `issueInvoice`, `downloadInvoicePdf` y `listInvoiceHistory`, manteniendo coherencia con la colección compartida de Postman para auditorías.【F:app/permission/PermissionScreen.tsx†L20-L45】
- Cada petición al backend se ejecuta con token Bearer activo, en línea con las políticas globales documentadas para `sisa.api`.【F:contexts/InvoicesContext.tsx†L411-L628】
