# Gestión de archivos en SISA.UI

Este documento resume cómo funciona la capa de gestión de archivos en la aplicación móvil, qué límites aplica el cliente y cómo interactúan los componentes principales encargados de subir, descargar, cachear y previsualizar adjuntos.

## Configuración base

- `BASE_URL` apunta al backend público de SISA y se reutiliza para todas las descargas y subidas de archivos autenticadas.
- `MAX_FILE_SIZE` define el tamaño máximo (100 MB) admitido por los selectores de medios antes de intentar comprimir/redimensionar la imagen localmente. Ajustar este valor requiere coordinarse con el backend para que ambos límites se mantengan sincronizados.

## Contexto `FilesContext`

`FilesContext` centraliza el acceso al backend de archivos y encapsula la caché local en disco/`AsyncStorage`:

- **`uploadFile`** recibe la ruta local, nombre, tipo MIME y tamaño del archivo. Crea un `FormData` con el campo `file`, envía la solicitud autenticada (token Bearer) al endpoint `/files` y, si la API responde con éxito, copia el archivo procesado al `documentDirectory` del dispositivo y persiste sus metadatos (`localUri`, nombre original, MIME, etc.) en `AsyncStorage` mediante `setCachedFileMeta` para reutilizarlo offline.
- **`getFile`** consulta primero `AsyncStorage` para recuperar metadatos y verificar que el archivo local siga existiendo. Si está disponible, lo lee como base64 y devuelve un `data URI` listo para mostrar. Cuando no hay caché válida, descarga el recurso desde el backend con cabecera `Authorization: Bearer`, interpreta los encabezados `Content-Type`/`Content-Disposition` para reconstruir el nombre original, codifica la respuesta en base64 y la guarda en disco junto con los metadatos cacheados.
- **`getFileMetadata`** garantiza el acceso a los metadatos cacheados (nombre, tipo, `localUri`), solicitando el archivo remoto como fallback cuando no existe registro local.
- **`clearLocalFiles`** borra los archivos físicos almacenados en `documentDirectory`, limpia las entradas de `AsyncStorage` para claves `@sisa:file:` y `file_meta_`, y delega en `clearFileCaches` para avisar a los escuchas que la caché fue invalidada. Se recomienda invocarla durante cierres de sesión o cuando una auditoría obligue a eliminar datos sensibles del dispositivo. Desde ahora, el cierre de sesión del usuario ejecuta automáticamente esta limpieza junto con el vaciado de la caché de datos para evitar que quede información residual en el dispositivo.

## Compresión y recorte en `CircleImagePicker`

`CircleImagePicker` ofrece un selector circular de avatar que integra cámara y galería:

- Solicita permisos explícitos para cámara (`requestCameraPermissionsAsync`) y biblioteca (`requestMediaLibraryPermissionsAsync`) antes de permitir la captura o selección de imágenes.
- Si `crop` está activo, recorta el recurso seleccionado de forma centrada y manteniendo la relación de aspecto solicitada (`cropAspect`), usando `expo-image-manipulator`.
- Aplica `ensureUnderMaxSize` tras cada selección para iterar hasta tres veces sobre el archivo, reduciendo dimensiones y calidad JPEG en función de `MAX_FILE_SIZE`. El algoritmo calcula un ratio basado en el tamaño actual versus el máximo y va ajustando ancho/alto junto con la calidad (`compress`) hasta que el archivo quede dentro del límite.
- Tras procesar el recurso, llama a `uploadFile`, actualiza el estado local y dispara `onImageChange` con el nuevo `fileId` generado por la API.

## Galería de archivos (`FileGallery`)

`FileGallery` es el carrusel reutilizable que carga, visualiza y administra listas de adjuntos.

### Flujo de inicialización y carga

1. Recibe `filesJson` (lista de IDs u objetos) y crea placeholders en estado interno `attachedFiles`.
2. Para cada ID, ejecuta en paralelo `getFile` y `getFileMetadata`. Una vez resueltos, rellena los placeholders con el `data URI` para previsualización, tipo MIME, nombre original y `localUri` cacheado.
3. Cuando el usuario agrega un archivo (DocumentPicker o cámara), reutiliza `uploadFile` y actualiza `filesJson` con los IDs devueltos por el backend, replicando el ciclo de carga de metadatos.

