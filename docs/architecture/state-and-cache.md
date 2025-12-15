# Estado global, caché y trabajo offline

Esta nota complementa la [visión general](./overview.md) profundizando en la capa de
estado persistente y en cómo los distintos contextos comparten la misma
infraestructura de caché. El objetivo es entender qué se guarda en memoria,
qué se sincroniza con `AsyncStorage` y de qué manera se limpian los datos para
proteger el almacenamiento del dispositivo.

## `useCachedState`: estado React con hidración persistente

[`useCachedState`](../../hooks/useCachedState.ts) es el gancho reutilizable que
sostiene a la mayoría de los contextos. Envuelve a `useState` con cuatro piezas
clave:

1. **Referencia del valor inicial.** Usa un `ref` para conservar siempre el
   `initialValue` vigente, incluso si el componente recibe nuevas props y el
   valor cambia después de montarse.【F:hooks/useCachedState.ts†L5-L13】
2. **Hidratación asincrónica.** Al montarse, ejecuta `getCachedData` y, si la
   clave existe, reemplaza el estado antes de marcar la bandera `hydrated`, lo
   que permite que la UI espere a que la rehidratación concluya.【F:hooks/useCachedState.ts†L14-L29】
3. **Suscripción a limpiezas.** Cada estado se registra en
   [`subscribeToDataCacheClear`](../../utils/cache.ts), de modo que una purga
   global lo regresa inmediatamente al valor inicial almacenado en el `ref`.
   El efecto devuelve la función de `unsubscribe` para evitar fugas al desmontar
   el componente.【F:hooks/useCachedState.ts†L31-L36】【F:utils/cache.ts†L25-L30】
4. **Persistencia automática.** El *setter* envuelve al `setState` nativo para
   calcular el siguiente valor (función o literal), serializarlo con
   `setCachedData` y luego devolverlo, sin obligar a los consumidores a esperar
   *promises* ni a duplicar la lógica de escritura.【F:hooks/useCachedState.ts†L38-L52】

El *hook* devuelve `[state, setState, hydrated]`. El tercer valor habilita
patrones como ocultar un `FlatList` hasta que el estado esté listo o mostrar una
pantalla de carga mientras se hidrata la caché por primera vez.

## Limpieza centralizada del caché de datos

El utilitario [`subscribeToDataCacheClear`](../../utils/cache.ts) mantiene una
lista (`Set`) de *listeners* y entrega una función de `unsubscribe`, asegurando
que cada suscriptor reciba el aviso de limpieza una sola vez y que la
suscripción se pueda liberar cuando el componente se desmonta.【F:utils/cache.ts†L7-L30】
La pantalla de configuración expone una acción "Borrar datos de la caché" que
ejecuta `clearAllDataCaches`; esta función filtra todas las claves con prefijo
`@sisa:data:`, las elimina mediante `multiRemove` y, sin importar el resultado,
propaga la señal a todos los suscriptores para que restauren sus valores
iniciales.【F:app/user/ConfigScreen.tsx†L29-L53】【F:utils/cache.ts†L60-L71】

Cuando se necesita invalidar únicamente el catálogo de empresas sin afectar los
datos de membresías, `clearCompaniesDataCache` borra la clave `companies` del
espacio de nombres de caché pero no emite notificaciones globales, de modo que
los demás estados persisten intactos y se recargan solo cuando cada contexto lo
requiera.【F:utils/cache.ts†L73-L79】

> El `CompaniesContext` primero rehidrata el listado desde la caché y **después**
> consulta el servidor, garantizando que la lista de empresas aparezca de forma
> inmediata aunque la petición remota demore.【F:contexts/CompaniesContext.tsx†L943-L1040】

> **Nota**: este mecanismo solo afecta al "caché de datos" (catálogos,
> permisos, configuraciones). La limpieza de archivos binarios se gestiona por
> separado, como se describe en la sección de `FilesContext`.

## Persistencia centralizada con `AsyncStorage`

La persistencia se organiza en dos espacios de nombres definidos en
[`utils/cache.ts`](../../utils/cache.ts):

- `@sisa:data:` para colecciones de dominio y banderas ligeras manejadas por
  `useCachedState`.
