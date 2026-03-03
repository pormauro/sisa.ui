# Módulos operativos y contratos de contexto

Esta guía resume los modelos, operaciones disponibles y dependencias de permisos para los principales contextos de datos del cliente móvil de SISA. Cada sección referencia el archivo de contexto correspondiente, los endpoints REST que consume (prefijados por `BASE_URL`) y las pantallas de Expo Router que materializan la funcionalidad.

## Notas de integración con el backend
- Todas las peticiones realizadas tras el inicio de sesión deben enviar el encabezado `Authorization: Bearer <token>`; el flujo de login es la única excepción. La API tiene que emitir el token en el login y validar su presencia en el resto de rutas protegidas.【F:docs/setup-and-configuration.md†L16-L24】
- La base de datos de `sisa.api` se mantiene sin claves foráneas: las relaciones se resuelven en la capa de aplicación. Mantén esta restricción al definir nuevas tablas o integraciones.【F:docs/setup-and-configuration.md†L21-L26】

## Clientes (`ClientsContext`)
### Modelo
- `Client`: identifica razón social, CUIT, contacto, tarifa asociada y metadatos de versión/fechas.【F:contexts/ClientsContext.tsx†L12-L23】
- Los avatares de cliente ahora provienen del `profile_file_id` heredado de `CompanySummary`; se eliminó la columna `brand_file_id` y el contexto depura las cachés/historiales locales al hidratarse para evitar residuos legacy.【F:contexts/ClientsContext.tsx†L12-L142】【F:app/clients/index.tsx†L300-L380】

### Métodos del contexto
- `loadClients()`: hidrata y cachea el listado desde la API.【F:contexts/ClientsContext.tsx†L49-L58】
- `addClient(client)`: crea un cliente y refresca el listado local.【F:contexts/ClientsContext.tsx†L64-L93】
- `updateClient(id, client)`: persiste cambios y sincroniza el estado local.【F:contexts/ClientsContext.tsx†L96-L123】
- `deleteClient(id)`: elimina el registro y depura la caché.【F:contexts/ClientsContext.tsx†L125-L139】

### Endpoints consumidos
- `GET ${BASE_URL}/clients` — listado de clientes.【F:contexts/ClientsContext.tsx†L49-L57】
- `POST ${BASE_URL}/clients` — alta de cliente.【F:contexts/ClientsContext.tsx†L64-L78】
- `PUT ${BASE_URL}/clients/{id}` — actualización.【F:contexts/ClientsContext.tsx†L96-L109】
- `DELETE ${BASE_URL}/clients/{id}` — baja lógica.【F:contexts/ClientsContext.tsx†L125-L133】

### Permisos requeridos
- `listClients` para acceder al módulo desde el menú principal.【F:app/Home.tsx†L20-L37】
- `addClient`, `updateClient`, `deleteClient` gobiernan altas, ediciones y bajas en las pantallas de listado/detalle.【F:app/clients/index.tsx†L36-L118】【F:app/clients/[id].tsx†L16-L160】

### Pantallas relacionadas
- `app/clients/index.tsx` — listado con búsqueda, métricas de trabajos no facturados y nuevas tarjetas de facturación emitida/borrador por cliente para saltar rápidamente a la vista de comprobantes.【F:app/clients/index.tsx†L1-L360】
- `app/clients/create.tsx` — formulario de alta con selección de tarifa.【F:app/clients/create.tsx†L1-L120】
- `app/clients/[id].tsx` — edición y eliminación condicionadas por permisos.【F:app/clients/[id].tsx†L1-L160】
- `app/clients/viewModal.tsx` — modal de lectura rápida con resumen de facturación (emitidas/borradores), acceso a contabilidad y acciones representadas por iconos.【F:app/clients/viewModal.tsx†L1-L220】
- `app/clients/unpaidInvoices.tsx` — listado de facturas en borrador o emitidas con totales por estado, sumatoria global, selección múltiple y disparo de recibos con cliente preseleccionado, descripción armada con las fechas/descripciones de los trabajos asociados y el importe total de los comprobantes elegidos.【F:app/clients/unpaidInvoices.tsx†L1-L520】
- `app/clients/calendar.tsx` — agenda combinada de trabajos/turnos con botones compactos bajo el calendario y tarjetas coloreadas para diferenciar eventos en la lista.【F:app/clients/calendar.tsx†L1-L420】
- `app/clients/accounting.tsx` — panel contable que cruza facturas y recibos del cliente para calcular emitidos, borradores, pagos y saldo pendiente aprovechando los permisos `listInvoices` y `listReceipts`.【F:app/clients/accounting.tsx†L1-L220】

## Empresas (`CompaniesContext`)
### Modelo
- `Company`: agrupa razón social, datos de contacto y arrays embebidos para identidad fiscal, direcciones, contactos comerciales y canales externos de comunicación.【F:contexts/CompaniesContext.tsx†L14-L76】
- `TaxIdentity`, `CompanyAddress`, `CompanyContact`, `CommunicationChannel`: describen cada bloque anidado, incluyendo etiquetas, banderas de principal/verificado y referencias cruzadas con las tablas dedicadas `company_*` y `contact_*`.【F:contexts/CompaniesContext.tsx†L14-L76】

### Métodos del contexto
- `loadCompanies()`: consulta en paralelo la caché persistida y el backend; muestra primero los datos cacheados si el servidor aún no respondió y, al recibir la respuesta remota, limpia la caché y repuebla el contexto con la versión más reciente. El flujo complementa la respuesta principal con `/company-addresses`, `/contacts`, `/company-contacts`, `/company-channels` y `/contact-channels`, fusiona duplicados y ordena por fecha antes de hidratar el estado compartido.【F:contexts/CompaniesContext.tsx†L949-L1076】
- `addCompany(company)`: serializa los bloques anidados, envía el `POST /companies` y fuerza un refresco posterior para mantener la caché alineada.【F:contexts/CompaniesContext.tsx†L251-L278】
- `updateCompany(id, company)`: ejecuta `PUT /companies/{id}`, fusiona el resultado con el estado local y vuelve a consultar el listado.【F:contexts/CompaniesContext.tsx†L287-L324】
- `deleteCompany(id)`: llama a `DELETE /companies/{id}` y depura la empresa eliminada del store local.【F:contexts/CompaniesContext.tsx†L333-L351】

