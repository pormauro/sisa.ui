# Gestión de archivos en SISA.UI

Este documento resume cómo funciona la capa de gestión de archivos en la aplicación móvil, qué límites aplica el cliente y cómo interactúan los componentes principales encargados de subir, descargar, cachear y previsualizar adjuntos.

## Configuración base

- `BASE_URL` apunta al backend público de SISA y se reutiliza para todas las descargas y subidas de archivos autenticadas.
- `MAX_FILE_SIZE` define el tamaño máximo (100 MB) admitido por los selectores de medios antes de intentar comprimir/redimensionar la imagen localmente. Ajustar este valor requiere coordinarse con el backend para que ambos límites se mantengan sincronizados.

## Contexto `FilesContext`

`FilesContext` centraliza el acceso al backend y persiste los adjuntos solo en el cliente combinando `expo-file-system` con caché en `AsyncStorage` (`FILES_LOCAL_CACHE_V1`). Cada archivo se mueve a `documentDirectory/files/<id>/` con renombrado incremental (`archivo.txt`, `archivo(1).txt`, etc.) y se guarda el metadato (nombre original, nombre almacenado, URI local, MIME, tamaño y `downloadedAt`).

- **`uploadFile`** recibe la ruta local, nombre, tipo MIME y tamaño, sube el archivo con Bearer y, al obtener el `fileId`, copia a un temporal y usa `storeDownloadedFile` para dejarlo en la carpeta privada `files/<id>/` y persistir el metadato en caché.【F:contexts/FilesContext.tsx†L317-L372】【F:utils/files/localFileStorage.ts†L71-L101】
- **`getFile`** reutiliza el `localUri` cacheado si el archivo existe; si no está y el dispositivo está offline, muestra un aviso, y en modo online descarga el binario a un temporal, lo mueve con renombrado automático y actualiza la entrada de caché.【F:contexts/FilesContext.tsx†L290-L315】【F:utils/files/localFileStorage.ts†L71-L101】
- **`getFileMetadata`** lee primero la caché; si no hay entrada, ejecuta un `HEAD` contra `/files/{id}` para resolver `content-type`, nombre sugerido y tamaño y guarda esos datos en `AsyncStorage` aun cuando no haya descarga completa.【F:contexts/FilesContext.tsx†L183-L288】
- **`registerEntityFiles`** vincula la lista de IDs de adjuntos a cada entidad (`ENTITY_INDEX_KEY`) para que `getFilesForEntity` y `ensureFilesDownloadedForEntity` puedan resolver y precargar archivos offline respetando el orden recibido.【F:contexts/FilesContext.tsx†L132-L172】【F:contexts/FilesContext.tsx†L261-L389】
- **`clearLocalFiles`** elimina los directorios `files/` en `documentDirectory` y `cacheDirectory` y borra las claves `FILES_LOCAL_CACHE_V1` y `ENTITY_INDEX_KEY` para evitar referencias huérfanas.【F:contexts/FilesContext.tsx†L410-L438】

## Compresión y recorte en `CircleImagePicker`

`CircleImagePicker` ofrece un selector circular de avatar que integra cámara y galería:

- Solicita permisos explícitos para cámara (`requestCameraPermissionsAsync`) y biblioteca (`requestMediaLibraryPermissionsAsync`) antes de permitir la captura o selección de imágenes.
- Si `crop` está activo, recorta el recurso seleccionado de forma centrada y manteniendo la relación de aspecto solicitada (`cropAspect`), usando `expo-image-manipulator`.
- Aplica `ensureUnderMaxSize` tras cada selección para iterar hasta tres veces sobre el archivo, reduciendo dimensiones y calidad JPEG en función de `MAX_FILE_SIZE`. El algoritmo calcula un ratio basado en el tamaño actual versus el máximo y va ajustando ancho/alto junto con la calidad (`compress`) hasta que el archivo quede dentro del límite.
- Tras procesar el recurso, llama a `uploadFile`, actualiza el estado local y dispara `onImageChange` con el nuevo `fileId` generado por la API.

## Galería de archivos (`FileGallery`)

`FileGallery` es el carrusel reutilizable que carga, visualiza y administra listas de adjuntos de cada entidad:

1. Parsea `filesJson` (string o arreglo con IDs u objetos `{ id }`) y registra esos IDs en `FilesContext` para mantener el índice de la entidad.
2. Pide metadatos a `getFilesForEntity` y renderiza cada fila con el nombre y el estado "Disponible offline" o "Pendiente de descarga".
3. Cuando hay conectividad, `ensureFilesDownloadedForEntity` descarga en segundo plano los archivos faltantes y actualiza la lista; al tocar un elemento descargado, delega en `openFile` para abrirlo con el visor nativo.【F:components/FileGallery.tsx†L6-L111】【F:contexts/FilesContext.tsx†L261-L408】

## Buenas prácticas de caché

- Invocar `clearLocalFiles` en eventos de cierre de sesión, cambios de cuenta o cuando el dispositivo es compartido para eliminar cualquier copia residual.
- Escuchar `clearFileCaches` si otros módulos guardan referencias en memoria y necesitan invalidarlas al mismo tiempo.
- Verificar que el almacenamiento tenga espacio suficiente antes de subir archivos grandes; si el sistema operativo rechaza la operación, informar al usuario y sugerir liberar espacio.

## Permisos requeridos

- **Cámara:** `ImagePicker.requestCameraPermissionsAsync()` debe aprobarse antes de capturar fotos o videos. Manejar el caso de denegación informando al usuario cómo habilitar el permiso.
- **Galería/Biblioteca:** `ImagePicker.requestMediaLibraryPermissionsAsync()` es obligatorio para acceder a fotos existentes. Sin este permiso, los selectores deben cancelarse y mostrar un mensaje claro.
- **Documentos (Android):** Cuando se abra un PDF externo, el intent requiere que exista alguna aplicación capaz de manejar `application/pdf`; capturar la excepción e informar que falta un visor compatible.

Seguir estas pautas asegura que la experiencia de manejo de archivos sea consistente, segura y resiliente ante variaciones de plataforma.
