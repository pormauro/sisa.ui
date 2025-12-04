# Menú flotante con selector de empresas (v1.3.6)

La versión 1.3.6 añade una barra inferior flotante accesible desde la pantalla de inicio que reúne accesos directos a Inicio, Notificaciones, Perfil y Atajos, además de un selector de empresas. Esta barra cubre todo el ancho de la pantalla y se apoya sobre una banda oscura desde la mitad de los íconos hacia abajo para mantener el efecto flotante.

## Comportamiento principal
- El botón central **Empresas** abre un modal con la lista de compañías cargadas desde `CompaniesContext`. Al elegir una opción, se guarda el `id` seleccionado en caché (`selected_company_id`) y se muestra el logo de la empresa en el menú; si no tiene logo se usa un ícono genérico.【F:components/BottomNavigationMenu.tsx†L1-L219】 
- La selección persiste entre sesiones porque se apoya en `useCachedState` dentro de `SelectedCompanyContext`. El valor `selectedCompany` queda disponible en todo el árbol para reutilizarlo en vistas que necesiten conocer la empresa activa.【F:contexts/SelectedCompanyContext.tsx†L1-L55】 
- El item **Notificaciones** refleja el contador de no leídas (`notifications.state.is_read === false`) y abre `/notifications`; el resto de ítems navegan a Inicio, Perfil y los atajos de plantillas de pago.【F:components/BottomNavigationMenu.tsx†L59-L111】

## Diseño y espaciado
- La barra flotante tiene `paddingBottom` adaptado al `safeAreaInsets` y un fondo claro/oscuro según el tema; la franja oscura de fondo se extiende desde la mitad de los íconos hasta el borde inferior para cubrir todo el ancho y alto disponible.【F:components/BottomNavigationMenu.tsx†L113-L219】
- El contenido de `Home` agrega `paddingBottom` para evitar solaparse con el menú flotante, manteniendo la navegabilidad del grid de secciones.【F:app/Home.tsx†L113-L137】

## Dependencias
- Requiere `APP_VERSION` `1.3.6` (`config/Index.ts`) y se apoya en los contextos globales provistos en `app/_layout.tsx`, incluyendo el nuevo `SelectedCompanyProvider` para exponer la empresa activa.【F:config/Index.ts†L1-L3】【F:app/_layout.tsx†L43-L100】
