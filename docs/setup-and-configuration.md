# Guía de configuración y puesta en marcha

Esta guía resume la configuración mínima necesaria para ejecutar el cliente Expo/React Native de SISA, preparar los entornos y coordinar los requisitos con el backend `sisa.api`.

## 1. Ajustes clave de `src/config/index.js`

El archivo [`src/config/index.js`](../src/config/index.js) centraliza dos constantes que afectan a todo el proyecto:

- `BASE_URL`: apunta por defecto a `https://sistema.depros.com.ar` y define el dominio base para todas las peticiones HTTP emitidas por los contextos y servicios del frontend.
- `MAX_FILE_SIZE`: limita el tamaño máximo de los adjuntos procesados desde los selectores de imágenes. Su valor actual (1 MB) mantiene controlado el peso de los archivos antes de subirlos a la API.

> ⚠️ **Importante:** Existe un espejo TypeScript en [`config/Index.ts`](../config/Index.ts). Mantén ambos archivos sincronizados cuando modifiques la URL base o el límite de tamaño para evitar comportamientos inconsistentes entre módulos `.js` y `.ts`.

## 2. Manejo de credenciales y autenticación

- El [`AuthContext`](../contexts/AuthContext.tsx) solicita el token al endpoint `/login`, valida su vigencia contra `/user_profile` y lo persiste (junto a `user_id`, `username`, contraseña y e-mail) mediante `expo-secure-store`, lo que asegura un almacenamiento cifrado en dispositivos físicos.
- El contexto actualiza el token en memoria y lo expone a los demás providers, que lo incluyen de forma obligatoria en el header `Authorization: Bearer <token>` de cada request. El login es la **única** ruta donde no se adjunta el Bearer token.
- Componentes legacy que todavía leen el token desde `AsyncStorage` (por ejemplo, `CircleImagePicker`) siguen accediendo a la clave `token`. Si necesitas compatibilidad con ellos, sincroniza el valor de SecureStore hacia `AsyncStorage` tras el login o refactoriza dichas piezas para que consuman el contexto de autenticación.
- `AsyncStorage` continúa siendo la capa de persistencia para cachés offline (`useCachedState`, metadatos de archivos, historiales). No guardes secretos sensibles allí.

## 3. Requisitos para el backend `sisa.api`

- **Autenticación:** el backend debe devolver el token en el header `Authorization: Bearer …` durante el login. Todas las rutas posteriores (GET/POST/PUT/DELETE) deben validar dicho header; las únicas excepciones son las operaciones de autenticación inicial (login y, si aplica, registro o recuperación de contraseña).
- **Límites de carga:** el endpoint `/upload` acepta archivos via `multipart/form-data` y respeta el límite impuesto por `MAX_FILE_SIZE`. Responde con códigos de error cuando el archivo supera el tope o si faltan credenciales.
- **Modelo de datos:** respeta la decisión arquitectónica de **no usar FOREIGN KEY** en la base de datos de `sisa.api`. Implementa las relaciones de forma manual (índices, claves compuestas o validaciones a nivel de aplicación) para alinear el backend con los supuestos del cliente.
- **Zona horaria y formato:** el backend devuelve fechas en UTC, pero las operaciones de escritura deben enviarse en formato ISO 8601 con desplazamiento, por ejemplo `2025-12-02T15:00:00-03:00`. El frontend normaliza este formato antes de enviar los payloads para que el servidor pueda calcular correctamente la hora universal.

## 4. Variables de entorno y endpoints por ambiente

SISA puede apuntar a distintas instancias de `sisa.api` (desarrollo, staging, producción). Para cambiar de entorno sin tocar el código fuente se recomienda utilizar variables de entorno compatibles con Expo.

1. **Crear archivos `.env`** (o `.env.development`, `.env.staging`, `.env.production`) con las claves públicas que expondrá la app:

   ```dotenv
   EXPO_PUBLIC_API_URL=https://sistema.depros.com.ar
   EXPO_PUBLIC_MAX_FILE_SIZE=1048576
   ```

2. **Exponer las variables en la configuración de Expo:** renombra `app.json` a `app.config.ts` o `app.config.js` y lee las variables con `dotenv`. Ejemplo resumido:

   ```ts
   import 'dotenv/config';
   import { ExpoConfig } from '@expo/config-types';

   export default ({ config }: { config: ExpoConfig }) => ({
     ...config,
     extra: {
       ...config.extra,
       apiUrl: process.env.EXPO_PUBLIC_API_URL,
       maxFileSize: Number(process.env.EXPO_PUBLIC_MAX_FILE_SIZE ?? 1048576),
     },
   });
   ```

   Posteriormente, ajusta `config/Index.ts` y `src/config/index.js` para que lean `Constants.expoConfig?.extra?.apiUrl` y `maxFileSize` antes de recurrir a los valores por defecto.

3. **Seleccionar el entorno en cada ejecución:**

   - Expo Go / Desarrollo local: exporta el archivo deseado (`export $(cat .env.development | xargs)`) o usa la herramienta [`dotenvx`](https://dotenvx.com/).
   - Expo Application Services (EAS): declara variables `EXPO_PUBLIC_*` en la sección _Environment Variables_ del proyecto o con `eas secret:create`. EAS inyectará las claves durante la construcción sin comprometer valores privados en el repositorio.

4. **Cambiar rápidamente de API sin `.env`:** en situaciones puntuales (prototipos, pruebas rápidas) puedes modificar `BASE_URL` directamente en los archivos de configuración. Recuerda revertir o versionar el cambio para no comprometer compilaciones productivas.

## 5. Consideraciones para entornos Expo y EAS

- El proyecto utiliza `expo-secure-store` (declarado en `app.json`) para gestionar credenciales cifradas en dispositivos iOS y Android. En web la implementación cae en un almacenamiento menos seguro, por lo que se aconseja deshabilitar funciones sensibles en builds web.
- El archivo [`eas.json`](../eas.json) define tres perfiles (`development`, `preview`, `production`). Ajusta las variables de entorno según el perfil que uses (`eas build --profile production`, `eas build --profile preview`, etc.).
- En desarrollos locales con Expo Go basta con recargar la app tras cambiar las variables. En builds EAS cualquier ajuste de `BASE_URL` o `MAX_FILE_SIZE` requiere un nuevo build (los valores quedan embebidos en el bundle).
- Mantén sincronizados los límites de subida entre cliente y backend. Si el backend aumenta `MAX_FILE_SIZE`, actualiza las variables o constantes equivalentes para evitar rechazos prematuros en el cliente.

Con estas pautas el frontend quedará alineado con los entornos disponibles y con las expectativas de seguridad y consistencia del backend `sisa.api`.