### Marcado de facturas en pagos

- Cuando `FileGallery` se usa en el carrusel de **pagos** (`invoiceMarkingEnabled`), cada entrada de `filesJson` es un objeto `{ id, is_invoice }` que señala si el adjunto corresponde a una factura real.
- La galería puede leer el indicador `is_invoice` tanto del `filesJson` inicial como de los metadatos que devuelve el backend (por ejemplo, si una actualización en base de datos marca la factura sin pasar por la UI).
- La UI muestra un botón con icono de factura sobre cada tarjeta; el estado inactivo es gris y al activarlo se pinta de verde. Se puede marcar más de un archivo por pago.
- Además, un **press prolongado sobre la tarjeta** alterna el estado de factura real sin dejar de respetar el toque corto para abrir o previsualizar el adjunto.
- En modos de solo lectura (`editable={false}`) el indicador sigue mostrando el color correcto, pero no permite alternar el valor.

### Manejo de tipos y previsualizaciones

- **Imágenes:** Se detectan cuando `fileType` contiene `image`. El componente renderiza un `<Image>` para el thumbnail y, al pulsar, abre `ImagePreviewModal`, que soporta zoom y navegación entre todas las imágenes de la galería.
- **Videos:** Identificados por `fileType` que incluye `video`. Se muestra un `VideoView` (Expo AV) como miniatura con controles nativos; al abrir, `VideoPreviewModal` presenta el video en pantalla completa con controles de reproducción.
- **PDF:** Cuando `fileType` contiene `pdf`, se renderiza `PdfThumbnail` con icono/etiqueta. Al pulsar, en Android se intenta lanzar una `Intent` con `application/pdf` (previamente generando un `content://` cuando el URI es `file://`). Si el URI es `data:` o la plataforma no soporta intents (iOS/Web), se muestra `PdfPreviewModal`, que abre el documento en un `WebView` con indicador de carga.
- **Otros tipos:** Se muestra un contenedor genérico con el nombre del archivo y, al pulsar, se intenta abrir con `Linking.openURL` utilizando `getContentUriAsync` en Android para delegar en otras aplicaciones instaladas.

### Consideraciones para PDFs y videos

- **PDFs:** Garantizar que el archivo exista localmente antes de lanzar el visor. Si `localUri` falta, se muestra un mensaje de error. Para URIs `data:` en Android, se fuerza la vista interna (`PdfPreviewModal`) para evitar errores de intents. Es recomendable probar que el dispositivo tenga un lector PDF instalado o proporcionar el visor interno como fallback.
- **Videos:** Mantener los archivos en memoria local permite una reproducción sin depender de la red. `VideoView` usa `nativeControls` para simplificar la experiencia; si se requieren controles personalizados, se puede extender el componente reutilizando `useVideoPlayer`.

## Buenas prácticas de caché

- Invocar `clearLocalFiles` en eventos de cierre de sesión, cambios de cuenta o cuando el dispositivo es compartido para eliminar cualquier copia residual.
- Escuchar `clearFileCaches` si otros módulos guardan referencias en memoria y necesitan invalidarlas al mismo tiempo.
- Verificar que el almacenamiento tenga espacio suficiente antes de subir archivos grandes; si el sistema operativo rechaza la operación, informar al usuario y sugerir liberar espacio.

## Permisos requeridos

- **Cámara:** `ImagePicker.requestCameraPermissionsAsync()` debe aprobarse antes de capturar fotos o videos. Manejar el caso de denegación informando al usuario cómo habilitar el permiso.
- **Galería/Biblioteca:** `ImagePicker.requestMediaLibraryPermissionsAsync()` es obligatorio para acceder a fotos existentes. Sin este permiso, los selectores deben cancelarse y mostrar un mensaje claro.
- **Documentos (Android):** Cuando se abra un PDF externo, el intent requiere que exista alguna aplicación capaz de manejar `application/pdf`; capturar la excepción e informar que falta un visor compatible.

Seguir estas pautas asegura que la experiencia de manejo de archivos sea consistente, segura y resiliente ante variaciones de plataforma.
