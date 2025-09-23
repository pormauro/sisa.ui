# Propuesta de secciones del menú principal

El menú principal ahora se organiza en secciones plegables para facilitar la ubicación de los módulos operativos y contables. Cada sección agrupa accesos con afinidad funcional. A continuación se detallan los botones incluidos, sus rutas y los permisos requeridos para que se muestren en pantalla.

## Gestión financiera
- **Recibos** — Ruta: `/receipts`. Permiso: `listReceipts`.
- **Pagos** — Ruta: `/payments`. Permiso: `listPayments`.
- **Cajas** — Ruta: `/cash_boxes`. Permiso: `listCashBoxes`.
- **Categorías contables** — Ruta: `/categories`. Permiso: `listCategories`.

## Catálogos comerciales
- **Clientes** — Ruta: `/clients`. Permiso: `listClients`.
- **Proveedores** — Ruta: `/providers`. Permiso: `listProviders`.
- **Productos y servicios** — Ruta: `/products_services`. Permiso: `listProductsServices`.
- **Tarifas** — Ruta: `/tariffs`. Permiso: `listTariffs`.

## Operaciones
- **Trabajos** — Ruta: `/jobs`. Permiso: `listJobs`.
- **Agenda** — Ruta: `/appointments`. Permiso: `listAppointments`.
- **Carpetas** — Ruta: `/folders`. Permiso: `listFolders`.
- **Estados** — Ruta: `/statuses`. Permiso: `listStatuses`.

## Configuración y perfil
- **Perfil** — Ruta: `/user/ProfileScreen`. Disponible para todos los usuarios autenticados.
- **Configuración** — Ruta: `/user/ConfigScreen`. Disponible para todos los usuarios autenticados.
- **Comentarios** — Ruta: `/comments`. Permiso: `listComments` (muestra envío propio; el permiso `respondComment` habilita la bandeja global).
- **Permisos** — Ruta: `/permission`. Permiso: `listPermissions` (siempre visible para el usuario maestro con `userId === '1'`).

> Esta propuesta queda sujeta a revisión y ajustes según las prioridades que defina el usuario final antes de cerrar la entrega.