- `@sisa:file:` para metadatos de archivos recientes y la clave heredada
  `file_meta_` utilizada por versiones previas.【F:utils/cache.ts†L3-L117】

Todas las operaciones (`getItem`, `setItem`, `multiRemove`) están envueltas en
`try/catch` con trazas en consola para evitar que un fallo de E/S rompa la
aplicación. Además de proveer funciones para leer y escribir, la misma utilidad
ofrece `clearAllDataCaches` y `clearFileCaches`, lo que garantiza una convención
de nombres consistente y un único punto para instrumentar métricas o ajustar la
estrategia de almacenamiento en el futuro.【F:utils/cache.ts†L39-L117】

## Contextos que aprovechan la capa de caché

La mayoría de los proveedores dentro de `contexts/` comparten el mismo patrón:

1. Declaran su estado con `useCachedState('<clave>', <valorInicial>)`.【F:contexts/ClientsContext.tsx†L45-L144】
2. Consumen `AuthContext` para obtener `token`, credenciales e información de
   conectividad (`isOffline`).【F:contexts/ClientsContext.tsx†L45-L138】
3. Exponen funciones CRUD que actualizan tanto el estado en memoria como el
   caché persistente después de cada petición autenticada.【F:contexts/ClientsContext.tsx†L49-L140】

Algunos ejemplos representativos:

- **Catálogos de negocio.** `ClientsContext`, `JobsContext`, `AppointmentsContext`,
  `PaymentsContext`, `ReceiptsContext` y `FoldersContext` almacenan listas de
  entidades en claves dedicadas (`clients`, `jobs`, `appointments`, `payments`,
  `receipts`, `folders`). Esto permite que las pantallas muestren información
  histórica aunque se cierre la app o el dispositivo pierda conectividad.【F:contexts/ClientsContext.tsx†L45-L144】【F:contexts/JobsContext.tsx†L68-L176】【F:contexts/AppointmentsContext.tsx†L74-L199】【F:contexts/PaymentsContext.tsx†L47-L167】【F:contexts/ReceiptsContext.tsx†L47-L167】【F:contexts/FoldersContext.tsx†L29-L124】
- **Hidratación cache-first en Agenda.** `AppointmentsContext` exporta
  `isHydrated` para que la UI sepa cuándo mostrar el estado almacenado en la
  caché sin pisarlo con llamadas remotas. Solo dispara `loadAppointments()`
  cuando `appointmentsHydrated` es verdadero y existe `token`, garantizando que
  el primer render visible utilice la data persistida ordenada antes de
  refrescar desde la API.【F:contexts/AppointmentsContext.tsx†L94-L154】【F:app/appointments/index.tsx†L16-L158】
- **Preferencias de usuario.** `ConfigContext` guarda el tema, el rol y el tipo
  de vista bajo la clave `config`, lo que permite rehidratar la UI apenas se
  monta el *provider* y sin esperar una llamada remota.【F:contexts/ConfigContext.tsx†L34-L95】
- **Permisos y perfiles.** `PermissionsContext` fusiona permisos globales y por
  usuario antes de persistirlos, mientras que `ProfilesContext` y
  `ProfilesListContext` usan claves separadas para distinguir el perfil activo y
  la lista de perfiles disponibles, evitando sobre-escrituras involuntarias.【F:contexts/PermissionsContext.tsx†L19-L85】【F:contexts/ProfilesContext.tsx†L21-L48】【F:contexts/ProfilesListContext.tsx†L29-L61】
- **Auditoría de red.** `NetworkLogContext` guarda el historial en la clave
  `networkLogs` y escucha los eventos emitidos por el sniffer global que
  parchea `fetch` y `XMLHttpRequest` apenas carga `app/_layout.tsx`. Se descartan
  automáticamente los registros más antiguos al superar 200 entradas y una
  limpieza global de caché restablece la lista a vacío, por lo que las
  depuraciones previas no persisten tras ejecutar "Borrar datos de la caché" o
  reinstalar la app.【F:app/_layout.tsx†L1-L6】【F:contexts/NetworkLogContext.tsx†L1-L83】【F:utils/networkSniffer.ts†L1-L171】

Dado que todos comparten `useCachedState` y se suscriben al mismo aviso de
limpieza, una purga de caché o una reinstalación restablece cada estado a su
forma inicial hasta que la sincronización con el backend se complete
nuevamente.

