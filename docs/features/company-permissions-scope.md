# Company-scoped permissions (v1.6.3)

La versión 1.6.3 mantiene el scoping obligatorio de permisos por empresa y simplifica la pantalla `/permission`: los miembros
aprobados se listan siempre con `role=all`, sin permitir que el usuario filtre entre dueños, administradores o miembros, ya que
los dos primeros perfiles tienen el menú completo habilitado de forma predeterminada.【F:app/permission/PermissionScreen.tsx†L139-L185】【F:app/permission/PermissionScreen.tsx†L527-L564】El objetivo sigue siendo que al alternar la empresa activa desde la barra inferior se actualicen los permisos consumidos por la app sin perder la persistencia en caché.

## Contextos involucrados

- `CompanyScopeContext`: conserva `selectedCompanyId` en caché y expone el objeto `selectedCompany` para reutilizar la selección en toda la app. Si la empresa desaparece de `MemberCompaniesContext` la selección se limpia automáticamente.
- `PermissionsContext`: ahora almacena un `permissionsCache` por clave de empresa y solicita los permisos con el query param
  `company_id`. El superusuario (`id = 1`) sigue consultando sin necesidad de scoping y mantiene acceso total.

Ambos contextos se inyectan en `app/_layout.tsx` dentro de `AuthProvider` y antes del resto de providers que necesitan
permisos o la empresa activa.

## Flujo de actualización

1. El selector de la barra inferior actualiza `selectedCompanyId` mediante `useCompanyScope`.
2. `PermissionsContext` detecta el cambio y vuelve a consultar `/permissions/user/{userId}` y `/permissions/global` agregando
   `company_id=<id>` para usuarios estándar.
3. Los resultados se guardan en caché por empresa (`permissions` + `isCompanyAdmin`) evitando recargas innecesarias al volver a
   una empresa previa.

Si no hay una empresa seleccionada, la UI conserva permisos vacíos hasta que el usuario elija una. Los permisos heredados de
versiones anteriores se migran automáticamente a la nueva estructura de caché.

## Consideraciones de backend

La app asume que las rutas de permisos exigen `company_id` para todos los actores salvo el superusuario. Cualquier widget nuevo
que dependa de permisos debe leer `PermissionsContext` y `useCompanyScope` para respetar la empresa activa y las reglas del
middleware.