### Endpoints consumidos
- `GET ${BASE_URL}/companies` — listado principal que dispara la hidratación del contexto.【F:contexts/CompaniesContext.tsx†L606-L748】
- `GET ${BASE_URL}/company-addresses` — domicilios normalizados vinculados por `empresa_id`.【F:contexts/CompaniesContext.tsx†L606-L748】
- `GET ${BASE_URL}/contacts` — catálogo maestro de contactos reutilizado en los pivotes de empresa.【F:contexts/CompaniesContext.tsx†L606-L748】
- `GET ${BASE_URL}/company-contacts` — relaciones empresa-contacto con departamento, notas y bandera principal.【F:contexts/CompaniesContext.tsx†L606-L748】
- `GET ${BASE_URL}/company-channels` y `GET ${BASE_URL}/contact-channels` — canales (teléfono, email, redes) con etiquetas, verificación y prioridad.【F:contexts/CompaniesContext.tsx†L606-L748】
- `POST ${BASE_URL}/companies` — creación de empresa con payload serializado para arrays anidados.【F:contexts/CompaniesContext.tsx†L251-L278】
- `PUT ${BASE_URL}/companies/{id}` — actualización del registro y sincronización local.【F:contexts/CompaniesContext.tsx†L287-L324】
- `DELETE ${BASE_URL}/companies/{id}` — baja lógica y limpieza de caché.【F:contexts/CompaniesContext.tsx†L333-L351】
- La colección de Postman `Companies` replica este flujo completo y agrega ejemplos listos para direcciones, contactos y canales con scripts de timestamp para evitar duplicados.【F:docs/postman/sisa-api.postman_collection.json†L647-L2415】

### Permisos requeridos
- `listCompanies` habilita el listado y la navegación desde el menú principal.【F:app/companies/index.tsx†L57-L99】【F:constants/menuSections.ts†L48-L62】
- `createCompany`, `updateCompany`, `deleteCompany` controlan accesos a formularios de alta, edición y baja en las pantallas protegidas.【F:app/companies/create.tsx†L61-L105】【F:app/companies/[id].tsx†L136-L157】【F:app/companies/viewModal.tsx†L11-L45】
- Los IDs listados en `administrator_ids` (y el superadministrador) habilitan el acceso al editor y al modal incluso si el usuario no posee el permiso `updateCompany`. El listado valida esta bandera antes de permitir el gesto de edición prolongado.【F:app/companies/index.tsx†L150-L210】【F:app/companies/viewModal.tsx†L37-L120】【F:app/companies/[id].tsx†L210-L270】
- Ese arreglo se alimenta automáticamente del campo `admin_users` de la tabla `empresas`, que guarda un JSON con los IDs de las personas administradoras (por ejemplo `[1,25,64]`). Al sincronizar compañías se normaliza ese valor y se expone como `administrator_ids`, por lo que basta con mantener la columna `admin_users` actualizada para liberar la edición desde la app.【F:contexts/CompaniesContext.tsx†L548-L604】

### Pantallas relacionadas
- `app/companies/index.tsx` — listado con búsqueda difusa y accesos a modal/detalle.【F:app/companies/index.tsx†L1-L200】
- `app/companies/create.tsx` — formulario de alta con constructores de identidades, direcciones y contactos; el bloque de domicilios ya permite etiquetar cada dirección, definir la principal antes de guardar y mantiene la vista previa de coordenadas, mientras que la razón social se captura junto a los datos fiscales para alinear el flujo con la edición.【F:app/companies/create.tsx†L360-L780】
- `app/companies/[id].tsx` — edición avanzada que reutiliza los bloques anidados, permite bajas condicionadas por permisos y agrupa la razón social con CUIT/IVA dentro del bloque fiscal para conservar la paridad con el alta.【F:app/companies/[id].tsx†L420-L720】
- `app/companies/viewModal.tsx` — modal de lectura que expone identidades fiscales, direcciones y contactos cargados por la API.【F:app/companies/viewModal.tsx†L1-L160】
- `app/companies/memberships.tsx` — red social de la empresa: lista administradores declarados y los miembros provenientes de `/companies/{id}/memberships`, mostrando estado, rol, departamento y notas para cada registro con refresco pull-to-refresh y controles de permisos del `CompanyMembershipsContext`. La vista ahora incluye modales para enviar solicitudes, aceptar invitaciones con token, revisar el historial y ejecutar acciones de aprobación, suspensión, remoción o baja voluntaria según el estado y los permisos vigentes.【F:app/companies/memberships.tsx†L1-L240】【F:app/companies/memberships.tsx†L494-L870】

### Consumo de identidad fiscal, direcciones y contactos
- El `GET /companies` retorna las colecciones `tax_identities`, `addresses` y `contacts`; el contexto cruza esa respuesta con los listados independientes de direcciones, contactos y canales para que cada empresa muestre datos actualizados aunque residan en tablas específicas (`company-addresses`, `company-contacts`, `company-channels`, `contacts`, `contact-channels`).【F:contexts/CompaniesContext.tsx†L160-L188】【F:contexts/CompaniesContext.tsx†L606-L748】【F:app/companies/viewModal.tsx†L330-L420】
- Las operaciones de alta y edición serializan los bloques anidados antes de invocar la API, manteniendo la compatibilidad con la base `sisa.api`, que continúa sin claves foráneas según lo acordado a nivel backend.【F:contexts/CompaniesContext.tsx†L205-L218】【F:docs/setup-and-configuration.md†L21-L26】
- Durante la serialización, direcciones y contactos se duplican automáticamente en los alias `domicilios`, `direcciones`, `contactos`, `personas_contacto`, etc., para que los controladores legacy del backend sigan recibiendo los campos históricos y puedan guardar/recuperar esos datos sin cambios adicionales. Las direcciones también replican cada campo relevante en sus equivalentes en español (`calle`, `numero`, `provincia`, `pais`, `es_principal`, `latitud`, `longitud`, `lat`, `lng`, etc.) antes de enviarse, respetando lo que esperan los endpoints dedicados `company-addresses`.【F:contexts/CompaniesContext.tsx†L359-L413】【F:contexts/CompaniesContext.tsx†L519-L552】【F:contexts/CompaniesContext.tsx†L668-L757】
- La edición desde `app/companies/[id].tsx` se apalanca ahora en `CompanyAddressesModal`: un modal con overlay que congela el formulario principal, lista las direcciones existentes con formularios editables (incluyendo bajas puntuales vía `DELETE /company-addresses/{id}` y actualizaciones con `PUT /company-addresses/{id}`) y permite apilar nuevos formularios que se guardan contra `POST ${BASE_URL}/company-addresses` sin abandonar la pantalla. Cada cambio dispara `loadCompanies()` para sincronizar el resumen local.【F:app/companies/[id].tsx†L700-L860】【F:components/CompanyAddressesModal.tsx†L1-L520】
- Cada dirección mantiene latitud y longitud como campos manuales en los formularios de alta/edición, de modo que las coordenadas se pegan directamente y se serializan dentro del JSON sin depender de permisos de GPS. La vista modal sigue mostrando los puntos cargados cuando existen coordenadas válidas.【F:app/companies/create.tsx†L700-L780】【F:components/CompanyAddressesModal.tsx†L430-L710】【F:app/companies/[id].tsx†L520-L880】【F:app/companies/viewModal.tsx†L300-L340】
- Todos los requests al endpoint `/companies` incluyen el encabezado `Authorization: Bearer <token>`, requisito obligatorio salvo en el flujo de login inicial.【F:contexts/CompaniesContext.tsx†L229-L344】【F:docs/setup-and-configuration.md†L14-L24】

