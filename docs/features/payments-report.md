# Reporte de comprobantes de pagos

El backend expone un endpoint dedicado a generar un PDF con los comprobantes marcados como factura real (`is_invoice: true`) adjuntos a pagos dentro de un rango temporal. El flujo se mueve completamente al módulo de **pagos**, centralizando permisos y auditoría lejos de `InvoicesController`.

## Endpoint y autenticación
- **Ruta:** `POST /payments/report/pdf`.
- **Autenticación:** encabezado `Authorization: Bearer <token>` obligatorio (el login sigue siendo la única excepción pública).
- **Permiso requerido:** `generatePaymentReport`.
- **Cuerpo esperado:** fechas en formato `YYYY-MM-DD`.

```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

El backend completa el inicio y cierre de cada día antes de procesar el reporte.

## Respuesta y manejo de resultados
- Si existen pagos con adjuntos marcados como factura real, la API crea el PDF dentro de `uploads/reports/` y devuelve el identificador de archivo junto con la URL de descarga.
- Además, se envía una notificación al usuario solicitante con el enlace listo para abrir desde el centro de notificaciones.

```json
{
  "message": "Payment invoice report generated successfully",
  "file_id": 222,
  "download_url": "/files/222"
}
```

Cuando el rango no devuelve pagos ni adjuntos válidos, el servicio responde con `404` y un mensaje descriptivo para evitar reportes vacíos.

## Formato del PDF
- Incluye toda la metadata disponible del pago: fecha, importe, cuenta de pago, categoría, tipo de acreedor, cliente asociado y detalle.
- Cada comprobante se renderiza sin saltos internos (`page-break-inside: avoid`) y con márgenes reducidos.
- Las imágenes usan `object-fit: contain`, borde suave y sombra ligera para mejorar la legibilidad.
- Se utiliza la fuente **DejaVu Sans** junto con el parser HTML5 de Dompdf para preservar caracteres especiales.

> Requisito: la librería [`dompdf/dompdf`](https://github.com/dompdf/dompdf) debe estar instalada en el servidor.
