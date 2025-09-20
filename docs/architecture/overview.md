# Visión general de la arquitectura

Esta aplicación móvil se construye con [Expo Router](https://expo.github.io/router/docs) y React Native. La navegación, los estados globales y el consumo de API se organizan en torno a un `RootLayout` que anida múltiples *providers* y expone las pantallas dentro de la carpeta `app/`. Esta guía resume cómo se distribuye el código y cómo fluyen los datos desde la autenticación hasta los módulos funcionales.

## Estructura de carpetas destacada

- **`app/`**: Define las rutas de la aplicación siguiendo las convenciones de Expo Router. Cada archivo o carpeta dentro de `app/` representa una pantalla o pila de navegación. El archivo [`app/_layout.tsx`](../../app/_layout.tsx) inyecta los *providers* globales alrededor del árbol de navegación.
- **`components/`**: Agrupa componentes reutilizables de UI como [`ThemeProvider`](../../components/ThemeProvider.tsx), que ajusta la paleta de colores del *navigator* según el modo claro/oscuro.
- **`contexts/`**: Contiene los contextos de React responsables de manejar datos compartidos (autenticación, permisos, catálogos, etc.). Cada contexto encapsula las llamadas al backend y expone funciones para modificar el estado asociado.
- **`hooks/`**: Incluye *hooks* personalizados como [`useCachedState`](../../hooks/useCachedState.ts) para hidratar estados desde almacenamiento persistente y `useThemeColor` para combinar la paleta de colores con los componentes.
- **`utils/`**: Implementa utilidades como [`utils/cache.ts`](../../utils/cache.ts) que abstrae el almacenamiento en `AsyncStorage` y notifica cuando se limpian los caches.
- **`config/`** y **`constants/`**: Centralizan valores compartidos, por ejemplo [`config/Index.ts`](../../config/Index.ts) expone la `BASE_URL` usada por todas las peticiones HTTP y `constants/Colors` define los esquemas de color.
- **`assets/`, `styles/`, `scripts/`**: Complementan la UI con íconos, estilos globales y scripts auxiliares.

## Layout principal y jerarquía de providers

El `RootLayout` es la puerta de entrada a la aplicación. Primero muestra un `Stack` con las pantallas raíz y, antes de renderizarlo, envuelve el contenido con una cadena de *providers* que comparten estado global con el resto de las rutas.

```
AuthProvider
  └─ PermissionsProvider
       └─ FilesProvider
            └─ ProfileProvider
                 └─ ProfilesProvider
                      └─ ProfilesListProvider
                           └─ ConfigProvider
                                └─ ThemeProvider
                                     └─ CashBoxesProvider
                                          └─ ClientsProvider
                                               └─ ProvidersProvider
                                                    └─ CategoriesProvider
                                                         └─ ProductsServicesProvider
                                                              └─ StatusesProvider
                                                                   └─ TariffsProvider
                                                                        └─ JobsProvider
                                                                             └─ AppointmentsProvider
                                                                                  └─ PaymentsProvider
                                                                                       └─ ReceiptsProvider
                                                                                            └─ FoldersProvider
                                                                                                 └─ <Stack />
```

La jerarquía refleja dependencias lógicas: `AuthProvider` calcula el estado de sesión antes de montar el resto de los contextos; `PermissionsProvider` consume el token y el `userId` del contexto de autenticación; el resto de los proveedores usan ese token para obtener datos de dominio. Cualquier pantalla dentro de `app/` puede consumir estas fuentes de datos a través de `useContext`, como ocurre en [`app/Home.tsx`](../../app/Home.tsx) al filtrar el menú según permisos.

## Contextos y flujo de datos

### `AuthContext`

- Realiza el login contra `/login`, extrae el token `Bearer` del encabezado `Authorization` y recupera el perfil con `/profile` antes de considerar la sesión válida.
- Persiste `token`, credenciales y metadatos en `SecureStore`, valida la expiración y reintenta autenticaciones cuando detecta desconexiones o expiraciones.
- Expone banderas como `isLoading` (para bloquear la UI inicial) y `isOffline`, así como métodos `login`, `logout` y `checkConnection` utilizados por las pantallas y otros contextos.

### `PermissionsContext`

- Depende de `AuthContext` para obtener `token` y `userId`.
- Fusiona los permisos específicos del usuario (`/permissions/user/:id`) con los permisos globales (`/permissions/global`) y actualiza el caché local mediante `useCachedState`.
- Se refresca automáticamente cada cinco minutos para mantener los permisos sincronizados con el backend.

### Contextos de dominio (`Clients`, `CashBoxes`, `Jobs`, etc.)

- Siguen un patrón uniforme: almacenan sus datos en `useCachedState`, obtienen el `token` de `AuthContext` y realizan operaciones CRUD hacia los endpoints REST (`/clients`, `/jobs`, `/appointments`, etc.).
- Actualizan el estado local en memoria y en caché después de cada operación exitosa para garantizar consistencia entre sesiones.
- En el caso de [`FilesContext`](../../contexts/FilesContext.tsx) se añade lógica adicional para cachear archivos en disco y reutilizarlos sin re-descargar, reutilizando utilidades de `utils/cache`.

### Hooks y utilidades transversales

- `useCachedState` hidrata cada contexto desde `AsyncStorage`, se suscribe a los eventos de limpieza y reescribe el cache cada vez que se actualiza el estado.
- `ThemeProvider` y `useThemeColor` garantizan que los componentes respeten el modo claro/oscuro definido por el sistema y por `constants/Colors`.

## Interacción con el backend y dependencias clave

Todas las peticiones (excepto el login inicial) incluyen el encabezado `Authorization: Bearer <token>` provisto por `AuthContext`. Las dependencias principales se pueden resumir así:

```
AuthContext --login--> /login
  │             └─ usa credenciales para obtener token y perfil (/profile)
  ↓
PermissionsContext --fetch--> /permissions/user/:id y /permissions/global
  ↓
Contextos de dominio --CRUD--> módulos funcionales (clientes, pagos, cajas, etc.)
  ↓
FilesContext --upload/download--> /files y cache local
```

El valor `BASE_URL` se define una sola vez y se reutiliza en todas las llamadas de red. El flujo mantiene la sesión activa: cuando `AuthContext` detecta un token inválido o un problema de conectividad, intenta renovar las credenciales y, en paralelo, cada contexto maneja sus propios errores mostrando alertas o limpiando sus caches según corresponda.

Gracias a esta composición, cualquier pantalla puede asumir que la autenticación y los permisos ya están listos cuando se monta, limitándose a invocar las funciones expuestas por los contextos para interactuar con el backend sin repetir lógica de autorización ni manejo de caché.
