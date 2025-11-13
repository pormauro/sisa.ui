# Invoices API

La API de facturación centraliza la emisión, control y auditoría de comprobantes electrónicos del ecosistema SISA. Esta guía cubre la autenticación obligatoria, permisos requeridos, endpoints disponibles y el seguimiento histórico que respalda los procesos de auditoría interna.

## Autenticación y convenciones globales
- Todas las solicitudes hacia la API requieren el encabezado `Authorization: Bearer <token>` emitido durante el inicio de sesión. El login continúa siendo la única ruta pública; el resto de los endpoints descritos en esta guía **no aceptan** llamadas sin token válido.
- La base de datos `sisa.api` mantiene la política de **no utilizar claves foráneas**. Los enlaces entre facturas, clientes, trabajos y recibos se resuelven en la capa de aplicación, consumiendo únicamente los identificadores expuestos por la API.

## Permisos y asignación en la app
- `listInvoices`: habilita el acceso al módulo y la visibilidad del listado de facturas dentro del menú de Facturación.
- `addInvoice`: permite emitir nuevas facturas y plantillas de ítems.
- `updateInvoice`: autoriza la edición de datos fiscales, ítems y adjuntos antes de su publicación final.
- `voidInvoice`: habilita la anulación de comprobantes emitidos, conservando el registro histórico.
- `downloadInvoicePdf`: da acceso a la descarga de archivos PDF o representaciones digitales.

Cuando se cree una nueva sección en la app que consuma estos endpoints, debe agregarse explícitamente a la configuración de permisos para mantener el alineamiento con el resto del ecosistema.

## Endpoints principales
### Listado y detalle
- `GET /invoices`: retorna la colección paginada de facturas con filtros por estado (`draft`, `issued`, `paid`, `canceled`) y rangos de fechas. Incluye referencias a clientes y trabajos mediante sus identificadores internos.
- `GET /invoices/{id}`: provee el detalle completo del comprobante, incluyendo ítems normalizados, impuestos calculados y metadatos de emisión.

### Operaciones de emisión y actualización
- `POST /invoices`: crea una factura en estado `draft`, validando que los ítems incluyan montos y referencias opcionales a productos, trabajos o clientes mediante sus IDs (sin constraints en la base). El campo `attached_files` acepta un arreglo de IDs de archivos ya cargados y los impuestos (`tax_amount`/`tax_percentage`) pueden calcularse automáticamente en la app a partir de un porcentaje global, además de vincular los `job_ids` seleccionados para actualizar sus estados.
- `PUT /invoices/{id}`: actualiza datos de encabezado, ítems o totales siempre que la factura siga en `draft`.
- `POST /invoices/{id}/issue`: cambia el estado a `issued`, registra el número fiscal definitivo y emite el comprobante electrónico asociado.
- La pantalla de edición de facturas en la app móvil expone un botón "Emitir factura" que confirma la acción con el usuario y luego llama a este endpoint con los campos opcionales `invoice_number` y `issue_date` que estuvieran cargados.【F:app/invoices/[id].tsx†L678-L940】

### Manejo directo de ítems
- Cada payload acepta la clave `items` (o `concepts`, para compatibilidad retroactiva) con objetos `{ description, quantity, unit_price, discount_amount, tax_amount, product_id, order_index }`. La UI normaliza las cifras antes de enviarlas, manteniendo la compatibilidad con APIs que esperan enteros o strings numéricas.
- `POST /invoices/{id}/items`: agrega un ítem puntual sin reenviar la factura completa. Es ideal para sumar ajustes o tareas nuevas detectadas tras la creación inicial.
- `PUT /invoices/{id}/items/{itemId}`: modifica un ítem existente; basta enviar los campos a actualizar. La API recalcula el total y registra el evento en el historial.
- `DELETE /invoices/{id}/items/{itemId}`: elimina el ítem y deja registro en el feed de auditoría.
- Los totales se recalculan automáticamente en el backend y deben reflejarse en `subtotal_amount`, `tax_amount` y `total_amount`. La app móvil re-sincroniza después de cada operación para mantener alineada la caché local.
- La colección de Postman incorpora ejemplos listos para usar en la carpeta **Facturación**, con cuerpos de ejemplo y encabezados Bearer preconfigurados.

### Anulación y regeneración de archivos
- `POST /invoices/{id}/void`: marca la factura como cancelada conservando el historial y dejando constancia del usuario responsable.
- `POST /invoices/{id}/regenerate_pdf`: fuerza la reconstrucción del PDF en caso de modificaciones sobre datos auxiliares permitidos tras la emisión.

Todas las operaciones anteriores deben ejecutarse con el encabezado Bearer activo. Los payloads aceptan arrays de ítems y referencias por identificador; la integridad referencial se valida mediante reglas de negocio, nunca mediante claves foráneas en la base de datos.

## Historial y auditoría
- `GET /invoices/{id}/history`: devuelve la secuencia cronológica de eventos (creación, ediciones, emisión, anulaciones, regeneraciones), cada uno con `timestamp`, usuario y payload asociado.
- El historial se muestra en un modal dentro de la app reutilizando este endpoint, por lo que es importante mantener la compatibilidad con respuestas `history`, `data` o arreglos planos para que el parser pueda normalizarlas.【F:app/invoices/[id].tsx†L678-L940】【F:contexts/InvoicesContext.tsx†L883-L915】
- `GET /invoices/history`: expone un feed global filtrable por usuario, rango temporal o tipo de evento, útil para auditorías cruzadas con otros módulos financieros.

Los eventos almacenan la huella completa del request (incluyendo encabezados relevantes, valores previos y cambios aplicados) para simplificar inspecciones posteriores. Al no contar con claves foráneas, la API adjunta copias de los identificadores originales y una instantánea de los datos principales de cliente y trabajo al momento del evento, garantizando que el historial se mantenga consistente aunque se eliminen registros relacionados.

## Consideraciones de auditoría y registros complementarios
- Cada factura guarda metadatos `created_by`, `updated_by`, `issued_by` y `voided_by` (o `canceled_by`) con los identificadores de usuario que originaron la acción. La aplicación debe enviar siempre esos identificadores en el payload o permitir que el backend los infiera desde el token Bearer.
- Los adjuntos (XML, PDF, recibos) se vinculan mediante rutas absolutas entregadas por el servicio de archivos. Al no existir claves foráneas, la API almacena únicamente los IDs de adjunto y el hash del archivo para validar integridad.
- Se recomienda consumir el endpoint de historial en revisiones periódicas y registrar los resultados en la colección de Postman del servidor cuando se actualicen flujos o se agreguen nuevos eventos.

Mantén esta documentación actualizada cada vez que se añadan campos o endpoints a la API de facturación para asegurar que el resto de los equipos adopte correctamente las convenciones de autenticación Bearer y la arquitectura sin claves foráneas.
