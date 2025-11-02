# Pagos vs. plantillas de pago

Este documento resume las diferencias entre los pagos operativos y las plantillas de pago reutilizables, así como los flujos de sincronización que emplea cada módulo en la aplicación.

## Modelos y propósito

- **Pagos (`PaymentsContext`)** representan movimientos financieros efectivos. Cada registro incluye fecha, cuenta de salida, acreedor (cliente/proveedor/otro), categoría, monto, adjuntos serializados y banderas para imputar a clientes.【F:contexts/PaymentsContext.tsx†L14-L30】
- **Plantillas de pago (`PaymentTemplatesContext`)** almacenan valores predeterminados para acelerar la captura de pagos: acreedor sugerido, categoría, cuenta contable, monto esperado y banderas de imputación al cliente.【F:contexts/PaymentTemplatesContext.tsx†L15-L37】

Ambos contextos se inicializan con `useCachedState` para persistir datos localmente y ordenar por las entradas más recientes antes de exponerlos a la UI.【F:contexts/PaymentsContext.tsx†L48-L54】【F:contexts/PaymentTemplatesContext.tsx†L57-L66】

## Diferencias funcionales en la UI

- El listado de pagos ofrece búsqueda y acciones directas sobre los registros confirmados, además de proteger el acceso según los permisos `listPayments`, `addPayment`, `updatePayment` y `deletePayment`.【F:app/payments/index.tsx†L61-L187】
- El catálogo de plantillas permite ordenar por fecha, nombre o monto predeterminado, refresca datos cuando la pantalla recupera foco y condiciona cada acción a los permisos `listPaymentTemplates`, `addPaymentTemplate`, `updatePaymentTemplate` y `deletePaymentTemplate`.【F:app/payment_templates/index.tsx†L78-L187】
- Los formularios de plantillas exponen selectores inteligentes para categorías, cuentas, clientes y proveedores, habilitando derivaciones hacia los módulos correspondientes cuando se crea un nuevo registro relacionado.【F:app/payment_templates/create.tsx†L40-L400】
- La vista modal de una plantilla permite saltar a la edición solo si el usuario mantiene `updatePaymentTemplate`, reforzando la separación entre consulta y mantenimiento.【F:app/payment_templates/viewModal.tsx†L31-L139】

## Flujos de sincronización

- `PaymentsContext` consulta `/payments` al inicializarse y después de cada alta/actualización para garantizar que la caché local refleje el estado definitivo del backend.【F:contexts/PaymentsContext.tsx†L56-L140】
- `PaymentTemplatesContext` también arranca con un `loadPaymentTemplates()` cuando existe un token válido y repite la sincronización tras cada operación mutadora (`add`, `update`, `delete`).【F:contexts/PaymentTemplatesContext.tsx†L68-L224】
- La pantalla de listado de plantillas refuerza la sincronización mediante `useFocusEffect`, recargando el catálogo cada vez que el usuario vuelve a la vista si mantiene permisos suficientes.【F:app/payment_templates/index.tsx†L96-L187】

En todos los casos se exige el encabezado `Authorization: Bearer <token>` para las peticiones, preservando la política de autenticación que exceptúa únicamente el flujo de login.【F:contexts/PaymentsContext.tsx†L56-L158】【F:contexts/PaymentTemplatesContext.tsx†L68-L206】

## Trabajar a partir de plantillas

Las plantillas sirven como referencia para completar los formularios de pagos. Aunque los pagos no aplican automáticamente una plantilla hoy, los usuarios pueden revisar una plantilla, validar los valores sugeridos y crear un pago manualmente en el módulo financiero.

Para replicar un pago a partir de una plantilla:

1. Consulta el detalle desde el catálogo de plantillas y revisa montos, categoría, acreedor y banderas de imputación.【F:app/payment_templates/viewModal.tsx†L80-L139】
2. Dirígete al módulo de pagos (`/payments`) usando el acceso directo del menú o de la sección de Atajos para cargar un nuevo pago con esos valores.【F:constants/menuSections.ts†L26-L35】【F:app/payments/create.tsx†L160-L207】

Esta separación mantiene la base de datos sin `FOREIGN KEY` y evita operaciones automáticas hasta que el backend defina un flujo específico para instanciar pagos desde plantillas.
