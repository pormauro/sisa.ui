# Revisión de llamadas a limpieza de caché

Para verificar si la caché de datos se borra por múltiples rutas, se revisaron
los puntos de entrada a las utilidades de limpieza disponibles en el código.

## `clearAllDataCaches`

- Solo se invoca desde la pantalla de configuración a través de la acción
  "Borrar datos almacenados en caché", la cual muestra una alerta y ejecuta la
  rutina después de la confirmación del usuario.【F:app/user/ConfigScreen.tsx†L45-L76】
- No se encontraron otros contextos o efectos que invoquen automáticamente esta
  rutina. El `rg clearAllDataCaches` no devuelve coincidencias adicionales más
  allá del import y la llamada en `ConfigScreen`.

## `clearLocalFiles` / `clearFileCaches`

- `clearLocalFiles` se expone en `FilesContext` y elimina los archivos locales
  antes de propagar la limpieza de metadatos con `clearFileCaches`. En la UI solo
  se usa en la misma pantalla de configuración, mediante un flujo de confirmación
  similar al anterior.【F:contexts/FilesContext.tsx†L193-L214】【F:app/user/ConfigScreen.tsx†L31-L62】
- No hay llamadas adicionales a `clearFileCaches` fuera de esta ruta, por lo que
  la invalidación del caché de archivos no se dispara automáticamente.

## Conclusión

La limpieza global de la caché de datos (`clearAllDataCaches`) se ejecuta una
única vez por interacción del usuario en la pantalla de configuración. No hay
invocaciones duplicadas o automáticas que provoquen borrados inesperados. Lo
mismo aplica a la limpieza de archivos (`clearLocalFiles`), que depende de la
confirmación del usuario en el mismo flujo de configuración.