## Membresías corporativas (`CompanyMembershipsContext`)
### Modelo y permisos
- El contexto normaliza los estados `pending`, `invited`, `approved`, `rejected`, `cancelled`, `left`, `removed` y `suspended`, junto con cargo, departamento, tipo de contratación, fechas y visibilidad, evitando depender de claves foráneas del backend.【F:contexts/CompanyMembershipsContext.tsx†L15-L173】
- Los historiales guardan el tipo de operación, notas, razón del cambio, usuario involucrado y el `metadata_snapshot` parseado cuando la API envía cadenas JSON.【F:contexts/CompanyMembershipsContext.tsx†L338-L452】
- Las banderas `canManageMemberships`, `canInviteMembers`, `canLeaveCompany`, `canViewHistory`, entre otras, se calculan una sola vez desde `PermissionsContext`, permitiendo que las pantallas habiliten o oculten acciones sin reimplementar lógica de autorización.【F:contexts/CompanyMembershipsContext.tsx†L489-L555】

### Métodos del contexto
- `loadMemberships(companyId, status)` ejecuta `GET /companies/{id}/memberships?status=` con token Bearer, actualiza la caché por empresa/estado y devuelve los datos previos cuando el usuario no tiene permisos para listar.【F:contexts/CompanyMembershipsContext.tsx†L614-L642】
- `loadMembershipHistory(companyId, membershipId)` consulta `GET /companies/{id}/memberships/{membershipId}/history`, ordena la cronología y guarda el resultado localmente para reutilizarlo sin hits repetidos.【F:contexts/CompanyMembershipsContext.tsx†L670-L709】
- `handleMembershipMutation` centraliza la firma de cada `POST` protegido, encapsula `ensureAuthResponse`, limpia la caché de la empresa/historial afectado y devuelve un booleano listo para las vistas.【F:contexts/CompanyMembershipsContext.tsx†L711-L752】
- Las operaciones `requestMembership`, `inviteMember`, `acceptInvitation`, `cancelInvitation`, `approveMembership`, `rejectMembership`, `leaveMembership`, `suspendMember` y `removeMember` comparten ese helper para mantener sincronizados los listados tras cada cambio de estado.【F:contexts/CompanyMembershipsContext.tsx†L754-L912】

### Endpoints consumidos
- `GET ${BASE_URL}/companies/{companyId}/memberships?status=` — listado filtrado por estado.【F:contexts/CompanyMembershipsContext.tsx†L614-L642】
- `GET ${BASE_URL}/companies/{companyId}/memberships/{membershipId}/history` — historial completo por membresía.【F:contexts/CompanyMembershipsContext.tsx†L670-L690】
- `POST ${BASE_URL}/companies/{companyId}/memberships` / `invite` / `{membershipId}/(accept|cancel-invitation|approve|reject|leave|suspend|remove)` — ciclo de vida completo de solicitudes, invitaciones y bajas, siempre protegido por token Bearer.【F:contexts/CompanyMembershipsContext.tsx†L754-L912】

### Permisos requeridos
- El grupo "Company Memberships" en la pantalla de permisos agrupa `listCompanyMembers`, `listUserCompanyMemberships`, `manageCompanyMemberships`, `inviteCompanyMembers`, `cancelCompanyInvitations`, `reactivateCompanyMember`, `acceptCompanyInvitation`, `requestCompanyMembership`, `leaveCompanyMembership`, `suspendCompanyMember` y `removeCompanyMember`.【F:app/permission/PermissionScreen.tsx†L20-L38】

### Colección de Postman
- La carpeta "Company Memberships" dentro de `docs/postman/sisa-api.postman_collection.json` documenta cada endpoint con cuerpos de ejemplo y variables (`company_id`, `membership_id`, `invited_user_id`, `membership_token`) para auditar el flujo sin reescribir IDs manualmente.【F:docs/postman/sisa-api.postman_collection.json†L2300-L2717】

## Proveedores (`ProvidersContext`)
### Modelo
- `Provider`: razón social, identificadores y datos de contacto opcionales.【F:contexts/ProvidersContext.tsx†L13-L21】
- Los proveedores también heredan el `profile_file_id` de la empresa asociada y el contexto purga cualquier `brand_file_id` almacenado en historiales locales para mantener el esquema sin columnas obsoletas.【F:contexts/ProvidersContext.tsx†L13-L120】【F:app/providers/index.tsx†L140-L220】

### Métodos del contexto
- `loadProviders()` para sincronizar la caché local.【F:contexts/ProvidersContext.tsx†L46-L58】
- `addProvider(provider)` con refresco posterior.【F:contexts/ProvidersContext.tsx†L64-L88】
- `updateProvider(id, provider)` actualiza y vuelve a cargar la lista.【F:contexts/ProvidersContext.tsx†L90-L120】
- `deleteProvider(id)` elimina y filtra la colección almacenada.【F:contexts/ProvidersContext.tsx†L122-L141】

