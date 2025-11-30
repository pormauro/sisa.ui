# Autenticación

## Resumen del AuthContext
- `AuthContext` expone el identificador de usuario, datos básicos, estado de carga, indicador de conectividad, token, y las operaciones de inicio/cierre de sesión y verificación de conexión, lo que permite a las pantallas conocer y reaccionar ante el estado de autenticación actual.【F:contexts/AuthContext.tsx†L10-L32】
- El `AuthProvider` inicializa estados locales para gestionar token, usuario, correo, credenciales y bandera offline, encapsulando la lógica de autenticación y poniéndola a disposición del árbol de componentes mediante el contexto.【F:contexts/AuthContext.tsx†L53-L77】【F:contexts/AuthContext.tsx†L274-L291】

## Inicio de sesión resiliente
- La configuración de resiliencia establece tres reintentos máximos, demoras de 10 segundos entre reintentos y tiempos de espera de 10 segundos por petición, implementados mediante `fetchWithTimeout` para abortar solicitudes lentas.【F:contexts/AuthContext.tsx†L30-L47】
- `performLogin` envía las credenciales a `/login` con control de timeout y, tras una respuesta válida, extrae el token Bearer del encabezado `Authorization` (rechazando la sesión si está ausente).【F:contexts/AuthContext.tsx†L74-L134】
- El flujo de autenticación continúa solicitando `/user_profile` con el token recién emitido, consolidando el identificador y el correo del usuario (o nulo si la API no lo expone), calculando la expiración usando `expires_in` o el claim `exp` del JWT (con fallback a 1 hora) y marcando el estado como en línea solo cuando ambos pasos tienen éxito.【F:contexts/AuthContext.tsx†L120-L222】
- Los errores de red o expiración activan reintentos automáticos respetando el límite configurado; cuando la respuesta falla por motivos distintos, se limpia el estado y se informa al usuario mediante alertas.【F:contexts/AuthContext.tsx†L135-L152】

## Persistencia segura de credenciales
- El proveedor delega la persistencia en `utils/auth/secureStore`, que usa `expo-secure-store` cuando la plataforma lo soporta y recurre a `localStorage` (o `AsyncStorage` en su defecto) al ejecutar en la web, garantizando un almacenamiento disponible en cada entorno con manejo homogéneo de errores.【F:utils/auth/secureStore.ts†L1-L139】【F:contexts/AuthContext.tsx†L53-L77】
- Durante la carga inicial se leen las claves mediante `getInitialItems`, se descarta cualquier token expirado y se restablecen los estados locales de usuario antes de liberar la pantalla de carga, de modo que los reintentos de login suceden en segundo plano en lugar de bloquear el arranque.【F:utils/auth/secureStore.ts†L125-L139】【F:contexts/AuthContext.tsx†L252-L272】
- Tras un inicio de sesión válido se persisten token, usuario, credenciales y expiración; `clearCredentials` elimina estos valores durante cierres de sesión o fallas críticas para evitar residuos de información sensible.【F:contexts/AuthContext.tsx†L62-L77】【F:contexts/AuthContext.tsx†L180-L195】

## Renovación y vigencia de sesión
- `checkTokenValidity` comprueba el tiempo de expiración almacenado antes de reutilizar un token; si caducó, la sesión no se reutiliza.【F:contexts/AuthContext.tsx†L244-L250】
- `autoLogin` descarta tokens caducados, restaura inmediatamente el estado local y, sólo cuando faltan credenciales válidas en memoria, lanza `performLogin` en segundo plano para que la interfaz no quede esperando el request inicial.【F:contexts/AuthContext.tsx†L252-L272】
- Un efecto periódico cada cinco minutos revalida la expiración y dispara un nuevo login cuando caduca; otro intervalo cada dos minutos ejecuta `checkConnection` y relanza el login si el dispositivo pasó a modo offline con credenciales conocidas.【F:contexts/AuthContext.tsx†L252-L274】

## Control de conexión y requisitos de API
- `checkConnection` consulta `/user_profile` con el token Bearer actual y marca la aplicación como offline si la verificación falla; ante un `401` intenta autenticarse de nuevo usando las credenciales almacenadas, reforzando la continuidad de la sesión.【F:contexts/AuthContext.tsx†L311-L348】
- Todas las operaciones posteriores al login reutilizan el token guardado en SecureStore y adjuntan el encabezado `Authorization: Bearer`, mientras que la llamada inicial a `/login` es la única exenta del uso de Bearer para alinearse con el flujo de autenticación requerido.【F:contexts/AuthContext.tsx†L74-L147】【F:contexts/AuthContext.tsx†L219-L235】

## Integración con las pantallas de `app/login`
- El layout de la subruta de login agrupa las pantallas de Inicio de sesión, Registro y Recuperación de contraseña dentro de un `Stack`, permitiendo navegar entre pasos del flujo sin abandonar el contexto de autenticación.【F:app/login/_layout.tsx†L1-L11】
- La pantalla `Login` consume `AuthContext` para ejecutar `login(username, password)` y, una vez completado, redirige al usuario al resto de la aplicación; este es el punto de entrada que dispara los mecanismos de almacenamiento seguro y renovación descritos arriba.【F:app/login/Login.tsx†L1-L66】
- `Register` y `ForgotPassword` interactúan directamente con los endpoints públicos (`/register` y `/forgot_password`) para preparar cuentas o enviar correos de recuperación, manteniendo el flujo fuera de los recursos protegidos hasta que se obtenga un token válido.【F:app/login/Register.tsx†L28-L90】【F:app/login/ForgotPassword.tsx†L20-L54】
- `UserStatus` demuestra el consumo del estado global de autenticación en pantallas auxiliares, mostrando el identificador actual y exponiendo la operación de cierre de sesión para pruebas o herramientas internas.【F:app/login/UserStatus.tsx†L2-L27】

## Propagación del estado de autenticación
- `AuthProvider` envuelve todo el árbol de navegación en `app/_layout.tsx`, asegurando que cada pantalla (incluidas las rutas de login) tenga acceso inmediato al contexto y que los efectos de auto-enrutamiento dependan del estado global del usuario.【F:app/_layout.tsx†L41-L122】
- `RootLayoutContent` consulta `AuthContext` para decidir la navegación inicial: mientras se carga la sesión muestra un indicador, y una vez resuelto el estado, redirige a `/Home` si hay usuario autenticado o a `/login/Login` cuando no lo hay.【F:app/_layout.tsx†L41-L76】

## Consideraciones de seguridad
- Aunque se utiliza SecureStore para proteger los secretos, el flujo almacena tanto el token como la contraseña en texto plano para facilitar reintentos automáticos; conviene evaluar cifrado adicional, políticas de rotación o el uso de tokens de refresco para minimizar el riesgo si el dispositivo es comprometido.【F:contexts/AuthContext.tsx†L84-L152】【F:contexts/AuthContext.tsx†L264-L274】
- El cálculo de expiración usa el TTL proporcionado por el backend (o el `exp` del JWT) y las verificaciones periódicas de `/user_profile` reducen la ventana de uso de tokens robados, pero obligan a garantizar que la API responda oportunamente y que las llamadas usen HTTPS para proteger encabezados Bearer en tránsito.【F:contexts/AuthContext.tsx†L120-L350】
- Cualquier nueva petición protegida debe reutilizar el token del contexto y verificar el estado offline antes de intentar red, manteniendo la experiencia consistente con los mecanismos de tolerancia a fallos existentes.【F:contexts/AuthContext.tsx†L209-L274】
