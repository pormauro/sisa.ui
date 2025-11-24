# API de reportes

Esta sección describe los endpoints de la tabla `reports` expuestos por `sisa.api` y su uso en la app móvil. Todos los endpoints requieren autenticación por token Bearer (excepto el login) y mantienen la política de operar sin claves foráneas.

## Listar reportes
- **Ruta:** `GET /reports`
- **Filtros opcionales:** `report_type`, `status`, `file_id`, `search`.
- **Estados válidos:** `draft`, `generated`, `archived`.
- **Respuesta esperada:** colección de metadatos de reportes. La app normaliza campos `metadata` entregados como JSON o cadena.

## Obtener reporte por ID
- **Ruta:** `GET /reports/{id}`.
- **Detalle:** devuelve el reporte indicado incluyendo `metadata` en formato JSON cuando corresponda.

## Historial del reporte
- **Ruta:** `GET /reports/{id}/history`.
- **Detalle:** retorna la secuencia de operaciones (`CREATION`, `UPDATE`, `DELETION`) almacenada en `reports_history`.

## Crear reporte
- **Ruta:** `POST /reports`.
- **Campos obligatorios:** `file_id`, `title`, `report_type`.
- **Opcionales:** `description`, `status` (`draft`, `generated`, `archived`), `metadata` (JSON válido).
- **Ejemplo:**
  ```json
  {
    "file_id": 15,
    "title": "Reporte de finanzas Q2",
    "report_type": "finanzas",
    "description": "Resumen de ingresos y egresos",
    "status": "generated",
    "metadata": {"period": "2025-Q2", "currency": "USD"}
  }
  ```

## Actualizar reporte
- **Ruta:** `PUT /reports/{id}`.
- **Detalle:** solo modifica los campos enviados; `metadata` debe ser JSON válido.

## Eliminar reporte
- **Ruta:** `DELETE /reports/{id}`.
- **Detalle:** borra el registro de metadatos, conserva el historial y no elimina el archivo asociado de disco ni de la tabla `files`.

## Colección de Postman
La colección `docs/postman/sisa-api.postman_collection.json` incluye el grupo **Reportes** con todas las rutas anteriores y ejemplos de uso con token Bearer y filtros opcionales actualizados. Usa las variables `{{baseUrl}}`, `{{authToken}}` y `{{reportId}}` para probar rápidamente los flujos.