### Endpoints consumidos
- `GET ${BASE_URL}/providers` — consulta base.【F:contexts/ProvidersContext.tsx†L46-L54】
- `POST ${BASE_URL}/providers` — creación.【F:contexts/ProvidersContext.tsx†L64-L76】
- `PUT ${BASE_URL}/providers/{id}` — modificación.【F:contexts/ProvidersContext.tsx†L90-L100】
- `DELETE ${BASE_URL}/providers/{id}` — eliminación.【F:contexts/ProvidersContext.tsx†L122-L133】

### Permisos requeridos
- `listProviders` habilita el acceso desde el menú principal.【F:app/Home.tsx†L20-L37】
- `addProvider`, `updateProvider`, `deleteProvider` controlan botones de alta, edición y baja.【F:app/providers/index.tsx†L39-L150】【F:app/providers/[id].tsx†L12-L138】

### Pantallas relacionadas
- `app/providers/index.tsx` — listado con búsqueda difusa.【F:app/providers/index.tsx†L1-L138】
- `app/providers/create.tsx` — alta de proveedor.【F:app/providers/create.tsx†L1-L128】
- `app/providers/[id].tsx` — edición/borrado con guardas de permisos.【F:app/providers/[id].tsx†L1-L138】
- `app/providers/viewModal.tsx` — visualización resumida.【F:app/providers/viewModal.tsx†L1-L70】

## Trabajos (`JobsContext`)
### Modelo
- `Job`: asignación a cliente, horarios, estado, carpeta, tarifa/manual amount y adjuntos/participantes serializados.【F:contexts/JobsContext.tsx†L13-L35】

### Métodos del contexto
- `loadJobs()` normaliza tipos numéricos y parsea adjuntos/participantes.【F:contexts/JobsContext.tsx†L74-L107】
- `addJob(data)` aplica normalización de horas y campos opcionales antes de enviar.【F:contexts/JobsContext.tsx†L109-L174】
- `updateJob(id, data)` repite la normalización y solicita refresco remoto.【F:contexts/JobsContext.tsx†L176-L218】
- `deleteJob(id)` elimina el elemento en backend y en caché.【F:contexts/JobsContext.tsx†L221-L238】

### Endpoints consumidos
- `GET ${BASE_URL}/jobs` — listado principal.【F:contexts/JobsContext.tsx†L74-L103】
- `POST ${BASE_URL}/jobs` — creación.【F:contexts/JobsContext.tsx†L131-L148】
- `PUT ${BASE_URL}/jobs/{id}` — actualización.【F:contexts/JobsContext.tsx†L198-L214】
- `DELETE ${BASE_URL}/jobs/{id}` — eliminación.【F:contexts/JobsContext.tsx†L221-L236】

### Permisos requeridos
- `listJobs` protege el acceso y carga inicial.【F:app/Home.tsx†L20-L37】【F:app/jobs/index.tsx†L39-L47】
- `addJob`, `updateJob`, `deleteJob` condicionan creación, edición y bajas.【F:app/jobs/create.tsx†L146-L177】【F:app/jobs/[id].tsx†L47-L175】

### Pantallas relacionadas
- `app/jobs/index.tsx` — listado con métricas de duración y costos.【F:app/jobs/index.tsx†L1-L180】
- `app/jobs/create.tsx` — asistente de alta con cálculo automático de montos.【F:app/jobs/create.tsx†L120-L220】
- `app/jobs/[id].tsx` — edición avanzada con adjuntos, participantes y estado.【F:app/jobs/[id].tsx†L32-L179】
- `app/jobs/viewModal.tsx` — lectura detallada en modal.【F:app/jobs/viewModal.tsx†L1-L160】

## Agenda (`AppointmentsContext`)
### Modelo
- `Appointment`: enlace a cliente/trabajo, fecha, hora, ubicación, adjuntos y timestamps.【F:contexts/AppointmentsContext.tsx†L15-L26】

### Métodos del contexto
- `loadAppointments()` controla estado de carga y parseo de campos opcionales.【F:contexts/AppointmentsContext.tsx†L101-L124】
- `addAppointment(data)` agrega citas con serialización de adjuntos y timestamp.【F:contexts/AppointmentsContext.tsx†L126-L161】
- `updateAppointment(id, data)` aplica la misma transformación y refresca la lista.【F:contexts/AppointmentsContext.tsx†L166-L197】
- `deleteAppointment(id)` elimina y filtra en memoria.【F:contexts/AppointmentsContext.tsx†L202-L225】

### Endpoints consumidos
- `GET ${BASE_URL}/appointments` — carga inicial.【F:contexts/AppointmentsContext.tsx†L101-L114】
- `POST ${BASE_URL}/appointments` — alta.【F:contexts/AppointmentsContext.tsx†L138-L149】
- `PUT ${BASE_URL}/appointments/{id}` — actualización.【F:contexts/AppointmentsContext.tsx†L178-L189】
- `DELETE ${BASE_URL}/appointments/{id}` — baja.【F:contexts/AppointmentsContext.tsx†L202-L218】

### Permisos requeridos
- `listAppointments` habilita la vista calendario.【F:app/Home.tsx†L20-L37】【F:app/appointments/index.tsx†L67-L78】
- `addAppointment`, `updateAppointment`, `deleteAppointment` gobiernan creación, edición y eliminación.【F:app/appointments/create.tsx†L76-L178】【F:app/appointments/[id].tsx†L41-L101】【F:app/appointments/index.tsx†L67-L188】

### Pantallas relacionadas
- `app/appointments/index.tsx` — calendario y listado diario con acciones CRUD.【F:app/appointments/index.tsx†L46-L200】
- `app/appointments/create.tsx` — formulario de programación de visitas.【F:app/appointments/create.tsx†L60-L220】
- `app/appointments/[id].tsx` — edición con controles de fecha/hora y adjuntos.【F:app/appointments/[id].tsx†L41-L197】
- `app/appointments/viewModal.tsx` — lectura con acceso directo a edición.【F:app/appointments/viewModal.tsx†L20-L113】

## Pagos (`PaymentsContext`)
### Modelo
- `Payment`: fecha, cuenta de salida, acreedor (cliente/proveedor/otro), categoría, monto, adjuntos y banderas contables.【F:contexts/PaymentsContext.tsx†L13-L30】