## `FilesContext`: metadatos y blobs persistidos

[`FilesContext`](../../contexts/FilesContext.tsx) complementa al caché de datos
con una capa específica para archivos binarios:

- **Descarga y lectura offline.** `getFile` intenta primero resolver los
  metadatos cacheados (`localUri`, tipo MIME, nombre). Si la ruta existe en el
  sistema de archivos, lee el contenido en Base64 y construye una URL de datos;
  de lo contrario, descarga el archivo con el token de `AuthContext`, lo guarda
  en disco y actualiza los metadatos con la nueva ubicación local.【F:contexts/FilesContext.tsx†L50-L130】
- **Carga y duplicado local.** `uploadFile` empaqueta el archivo en un
  `FormData`, envía la petición autenticada y, tras la respuesta exitosa, copia
  el archivo al directorio interno para que quede disponible sin conexión.【F:contexts/FilesContext.tsx†L133-L177】
- **Metadatos perezosos.** `getFileMetadata` delega en la caché y fuerza una
  descarga si no encuentra información previa, logrando que el caché se
  auto-complete con la primera consulta.【F:contexts/FilesContext.tsx†L179-L192】
- **Limpieza selectiva.** `clearLocalFiles` identifica todas las claves de
  archivos en `AsyncStorage`, elimina los archivos físicos si existen y luego
  invoca `clearFileCaches` para avisar a cualquier suscriptor interesado en la
  invalidez del caché de archivos.【F:contexts/FilesContext.tsx†L193-L214】【F:utils/cache.ts†L104-L117】

Gracias a esta estrategia, el usuario puede abrir documentos previamente
consultados aun sin conexión y dispone de una acción explícita en la pantalla de
configuración para liberar espacio si el dispositivo lo requiere.【F:app/user/ConfigScreen.tsx†L29-L53】

## Detección de conectividad y estrategias offline

`AuthContext` es la fuente de verdad sobre el estado de la red. Implementa
`fetchWithTimeout` para cortar peticiones que exceden los 10 segundos y reintenta
el login hasta tres veces con un retardo entre intentos, marcando `isOffline`
cuando detecta errores de red.【F:contexts/AuthContext.tsx†L31-L182】 Las
credenciales y el token se guardan en `SecureStore`, lo que permite reintentos
posteriores sin intervención del usuario y habilita `autoLogin` al iniciar la
aplicación.【F:contexts/AuthContext.tsx†L50-L217】

El método `checkConnection` consulta `/profile` con el token actual; si recibe un
`401`, relanza el proceso de autenticación con las credenciales almacenadas y, en
cualquier otro error, marca el estado offline. Además, se ejecutan dos tareas
periódicas: validar el vencimiento del token cada cinco minutos y verificar la
sesión contra el backend cada dos minutos para reintentar el login en segundo
plano.【F:contexts/AuthContext.tsx†L223-L283】 Los contextos consumidores acceden a
`token` e `isOffline` para decidir si disparar sincronizaciones o trabajar con
los datos cacheados hasta que la conexión se restablezca; `FilesContext`, por
su parte, reutiliza el mismo token para garantizar que las descargas y subidas
conserven la autenticación cuando la red vuelve a estar disponible.【F:contexts/FilesContext.tsx†L50-L177】【F:contexts/ClientsContext.tsx†L45-L138】

En conjunto, `useCachedState`, la propagación de limpiezas y la integración con
`AuthContext` permiten que la aplicación soporte cortes de red, limpiezas
manuales de caché y reutilización de datos sin replicar lógica en cada módulo.

## Auditoría automática de contextos con caché

Para asegurar que ningún *provider* nuevo ignore la persistencia, el script
[`check:cache`](../../scripts/verify-context-cache.js) revisa todos los archivos
en `contexts/` que invoquen al backend (`BASE_URL`). Si un contexto no usa
`useCachedState`, la tarea falla salvo que el archivo esté en la lista blanca
(`AuthContext` y `FilesContext` ya implementan sus propios mecanismos de
almacenamiento seguro y de archivos). Añadir un contexto nuevo exige escoger una
estrategia de caché o justificarlo explícitamente antes de pasar las CI.
