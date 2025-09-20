# Estado global, caché y trabajo offline

Esta nota complementa la [visión general](./overview.md) profundizando en la capa de
estado persistente y en cómo los distintos contextos comparten la misma
infraestructura de caché. El objetivo es entender qué se guarda en memoria,
qué se sincroniza con `AsyncStorage` y de qué manera se limpian los datos para
proteger el almacenamiento del dispositivo.

## `useCachedState`: estado React con hidración persistente

[`useCachedState`](../../hooks/useCachedState.ts) es el gancho reutilizable que
sostiene a la mayoría de los contextos. Envuelve a `useState` con tres piezas
clave:

1. **Hidratación inicial**. Al montarse, busca el valor guardado en
   `AsyncStorage` mediante `getCachedData` y, si existe, lo inyecta en el estado
   antes de marcar la bandera `hydrated`.
2. **Suscripción a limpiezas**. El efecto secundario invoca a
   [`subscribeToDataCacheClear`](../../utils/cache.ts) para recibir el evento que
   dispara [`clearAllDataCaches`](../../utils/cache.ts). Cuando ocurre la
   notificación, el estado vuelve al valor inicial (usando un `ref` que siempre
   guarda el `initialValue`).
3. **Escritura diferida**. Cada actualización de estado serializa el nuevo
   valor a través de `setCachedData`. De esta forma no hace falta replicar el
   `await` en los contextos; el *hook* se encarga de persistir los cambios en
   segundo plano y mantener sincronizados el estado en memoria y el almacenamiento
   local.【F:hooks/useCachedState.ts†L1-L45】【F:utils/cache.ts†L1-L80】

El *hook* devuelve una tupla `[state, setState, hydrated]`. El último valor es
útil para que las pantallas sepan cuándo mostrar la UI (por ejemplo, se puede
ocultar un `FlatList` hasta que el caché haya terminado de hidratarse).

## Notificaciones de limpieza del caché de datos

La operación "Borrar datos de la caché" en la pantalla de configuración ejecuta
`clearAllDataCaches`, que elimina todas las claves con el prefijo
`@sisa:data:` en `AsyncStorage` y, al finalizar, recorre los *listeners*
registrados en `subscribeToDataCacheClear`. Como todos los contextos que usan
`useCachedState` están suscritos, el efecto secundario hace que cada estado se
restablezca a su valor inicial inmediatamente después de la purga, evitando que
la UI muestre información obsoleta mientras se vuelve a sincronizar con el
backend.【F:app/user/ConfigScreen.tsx†L1-L74】【F:utils/cache.ts†L1-L80】

> **Nota**: esta notificación solo afecta al "caché de datos" (catálogos,
> permisos, configuraciones). La limpieza de archivos binarios se gestiona por
> separado, como se describe en la sección de `FilesContext`.

## Persistencia centralizada con `AsyncStorage`

La persistencia se divide en dos espacios de nombres dentro de
[`utils/cache.ts`](../../utils/cache.ts):

- `@sisa:data:` para colecciones de dominio y banderas ligeras (strings,
  arreglos, objetos serializables) manejadas por `useCachedState`.
- `@sisa:file:` para metadatos de archivos (nombre, tipo MIME, ruta local) y la
  clave heredada `file_meta_` para compatibilidad con versiones anteriores.

Todas las operaciones (`getItem`, `setItem`, `multiRemove`) se envuelven en
`try/catch` con trazas en consola para evitar que un fallo de E/S rompa la
aplicación. Los contextos nunca acceden directamente a `AsyncStorage`; en su
lugar, delegan en las utilidades de caché, lo que garantiza una convención de
nombres consistente y un único punto para agregar métricas o cambios futuros en
la estrategia de almacenamiento.【F:utils/cache.ts†L1-L119】

## Contextos que aprovechan la capa de caché

La mayoría de los proveedores en `contexts/` siguen el mismo patrón:

1. Declaran su estado principal con `useCachedState('<clave>', <valorInicial>)`.
2. Obtienen `token`, credenciales y banderas (como `isOffline`) desde
   `AuthContext`.
3. Exponen funciones CRUD que, tras un `fetch`, actualizan tanto el estado en
   memoria como el caché persistente.

Algunos ejemplos representativos:

- [`ClientsContext`](../../contexts/ClientsContext.tsx),
  [`JobsContext`](../../contexts/JobsContext.tsx),
  [`AppointmentsContext`](../../contexts/AppointmentsContext.tsx),
  [`PaymentsContext`](../../contexts/PaymentsContext.tsx),
  [`ReceiptsContext`](../../contexts/ReceiptsContext.tsx) y
  [`FoldersContext`](../../contexts/FoldersContext.tsx) almacenan listas de
  entidades para que el usuario pueda navegar los catálogos aunque se cierre la
  app.
- [`ConfigContext`](../../contexts/ConfigContext.tsx) guarda la configuración de
  vista (tema, tamaño de fuente, rol) para rehidratar inmediatamente la UI.
- [`PermissionsContext`](../../contexts/PermissionsContext.tsx) fusiona permisos
  globales y específicos, luego los cachea para habilitar o deshabilitar
  pantallas sin depender de la red.
- [`ProfilesContext`](../../contexts/ProfilesContext.tsx) y
  [`ProfilesListContext`](../../contexts/ProfilesListContext.tsx) usan claves
  separadas para distinguir el perfil activo de la lista general, reduciendo
  sobre-escrituras involuntarias.

Dado que todos comparten `useCachedState`, limpiar la caché o reinstalar la app
no deja residuos inconsistentes: los estados vuelven a su forma inicial hasta
que se complete la sincronización con el backend.【F:contexts/ClientsContext.tsx†L1-L123】【F:contexts/ConfigContext.tsx†L1-L69】

## `FilesContext`: metadatos y blobs persistidos

[`FilesContext`](../../contexts/FilesContext.tsx) añade una capa de almacenamiento
para documentos binarios que complementa al caché de datos:

- **Descarga**. `getFile` intenta primero recuperar el archivo desde el caché de
  metadatos (`getCachedFileMeta`). Si encuentra una ruta válida en el sistema de
  archivos (`expo-file-system`), lee el contenido en Base64 y lo devuelve como
  URL de datos. Si el archivo no existe localmente, realiza `fetch` al backend
  con el token `Bearer`, guarda el archivo en disco (`writeAsStringAsync`) y
  persiste los metadatos mediante `setCachedFileMeta`.
- **Carga**. `uploadFile` empaqueta el archivo en un `FormData`, envía la petición
  autenticada y, tras el éxito, duplica el archivo en el almacenamiento interno
  para que esté disponible offline sin necesidad de re-descargarlo.
- **Metadatos perezosos**. `getFileMetadata` obtiene la entrada cacheada y, si no
  existe, llama a `getFile` para forzar la descarga, logrando que la cache se
  auto-complete.
- **Limpieza selectiva**. `clearLocalFiles` recorre todas las claves de
  `AsyncStorage` con prefijos de archivos, elimina sus rutas físicas en disco y
  finalmente invoca `clearFileCaches` para notificar a los suscriptores
  interesados que el caché de archivos ha sido invalidado.

Gracias a esta estrategia, el usuario puede abrir documentos previamente
consultados aun sin conexión, y dispone de una opción explícita para liberar
espacio si el dispositivo lo requiere.【F:contexts/FilesContext.tsx†L1-L200】【F:utils/cache.ts†L82-L119】

## Detección de conectividad y estrategias offline

`AuthContext` es la fuente de verdad sobre el estado de la red. Utiliza
`fetchWithTimeout` para considerar fallidas las peticiones que exceden 10
segundos y marca `isOffline` cuando se detectan errores de red. Además:

- Reintenta el login hasta tres veces con un retardo configurable, lo que ayuda
  a recuperarse de microcortes.
- Expone `checkConnection`, que consulta `/profile` con el token actual. Si la
  respuesta es `401`, reintenta la autenticación automáticamente con las
  credenciales guardadas. De lo contrario, actualiza la bandera `isOffline`.
- Ejecuta comprobaciones periódicas (cada dos minutos) para reconectar en caso
  de desconexión silenciosa, y valida el vencimiento del token cada cinco
  minutos.

Los contextos y pantallas pueden usar `isOffline` para decidir si mostrar avisos
al usuario, retrasar sincronizaciones o trabajar exclusivamente con los datos
cacheados hasta que la conexión se restablezca.【F:contexts/AuthContext.tsx†L1-L294】

En conjunto, `useCachedState`, la infraestructura de notificaciones y la
integración con `AuthContext` permiten que la aplicación soporte cortes de red,
limpiezas manuales de caché y reutilización de datos sin replicar lógica en cada
módulo.