### Métodos del contexto
- `loadPayments()` hidrata la cache financiera.【F:contexts/PaymentsContext.tsx†L145-L166】
- `addPayment(payment)` serializa adjuntos, envía `payment_template_id` cuando corresponde y recarga datos.【F:contexts/PaymentsContext.tsx†L168-L213】【F:app/payments/create.tsx†L478-L515】
- Tolera respuestas que entregan el ID del pago dentro de `payment`, `data` o únicamente a través del header `Location`, evitando bloqueos al crear pagos desde plantillas.【F:contexts/PaymentsContext.tsx†L50-L135】【F:contexts/PaymentsContext.tsx†L168-L213】
- `updatePayment(id, payment)` aplica la misma normalización y vuelve a cargar.【F:contexts/PaymentsContext.tsx†L215-L257】
- `deletePayment(id)` filtra el pago eliminado en memoria.【F:contexts/PaymentsContext.tsx†L260-L284】

### Endpoints consumidos
- `GET ${BASE_URL}/payments` — listado.【F:contexts/PaymentsContext.tsx†L145-L158】
- `POST ${BASE_URL}/payments` — alta.【F:contexts/PaymentsContext.tsx†L180-L201】
- `PUT ${BASE_URL}/payments/{id}` — actualización.【F:contexts/PaymentsContext.tsx†L227-L246】
- `DELETE ${BASE_URL}/payments/{id}` — baja.【F:contexts/PaymentsContext.tsx†L262-L274】
- `POST ${BASE_URL}/payments/report/pdf` — genera el PDF consolidado de comprobantes reales adjuntos a pagos dentro de un rango de fechas, ahora centralizado en este módulo.【F:docs/features/payments-report.md†L6-L35】
- `DELETE ${BASE_URL}/payments/report/{file_id}` — elimina el PDF de comprobantes generado y limpia su registro de archivos, con confirmación en la app.【F:docs/features/payments-report.md†L37-L44】【F:app/reports/index.tsx†L120-L191】

### Permisos requeridos
- `listPayments` habilita la vista general.【F:app/Home.tsx†L20-L37】【F:app/payments/index.tsx†L41-L133】
- `addPayment`, `updatePayment`, `deletePayment` gobiernan formularios y acciones destructivas.【F:app/payments/create.tsx†L166-L206】【F:app/payments/[id].tsx†L29-L120】【F:app/payments/index.tsx†L145-L187】
- `generatePaymentReport` permite solicitar el PDF consolidado de comprobantes de pagos con adjuntos de factura real.【F:docs/features/payments-report.md†L6-L35】
- `deleteReport` habilita la eliminación de reportes de comprobantes desde la app, previa confirmación del usuario.【F:app/reports/index.tsx†L120-L191】

### Pantallas relacionadas
- `app/payments/index.tsx` — listado con búsqueda y accesos a detalle/modales.【F:app/payments/index.tsx†L1-L187】
- `app/payments/create.tsx` — captura de pagos con selección de acreedor y adjuntos.【F:app/payments/create.tsx†L160-L207】
- `app/payments/[id].tsx` — edición completa, cambio de acreedor y carga a cliente.【F:app/payments/[id].tsx†L1-L205】
- `app/payments/viewModal.tsx` — lectura resumida, enlaza a edición.【F:app/payments/viewModal.tsx†L1-L99】

## Plantillas de pago (`PaymentTemplatesContext`)
### Modelo
- `PaymentTemplate`: define valores predeterminados de acreedor, categoría, cuenta contable, monto, icono sugerido, fecha estimada y adjuntos para reutilizar en altas de pagos.【F:contexts/PaymentTemplatesContext.tsx†L15-L43】
- El backend expone los campos `title`, `price`, `client_id`, `icon_name`, `payment_date` y `attached_files`, que la app normaliza respectivamente como `name`, `default_amount`, `default_charge_client_id`, `icon_name`, `default_payment_date` y `attached_files` para mantener compatibilidad con versiones previas.【F:contexts/PaymentTemplatesContext.tsx†L204-L236】

### Métodos del contexto
- `loadPaymentTemplates()` recupera las plantillas ordenadas por fecha más reciente y respeta el token Bearer activo.【F:contexts/PaymentTemplatesContext.tsx†L271-L309】
- `addPaymentTemplate(template)` serializa el payload, invoca `POST /payment_templates` y refresca la caché local tras crear la plantilla.【F:contexts/PaymentTemplatesContext.tsx†L319-L343】
- `updatePaymentTemplate(id, template)` envía `PUT /payment_templates/{id}`, reordena la colección y vuelve a consultar al backend cuando la respuesta es satisfactoria, incluso si el backend solo devuelve `Template updated` o un `204` sin cuerpo mientras `response.ok` sea verdadero.【F:contexts/PaymentTemplatesContext.tsx†L357-L404】
- `deletePaymentTemplate(id)` elimina la plantilla en el servidor con `DELETE /payment_templates/{id}` y filtra el ítem local al confirmar éxito, aceptando tanto `success: true`, `Template deleted` como respuestas vacías con `response.ok`.【F:contexts/PaymentTemplatesContext.tsx†L405-L432】
- Las respuestas de la API pueden incluir la plantilla como objeto anidado (`payment_template`, `template`) o sólo informar el identificador y un `Location` header; el contexto normaliza cualquiera de estos formatos antes de sincronizar el caché local.【F:contexts/PaymentTemplatesContext.tsx†L53-L258】

### Endpoints consumidos
- `GET ${BASE_URL}/payment_templates` — listado principal protegido por token Bearer.【F:contexts/PaymentTemplatesContext.tsx†L271-L309】
- `POST ${BASE_URL}/payment_templates` — alta de plantillas con validación de permisos.【F:contexts/PaymentTemplatesContext.tsx†L319-L343】
- `PUT ${BASE_URL}/payment_templates/{id}` — actualización de valores predeterminados.【F:contexts/PaymentTemplatesContext.tsx†L357-L393】
- `DELETE ${BASE_URL}/payment_templates/{id}` — baja lógica de plantillas reutilizables.【F:contexts/PaymentTemplatesContext.tsx†L407-L429】

