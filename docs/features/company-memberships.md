# Membresías de empresas

Este módulo enlaza a los usuarios con las empresas que administran o necesitan consultar. A partir de esta iteración se normalizó el estado de cada solicitud y se extendieron los formularios para capturar los campos que espera la API `sisa.api`.

## Estados normalizados
- Los estados permitidos ahora son `pending`, `approved` y `rejected`. Cada valor incluye metadatos (etiqueta localizada, descripción y paleta de colores) en `constants/companyMemberships.ts` y se expone mediante el contexto `CompanyMembershipsContext` para reutilizarlo en formularios y listados.【F:constants/companyMemberships.ts†L1-L104】【F:contexts/CompanyMembershipsContext.tsx†L24-L115】
- Todas las pantallas que muestran estados utilizan la misma normalización y un `MembershipStatusBadge` que aplica los colores y etiquetas correspondientes.【F:components/MembershipStatusBadge.tsx†L1-L53】

## Campos adicionales en los formularios
- Las vistas de creación y edición incorporan selectores para estados/roles y controles de texto para `message` (motivo de la solicitud) y `reason` (respuesta al aprobar o rechazar). Se envían normalizados mediante `normalizeNullableText` antes de invocar la API.【F:app/company_memberships/create.tsx†L23-L187】【F:app/company_memberships/[id].tsx†L23-L208】
- Los listados y modales muestran los mensajes y motivos capturados para que los administradores puedan priorizar y auditar cada solicitud.【F:app/company_memberships/index.tsx†L1-L240】【F:app/company_memberships/viewModal.tsx†L1-L120】

## Listado con filtros por estado
- El listado principal ahora permite filtrar y ordenar por estado normalizado utilizando los catálogos del contexto. También se sumaron chips con el mensaje y la respuesta para cada registro.【F:app/company_memberships/index.tsx†L1-L240】

## Recordatorio de seguridad
- Todas las operaciones continúan enviando el token `Bearer` provisto por `AuthContext`; el backend sigue sin claves foráneas, por lo que la normalización ocurre en el cliente antes de persistir los datos.【F:contexts/CompanyMembershipsContext.tsx†L410-L520】【F:docs/setup-and-configuration.md†L16-L26】
