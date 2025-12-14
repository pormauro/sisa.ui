# SISA UI

## Descripción general
SISA es la aplicación móvil y web de gestión operativa de Depros. Unifica la agenda de trabajos, la relación con clientes y proveedores, la gestión documental y los circuitos financieros (recibos, pagos, cajas, tarifas) sobre una única experiencia construida con [Expo Router](https://expo.dev/router) y React Native. El frontend consume la API `sisa.api` y prioriza el trabajo híbrido online/offline gracias al almacenamiento local con `AsyncStorage` y a la sincronización diferencial de operaciones.

### Tecnologías clave
- [Expo 53](https://docs.expo.dev/) con `expo-router` para navegación basada en archivos.
- React 19 y React Native 0.79 con TypeScript.
- Componentes nativos y librerías Expo para archivos, cámara, documentos, autenticación segura y caché (`expo-secure-store`, `expo-file-system`, `expo-document-picker`, etc.).
- `AsyncStorage` + hooks propios (`useCachedState`) para persistencia y trabajo sin conexión.
- [`Fuse.js`](https://fusejs.io/) y [`react-native-calendars`](https://github.com/wix/react-native-calendars) para búsquedas tolerantes y visualización de agenda.

## Requisitos previos
- Node.js 18 LTS o 20 LTS y npm 9+ (también es compatible con pnpm/yarn si el equipo lo adopta).
- Cuenta en [Expo](https://expo.dev/) (opcional pero recomendada) y el CLI disponible a través de `npx`.
- Android Studio / Xcode si se van a usar emuladores nativos.
- Acceso a la API `sisa.api` (por defecto se apunta a `https://sistema.depros.com.ar`, editable en `config/Index.ts`).

## Instalación y arranque
1. Clona el repositorio y entra en la carpeta del proyecto.
   ```bash
   git clone <url-del-repo>
   cd sisa.ui
   ```
2. Instala las dependencias.
   ```bash
   npm install
   ```
3. Configura la URL del backend si es necesario editando `config/Index.ts`.
4. Arranca Metro bundler.
   ```bash
   npx expo start
   ```
   Desde la consola de Expo puedes elegir abrir la aplicación en Android (`a`), iOS (`i`), web (`w`) o un build de desarrollo. También hay atajos empaquetados:
   - `npm run android`
   - `npm run ios`
   - `npm run web`
5. Para reiniciar el proyecto base puedes usar `npm run reset-project`, que mueve el ejemplo inicial a `app-example/` y deja `app/` vacía.

## Autenticación y seguridad
- `AuthContext` se encarga del inicio de sesión, la revalidación de tokens y la detección de modo offline. Los tokens se obtienen del encabezado `Authorization` tras llamar a `/login` y se guardan en `expo-secure-store` junto con las credenciales cifradas.
- Cada hora se renueva el token si el usuario sigue activo; también se comprueba el perfil cada 2 minutos (`/profile`) para validar la sesión.
- **Bearer obligatorio:** todas las peticiones a `sisa.api` deben llevar `Authorization: Bearer <token>` salvo los endpoints de inicio de sesión y registro.
- El contexto expone `checkConnection` para que la UI pueda forzar una reconexión y alterna entre modo online/offline según el estado del backend.

## Lineamientos para el backend `sisa.api`
- Mantén la convención de **no utilizar `FOREIGN KEY`** en la base de datos del backend, tal como se definió para `sisa.api`.
- Los módulos de la aplicación envían un `timestamp` en cada operación de escritura (por ejemplo citas, trabajos, pagos) para facilitar la reconstrucción de historial y resolver conflictos de sincronización.
- Campos como `attached_files` y `participants` se serializan en JSON desde el frontend; la API debe aceptarlos en ese formato.
- El endpoint `/sync/batch` expone el mapa `map.local_to_remote` para reconciliar IDs temporales con los definitivos asignados por el servidor:
  ```json
  {
    "ok": true,
    "batch_id": "example-batch-id",
    "results": [],
    "map": {
      "local_to_remote": {
        "1": 42
      }
    },
    "history": {
      "max_history_id": 0,
      "changes": []
    }
  }
  ```
  Cada operación entrante se despacha por entidad en el backend (por ejemplo `ClientsHandler`) para mantener el controlador desacoplado.

## Arquitectura y módulos principales
### Layout y routing
- `app/_layout.tsx` compone el árbol de proveedores (auth, permisos, archivos, catálogos, etc.) y define un `Stack` de Expo Router sin cabeceras. También aplica el `ThemeProvider` que armoniza el esquema de color con la configuración del usuario.
- `app/Index.tsx` actúa como splash screen mostrando el logotipo hasta que se resuelve el estado de autenticación; `app/+not-found.tsx` delega los errores de routing al enlace raíz.

### Contextos transversales
- `AuthContext`: login, autologin, renovación y almacenamiento seguro del token.
- `PermissionsContext`: fusiona permisos globales y del usuario consultando `/permissions/global` y `/permissions/user/:id`, con refresco automático cada 5 minutos.
- `FilesContext`: subida (`/files`), descarga y cacheo de metadatos/archivos con `expo-file-system`, incluyendo utilidades para limpiar almacenamiento local.
- `ConfigContext`: obtiene y actualiza preferencias (`/user_configurations`) y expone el tema elegido por el usuario, el cual se integra en `useColorScheme`.
- `ProfileContext`, `ProfilesContext` y `ProfilesListContext`: cachean perfiles del usuario actual, perfiles externos y listados completos para selector de permisos.
- `useCachedState`: hook genérico para hidratar estado desde `AsyncStorage` y escuchar limpiezas de caché.

### Gestión operativa y agenda (`app/`)
- `app/login/`: pantallas de login, registro y recuperación que consumen `/login`, `/register` y `/forgot_password`.
- `app/Home.tsx`: menú dinámico que muestra secciones según los permisos del usuario y expone accesos a agenda, clientes, finanzas, configuración y permisos.
- `app/appointments/`: calendario (con `react-native-calendars`), listado diario y CRUD de citas asociados a clientes y trabajos.
- `app/jobs/`: listado de trabajos con cálculo de duración y costos en base a tarifas o montos manuales.
- `app/clients/`, `app/providers/`: listados con búsqueda difusa (`Fuse.js`), modales de detalle y formularios de alta/edición condicionados por permisos.
- `app/folders/`: navegación jerárquica de carpetas por cliente, con soporte para imágenes y borrado controlado por permisos.
- `app/products_services/`, `app/categories/`, `app/statuses/`, `app/tariffs/`, `app/cash_boxes/`: catálogos maestros con búsqueda, acciones restringidas y refresco tras cada operación.
- `app/payments/` y `app/receipts/`: flujos financieros que combinan clientes/proveedores, adjuntos y banderas contables.【F:app/payments/index.tsx†L61-L187】
- `app/payment_templates/`: catálogo, formularios y modal de lectura para definir plantillas reutilizables de pagos; exige `listPaymentTemplates` para navegar y aplica los permisos `addPaymentTemplate`, `updatePaymentTemplate`, `deletePaymentTemplate` sobre las acciones disponibles, siempre bajo autenticación Bearer.【F:app/payment_templates/index.tsx†L61-L187】【F:contexts/PaymentTemplatesContext.tsx†L271-L441】
- `app/shortcuts/payment_templates.tsx`: vista de atajos "Planillas de pagos" que permite elegir una plantilla habilitada y abre `/payments/create` con los valores contables precargados cuando el perfil cuenta con `usePaymentTemplateShortcuts`.【F:app/shortcuts/payment_templates.tsx†L1-L139】【F:app/payments/create.tsx†L1-L210】
- `app/permission/`: UI para asignar permisos globales o por usuario mediante checkboxes, agrupando sectores y utilizando `PermissionsContext`.
- `app/user/`: `ProfileScreen` para editar datos personales y `ConfigScreen` para cambiar tema, limpiar cachés (`clearAllDataCaches`) y purgar archivos locales.

### Gestión de archivos y caché
- Los adjuntos se almacenan en `expo-file-system` con nombres sanitizados; `FilesContext` reutiliza copias locales cuando es posible y mantiene metadatos sincronizados en `AsyncStorage`.
- La opción "Borrar datos de archivos" de `ConfigScreen` elimina metadatos y archivos locales, mientras que "Borrar datos de la caché" limpia todos los estados persistidos vía `useCachedState`.

### Base de datos y migraciones
- El directorio `database/` contiene scripts SQL (`clients.sql`, `sync_tables.sql`) y migraciones (`database/migrations/*`) que definen la estructura esperada por `sisa.api`. Respeta el criterio de no crear claves foráneas y realiza las asociaciones en capa de aplicación.

## Documentación complementaria
La documentación funcional y técnica ampliada se mantiene en la carpeta `docs/` (por ejemplo, guías de sincronización, manuales operativos y convenciones de API). Si no la encuentras en este repositorio, consulta el repositorio principal o al equipo de backend para obtenerla. El documento `docs/architecture/payments-vs-templates.md` resume las diferencias entre los pagos tradicionales y las plantillas de pago, incluyendo sus flujos de sincronización y dependencias de permisos.【F:docs/architecture/payments-vs-templates.md†L1-L43】

## Novedades
- **Release 1.3.5 (cajas con asignaciones y permisos administrativos):** la `APP_VERSION` se fijó en `1.3.5` y se alinea con el release declarado en `sisa.api` (`config/version.json`), manteniendo los campos `assigned_user_ids` y `admin_permissions` para documentar quién puede operar o administrar cada caja; revisa la colección de Postman y la pantalla de permisos para habilitarlos con autenticación Bearer.【F:docs/features/modules.md†L330-L367】【F:app/permission/PermissionScreen.tsx†L53-L82】【F:docs/postman/Sistema.postman_collection.json†L2213-L2266】
- **Release 1.3.7 (registro de red documentado y con límites):** la `APP_VERSION` ahora es `1.3.7`, el visor `/network/logs` documenta campos capturados, límite de rotación y respuesta a limpiezas de caché, y la colección Postman remarca que solo el login prescinde del Bearer mientras el visor captura todas las llamadas. El changelog interno enlaza la guía y mantiene la versión alineada.【F:config/Index.ts†L1-L3】【F:docs/features/network-logs.md†L1-L20】【F:docs/postman/Sistema.postman_collection.json†L1-L360】【F:docs/architecture/state-and-cache.md†L75-L87】
- **Plantillas de pago:** funcionalidad disponible desde el menú financiero y los atajos para definir valores predeterminados de pagos. Requiere permisos `listPaymentTemplates` (navegación) y `addPaymentTemplate`/`updatePaymentTemplate`/`deletePaymentTemplate` (operaciones), además de token Bearer en todas las llamadas a `payment_templates` salvo el login.【F:app/payment_templates/index.tsx†L61-L187】【F:contexts/PaymentTemplatesContext.tsx†L271-L441】
- **Planillas de pagos (atajo):** acceso directo (`/shortcuts/payment_templates`) que lista plantillas habilitadas para atajos, respeta `usePaymentTemplateShortcuts` y precarga `/payments/create` con la configuración contable correspondiente.【F:constants/menuSections.ts†L29-L40】【F:app/shortcuts/payment_templates.tsx†L1-L139】【F:app/payments/create.tsx†L1-L210】
- **Colección Postman actualizada:** consulta `docs/postman/sisa-api.postman_collection.json` para probar los endpoints de pagos, plantillas y empresas (incluyendo direcciones, contactos y canales) con autenticación Bearer.【F:docs/postman/sisa-api.postman_collection.json†L1-L40】【F:docs/postman/sisa-api.postman_collection.json†L647-L2415】

## Scripts y utilidades
- `npm start` / `npx expo start`: inicia el bundler de Expo.
- `npm run android`, `npm run ios`, `npm run web`: abre la app directamente en cada plataforma.
- `npm run lint`: ejecuta `expo lint` con la configuración ESLint del proyecto.
- `npm run reset-project`: restaura el esqueleto inicial de Expo.

## Soporte y troubleshooting
- **Problemas de compilación**: borra cachés con `npx expo start --clear`, reinstala dependencias (`rm -rf node_modules && npm install`) o ejecuta `npx expo-doctor`.
- **Errores de autenticación**: usa la pantalla de Configuración para limpiar cachés o cierra sesión; asegúrate de que el backend responde y de que el token no ha caducado.
- **Permisos insuficientes**: verifica que `PermissionsContext` se haya refrescado (botón de recarga o volver a entrar) y que el usuario tenga los sectores requeridos.
- **Adjuntos corruptos**: desde Configuración ejecuta "Borrar datos de archivos" para forzar la re-descarga; los archivos se regeneran con `FilesContext` al volver a abrirlos.
- **Desajustes de datos**: ejecuta manualmente las sincronizaciones (`load*`) disponibles en cada módulo o revisa el historial expuesto por `/sync/batch`.
- **Estilo de código**: antes de abrir un PR ejecuta `npm run lint` y corrige los reportes de ESLint.