### Permisos requeridos
- `listPaymentTemplates` habilita la navegación al listado y protege la pantalla de índices.【F:app/payment_templates/index.tsx†L61-L103】
- `addPaymentTemplate`, `updatePaymentTemplate`, `deletePaymentTemplate` controlan los formularios de creación/edición y la opción de eliminar desde listado o detalle.【F:app/payment_templates/index.tsx†L145-L187】【F:app/payment_templates/create.tsx†L71-L253】【F:app/payment_templates/[id].tsx†L85-L190】
- `usePaymentTemplateShortcuts` activa la vista de atajos "Planillas de pagos" para crear pagos desde una plantilla y restringe el acceso a la precarga de `/payments/create`.【F:constants/menuSections.ts†L29-L37】【F:app/shortcuts/payment_templates.tsx†L1-L139】
- Tras aprobar un pago generado desde esos atajos, la navegación redirige automáticamente al listado general de pagos para continuar con la gestión financiera.【F:app/payments/create.tsx†L488-L510】
- La pantalla de Permisos agrupa estos sectores en el bloque "Payment Templates" para facilitar su asignación global o por usuario.【F:app/permission/PermissionScreen.tsx†L23-L52】

### Pantallas relacionadas
- `app/payment_templates/index.tsx` — catálogo con filtros, orden dinámico y acceso a modales/detalle.【F:app/payment_templates/index.tsx†L1-L206】
- `app/payment_templates/create.tsx` — formulario de alta que reutiliza catálogos (clientes, proveedores, categorías, cajas), soporta selección diferida e incorpora un selector con buscador para elegir el `icon_name`.【F:components/IconSelector.tsx†L1-L213】【F:app/payment_templates/create.tsx†L1-L495】
- `app/payment_templates/[id].tsx` — edición con carga de datos locales, rescate de permisos, acciones de eliminación y el mismo selector enriquecido de iconos para actualizar el `icon_name`.【F:components/IconSelector.tsx†L1-L213】【F:app/payment_templates/[id].tsx†L1-L616】
- `app/shortcuts/payment_templates.tsx` — atajo que precarga `/payments/create` incluyendo la descripción, montos y acreedores predeterminados cuando existen en la plantilla, dejando que la fecha y la hora se definan al momento de la creación.【F:app/shortcuts/payment_templates.tsx†L74-L143】【F:app/payments/create.tsx†L90-L231】
- `app/payment_templates/viewModal.tsx` — modal de lectura con accesos a edición según permisos.【F:app/payment_templates/viewModal.tsx†L1-L139】

## Facturación (Invoices API)
- Documentación completa: [docs/features/invoices-api.md](./invoices-api.md).
- Integración en la app móvil: [docs/features/invoices-context.md](./invoices-context.md).
- Endpoints protegidos: requieren `Authorization: Bearer <token>` en todas las llamadas posteriores al login, en sintonía con las [notas de integración](#notas-de-integración-con-el-backend).
- Relaciones con clientes, trabajos o cobros se resuelven por identificadores sin claves foráneas en `sisa.api`, manteniendo la convención global del backend.
- El menú "Gestión financiera" muestra la opción "Facturas" únicamente cuando el perfil cuenta con `listInvoices`, enlazando al listado principal del módulo.【F:constants/menuSections.ts†L44-L52】
- Permisos esperados (`listInvoices`, `addInvoice`, `updateInvoice`, `deleteInvoice`, `voidInvoice`, `downloadInvoicePdf`) deben registrarse en la pantalla de permisos al habilitar nuevas secciones vinculadas al módulo. Los reportes consolidados se generan ahora desde pagos mediante `generatePaymentReport`.
- El historial expuesto por `/invoices/{id}/history` y `/invoices/history` soporta auditorías financieras y debe incluirse en la colección de Postman cuando se actualicen flujos.
- Los formularios de alta y edición mantienen los campos fiscales sensibles dentro de "Mostrar detalles adicionales": el número de factura es opcional, la moneda se elige con un selector que muestra 🇦🇷 ARS y 🇺🇸 USA, el estado se presenta con etiquetas en español y se incorpora un campo para registrar el porcentaje total de impuestos.【F:app/invoices/create.tsx†L470-L542】【F:app/invoices/[id].tsx†L474-L546】
- La edición incorpora acciones directas para **emitir** facturas en borrador (`issueInvoice`) y para **consultar el historial** (`listInvoiceHistory`), mostrando un modal con eventos y payloads normalizados que consumen los endpoints `/invoices/{id}/issue` y `/invoices/{id}/history`.【F:app/invoices/[id].tsx†L678-L940】【F:contexts/InvoicesContext.tsx†L830-L915】

## Recibos (`ReceiptsContext`)
### Modelo
- `Receipt`: fecha, cuenta de ingreso, pagador, categoría, monto, adjuntos y bandera de pago a proveedor.【F:contexts/ReceiptsContext.tsx†L13-L28】

### Métodos del contexto
- `loadReceipts()` sincroniza el listado local.【F:contexts/ReceiptsContext.tsx†L51-L63】
- `addReceipt(receipt)` serializa adjuntos y refresca datos.【F:contexts/ReceiptsContext.tsx†L69-L101】
- `updateReceipt(id, receipt)` sigue la misma estrategia de actualización.【F:contexts/ReceiptsContext.tsx†L105-L135】
- `deleteReceipt(id)` elimina del backend y de la caché.【F:contexts/ReceiptsContext.tsx†L140-L158】

### Endpoints consumidos
- `GET ${BASE_URL}/receipts` — consulta.【F:contexts/ReceiptsContext.tsx†L51-L59】
- `POST ${BASE_URL}/receipts` — alta.【F:contexts/ReceiptsContext.tsx†L81-L90】
- `PUT ${BASE_URL}/receipts/{id}` — actualización.【F:contexts/ReceiptsContext.tsx†L117-L129】
- `DELETE ${BASE_URL}/receipts/{id}` — baja.【F:contexts/ReceiptsContext.tsx†L140-L153】

### Permisos requeridos
- `listReceipts` abre el módulo desde el menú y el listado.【F:app/Home.tsx†L20-L37】【F:app/receipts/index.tsx†L41-L48】
- `addReceipt`, `updateReceipt`, `deleteReceipt` habilitan acciones de creación/edición/eliminación.【F:app/receipts/create.tsx†L166-L206】【F:app/receipts/[id].tsx†L31-L314】【F:app/receipts/index.tsx†L57-L133】

### Pantallas relacionadas
- `app/receipts/index.tsx` — listado con búsqueda y navegación a detalles.【F:app/receipts/index.tsx†L1-L136】
- `app/receipts/create.tsx` — alta de recibos con adjuntos.【F:app/receipts/create.tsx†L160-L206】
- `app/receipts/[id].tsx` — edición avanzada y gestión de adjuntos.【F:app/receipts/[id].tsx†L31-L314】
- `app/receipts/viewModal.tsx` — vista de detalle condensada.【F:app/receipts/viewModal.tsx†L1-L99】

## Tarifas (`TariffsContext`)
### Modelo
- `Tariff`: nombre, monto y fecha de última actualización.【F:contexts/TariffsContext.tsx†L13-L17】

### Métodos del contexto
- `loadTariffs()` transforma importes a número y cachea resultados.【F:contexts/TariffsContext.tsx†L40-L55】
- `addTariff(tariff)` crea registros y refresca el catálogo.【F:contexts/TariffsContext.tsx†L61-L88】
- `updateTariff(id, tariff)` actualiza valores y `last_update`.【F:contexts/TariffsContext.tsx†L91-L117】
- `deleteTariff(id)` elimina del backend y del estado local.【F:contexts/TariffsContext.tsx†L120-L132】

### Endpoints consumidos
- `GET ${BASE_URL}/tariffs` — listado.【F:contexts/TariffsContext.tsx†L40-L48】
- `POST ${BASE_URL}/tariffs` — creación.【F:contexts/TariffsContext.tsx†L61-L70】
- `PUT ${BASE_URL}/tariffs/{id}` — actualización.【F:contexts/TariffsContext.tsx†L94-L107】
- `DELETE ${BASE_URL}/tariffs/{id}` — baja.【F:contexts/TariffsContext.tsx†L120-L131】

### Permisos requeridos
- `listTariffs` para entrar al módulo.【F:app/Home.tsx†L20-L37】【F:app/tariffs/index.tsx†L28-L35】
- `addTariff`, `updateTariff`, `deleteTariff` controlan los flujos CRUD.【F:app/tariffs/create.tsx†L19-L39】【F:app/tariffs/[id].tsx†L32-L120】【F:app/tariffs/index.tsx†L44-L121】

### Pantallas relacionadas
- `app/tariffs/index.tsx` — catálogo de tarifas con filtros y acciones.【F:app/tariffs/index.tsx†L1-L124】
- `app/tariffs/create.tsx` — alta sencilla de tarifa.【F:app/tariffs/create.tsx†L1-L62】
- `app/tariffs/[id].tsx` — edición y eliminación de tarifas.【F:app/tariffs/[id].tsx†L1-L160】
- `app/tariffs/viewModal.tsx` — modal informativo.【F:app/tariffs/viewModal.tsx†L10-L47】

## Estados (`StatusesContext`)
### Modelo
- `Status`: etiqueta, valor interno, color de fondo, orden y metadatos de versión.【F:contexts/StatusesContext.tsx†L12-L20】

### Métodos del contexto
- `loadStatuses()` obtiene y cachea estados.【F:contexts/StatusesContext.tsx†L53-L61】
- `addStatus(status)` crea registros y recarga la lista.【F:contexts/StatusesContext.tsx†L67-L95】
- `updateStatus(id, status)` reemplaza datos existentes.【F:contexts/StatusesContext.tsx†L99-L124】
- `deleteStatus(id)` elimina un estado en backend y memoria.【F:contexts/StatusesContext.tsx†L128-L139】
- `reorderStatuses(orderedIds)` envía el nuevo orden a la API.【F:contexts/StatusesContext.tsx†L145-L163】

### Endpoints consumidos
- `GET ${BASE_URL}/statuses` — catálogo inicial.【F:contexts/StatusesContext.tsx†L53-L61】
- `POST ${BASE_URL}/statuses` — alta.【F:contexts/StatusesContext.tsx†L72-L89】
- `PUT ${BASE_URL}/statuses/{id}` — actualización.【F:contexts/StatusesContext.tsx†L105-L118】
- `DELETE ${BASE_URL}/statuses/{id}` — baja.【F:contexts/StatusesContext.tsx†L128-L136】
- `PUT ${BASE_URL}/statuses/reorder` — reordenamiento masivo.【F:contexts/StatusesContext.tsx†L145-L158】

### Permisos requeridos
- `listStatuses` controla el acceso inicial.【F:app/Home.tsx†L20-L37】【F:app/statuses/index.tsx†L27-L34】
- `addStatus`, `updateStatus`, `deleteStatus` habilitan creación, edición y eliminación.【F:app/statuses/index.tsx†L43-L117】【F:app/statuses/[id].tsx†L35-L132】

### Pantallas relacionadas
- `app/statuses/index.tsx` — catálogo con búsqueda y acciones rápidas.【F:app/statuses/index.tsx†L1-L119】
- `app/statuses/create.tsx` — formulario de alta (controla `addStatus`).【F:app/statuses/create.tsx†L1-L120】
- `app/statuses/[id].tsx` — edición/eliminación de estados.【F:app/statuses/[id].tsx†L1-L132】
- `app/statuses/viewModal.tsx` — detalle rápido con enlace a edición.【F:app/statuses/viewModal.tsx†L9-L42】

## Cajas (`CashBoxesContext`)
### Modelo
- `CashBox`: nombre, imagen asociada, usuario responsable, `assigned_user_ids` para habilitar operadores y `admin_permissions` para documentar banderas administrativas como asignación de usuarios o gestión avanzada.【F:contexts/CashBoxesContext.tsx†L13-L25】

### Métodos del contexto
- `loadCashBoxes()` carga y cachea el inventario de cajas, normalizando usuarios asignados y permisos administrativos.【F:contexts/CashBoxesContext.tsx†L46-L77】
- `addCashBox(data)` crea cajas, envía `assigned_users`/`admin_permissions` y fuerza recarga.【F:contexts/CashBoxesContext.tsx†L83-L112】
- `updateCashBox(id, data)` actualiza nombre, imagen y permisos/admins asociados.【F:contexts/CashBoxesContext.tsx†L116-L158】
- `deleteCashBox(id)` elimina la caja en backend y estado local.【F:contexts/CashBoxesContext.tsx†L160-L188】
- `listCashBoxHistory(id)` obtiene histórico de movimientos desde la API.【F:contexts/CashBoxesContext.tsx†L194-L209】

### Endpoints consumidos
- `GET ${BASE_URL}/cash_boxes` — listado con usuarios asignados y banderas administrativas.【F:contexts/CashBoxesContext.tsx†L46-L77】
- `POST ${BASE_URL}/cash_boxes` — creación con payload de asignaciones y permisos.【F:contexts/CashBoxesContext.tsx†L83-L105】
- `PUT ${BASE_URL}/cash_boxes/{id}` — actualización de nombre, imagen y permisos administrativos.【F:contexts/CashBoxesContext.tsx†L116-L147】
- `DELETE ${BASE_URL}/cash_boxes/{id}` — baja.【F:contexts/CashBoxesContext.tsx†L160-L185】
- `GET ${BASE_URL}/cash_boxes/{id}/history` — historial (consulta opcional).【F:contexts/CashBoxesContext.tsx†L194-L205】

### Permisos requeridos
- `listCashBoxes` para acceder a la sección.【F:app/Home.tsx†L22-L39】【F:app/cash_boxes/index.tsx†L70-L137】
- `addCashBox`, `updateCashBox`, `deleteCashBox` determinan las acciones CRUD.【F:app/cash_boxes/create.tsx†L17-L133】【F:app/cash_boxes/[id].tsx†L18-L238】【F:app/cash_boxes/index.tsx†L139-L237】
- `assignCashBoxUsers` y `manageCashBoxPermissions` documentan la trazabilidad de asignaciones y banderas administrativas en la pantalla de permisos.【F:app/permission/PermissionScreen.tsx†L53-L82】
- Las acciones de alta/edición/baja requieren que el usuario sea administrador de la empresa o el usuario maestro (`userId === 1`).【F:hooks/useCompanyAdminPrivileges.ts†L1-L20】【F:app/cash_boxes/index.tsx†L139-L237】【F:app/cash_boxes/[id].tsx†L37-L238】

### Pantallas relacionadas
- `app/cash_boxes/index.tsx` — listado con filtros y eliminación.【F:app/cash_boxes/index.tsx†L1-L126】
- `app/cash_boxes/create.tsx` — formulario de alta.【F:app/cash_boxes/create.tsx†L13-L81】
- `app/cash_boxes/[id].tsx` — edición, cambio de imagen y baja.【F:app/cash_boxes/[id].tsx†L11-L158】

## Productos y servicios (`ProductsServicesContext`)
### Modelo
- `ProductService`: descripción, categoría, precios, dificultad, tipo (producto/servicio), stock y metadatos de imagen.【F:contexts/ProductsServicesContext.tsx†L13-L23】

### Métodos del contexto
- `loadProductsServices()` carga el catálogo cacheado.【F:contexts/ProductsServicesContext.tsx†L49-L56】
- `addProductService(item)` registra ítems y refresca la colección.【F:contexts/ProductsServicesContext.tsx†L61-L80】
- `updateProductService(id, item)` actualiza datos y fuerza recarga.【F:contexts/ProductsServicesContext.tsx†L84-L103】
- `deleteProductService(id)` elimina registros en backend y memoria.【F:contexts/ProductsServicesContext.tsx†L106-L120】

### Endpoints consumidos
- `GET ${BASE_URL}/products_services` — listado.【F:contexts/ProductsServicesContext.tsx†L49-L55】
- `POST ${BASE_URL}/products_services` — creación.【F:contexts/ProductsServicesContext.tsx†L63-L68】
- `PUT ${BASE_URL}/products_services/{id}` — actualización.【F:contexts/ProductsServicesContext.tsx†L87-L95】
- `DELETE ${BASE_URL}/products_services/{id}` — baja.【F:contexts/ProductsServicesContext.tsx†L106-L114】

### Permisos requeridos
- `listProductsServices` protege la carga del catálogo.【F:app/products_services/index.tsx†L30-L38】
- `addProductService`, `updateProductService`, `deleteProductService` controlan alta, edición y baja.【F:app/products_services/create.tsx†L13-L49】【F:app/products_services/[id].tsx†L32-L138】【F:app/products_services/index.tsx†L46-L112】

### Pantallas relacionadas
- `app/products_services/index.tsx` — listado con filtros por texto.【F:app/products_services/index.tsx†L1-L113】
- `app/products_services/create.tsx` — alta de productos/servicios.【F:app/products_services/create.tsx†L1-L74】
- `app/products_services/[id].tsx` — edición integral y eliminación.【F:app/products_services/[id].tsx†L11-L149】

## Carpetas de clientes (`FoldersContext`)
### Modelo
- `Folder`: nombre, jerarquía (`parent_id`), imagen y asociación al cliente/usuario que la creó.【F:contexts/FoldersContext.tsx†L15-L22】
- `FolderInput`: payload utilizado para altas/ediciones (sin IDs ni usuario).【F:contexts/FoldersContext.tsx†L24-L29】

### Métodos del contexto
- `loadFolders()` sólo ejecuta la carga si el usuario posee `listFolders`, evitando llamadas innecesarias.【F:contexts/FoldersContext.tsx†L47-L68】
- `addFolder(folder)` valida permisos antes de invocar la API y recargar.【F:contexts/FoldersContext.tsx†L70-L89】
- `updateFolder(id, folder)` y `deleteFolder(id)` repiten la verificación de permisos y refrescan los datos tras completar la operación.【F:contexts/FoldersContext.tsx†L92-L133】

### Endpoints consumidos
- `GET ${BASE_URL}/folders` — recuperación condicionada por permisos.【F:contexts/FoldersContext.tsx†L52-L63】
- `POST ${BASE_URL}/folders` — creación.【F:contexts/FoldersContext.tsx†L73-L82】
- `PUT ${BASE_URL}/folders/{id}` — actualización.【F:contexts/FoldersContext.tsx†L95-L107】
- `DELETE ${BASE_URL}/folders/{id}` — eliminación.【F:contexts/FoldersContext.tsx†L114-L127】

### Permisos requeridos
- `listFolders` controla el acceso y la carga inicial.【F:app/Home.tsx†L20-L37】【F:contexts/FoldersContext.tsx†L47-L68】
- `addFolder`, `updateFolder`, `deleteFolder` habilitan las acciones CRUD y están validados tanto en el contexto como en las pantallas.【F:contexts/FoldersContext.tsx†L70-L133】【F:app/folders/index.tsx†L39-L164】【F:app/folders/[id].tsx†L45-L158】

### Pantallas relacionadas
- `app/folders/index.tsx` — navegación jerárquica por clientes y subcarpetas.【F:app/folders/index.tsx†L1-L165】
- `app/folders/create.tsx` — alta con selección de cliente/carpeta padre.【F:app/folders/create.tsx†L16-L104】
- `app/folders/[id].tsx` — edición, cambio de jerarquía y eliminación.【F:app/folders/[id].tsx†L14-L155】

