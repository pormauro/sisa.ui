# Módulos operativos y contratos de contexto

Esta guía resume los modelos, operaciones disponibles y dependencias de permisos para los principales contextos de datos del cliente móvil de SISA. Cada sección referencia el archivo de contexto correspondiente, los endpoints REST que consume (prefijados por `BASE_URL`) y las pantallas de Expo Router que materializan la funcionalidad.

## Notas de integración con el backend
- Todas las peticiones realizadas tras el inicio de sesión deben enviar el encabezado `Authorization: Bearer <token>`; el flujo de login es la única excepción. La API tiene que emitir el token en el login y validar su presencia en el resto de rutas protegidas.【F:docs/setup-and-configuration.md†L16-L24】
- La base de datos de `sisa.api` se mantiene sin claves foráneas: las relaciones se resuelven en la capa de aplicación. Mantén esta restricción al definir nuevas tablas o integraciones.【F:docs/setup-and-configuration.md†L21-L26】

## Clientes (`ClientsContext`)
### Modelo
- `Client`: identifica razón social, CUIT, contacto, tarifa asociada y metadatos de versión/fechas.【F:contexts/ClientsContext.tsx†L12-L23】

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
- `app/clients/index.tsx` — listado con búsqueda y acceso a detalles.【F:app/clients/index.tsx†L1-L152】
- `app/clients/create.tsx` — formulario de alta con selección de tarifa.【F:app/clients/create.tsx†L1-L120】
- `app/clients/[id].tsx` — edición y eliminación condicionadas por permisos.【F:app/clients/[id].tsx†L1-L160】
- `app/clients/viewModal.tsx` — modal de lectura rápida.【F:app/clients/viewModal.tsx†L1-L100】

## Empresas (`CompaniesContext`)
### Modelo
- `Company`: agrupa razón social, datos de contacto y arrays embebidos para identidad fiscal, direcciones y contactos comerciales.【F:contexts/CompaniesContext.tsx†L48-L66】
- `TaxIdentity`, `CompanyAddress`, `CompanyContact`: describen cada elemento de los bloques anidados consumidos por las pantallas de Expo.【F:contexts/CompaniesContext.tsx†L14-L45】

### Métodos del contexto
- `loadCompanies()`: lee `/companies`, normaliza la respuesta y la ordena por fecha antes de hidratar el estado compartido.【F:contexts/CompaniesContext.tsx†L229-L245】
- `addCompany(company)`: serializa los bloques anidados, envía el `POST /companies` y fuerza un refresco posterior para mantener la caché alineada.【F:contexts/CompaniesContext.tsx†L251-L278】
- `updateCompany(id, company)`: ejecuta `PUT /companies/{id}`, fusiona el resultado con el estado local y vuelve a consultar el listado.【F:contexts/CompaniesContext.tsx†L287-L324】
- `deleteCompany(id)`: llama a `DELETE /companies/{id}` y depura la empresa eliminada del store local.【F:contexts/CompaniesContext.tsx†L333-L351】

### Endpoints consumidos
- `GET ${BASE_URL}/companies` — listado completo con identidades fiscales, direcciones y contactos embebidos.【F:contexts/CompaniesContext.tsx†L229-L245】
- `POST ${BASE_URL}/companies` — creación de empresa con payload serializado para arrays anidados.【F:contexts/CompaniesContext.tsx†L251-L278】
- `PUT ${BASE_URL}/companies/{id}` — actualización del registro y sincronización local.【F:contexts/CompaniesContext.tsx†L287-L324】
- `DELETE ${BASE_URL}/companies/{id}` — baja lógica y limpieza de caché.【F:contexts/CompaniesContext.tsx†L333-L351】

### Permisos requeridos
- `listCompanies` habilita el listado y la navegación desde el menú principal.【F:app/companies/index.tsx†L57-L99】【F:constants/menuSections.ts†L48-L62】
- `addCompany`, `updateCompany`, `deleteCompany` controlan accesos a formularios de alta, edición y baja en las pantallas protegidas.【F:app/companies/create.tsx†L61-L105】【F:app/companies/[id].tsx†L136-L157】【F:app/companies/viewModal.tsx†L11-L45】

### Pantallas relacionadas
- `app/companies/index.tsx` — listado con búsqueda difusa y accesos a modal/detalle.【F:app/companies/index.tsx†L1-L200】
- `app/companies/create.tsx` — formulario de alta con constructores de identidades, direcciones y contactos.【F:app/companies/create.tsx†L1-L200】
- `app/companies/[id].tsx` — edición avanzada que reutiliza los bloques anidados y permite bajas condicionadas por permisos.【F:app/companies/[id].tsx†L1-L157】
- `app/companies/viewModal.tsx` — modal de lectura que expone identidades fiscales, direcciones y contactos cargados por la API.【F:app/companies/viewModal.tsx†L1-L160】

### Consumo de identidad fiscal, direcciones y contactos
- El `GET /companies` retorna las colecciones `tax_identities`, `addresses` y `contacts`; `parseCompany` las transforma en estructuras tipadas que el frontend muestra directamente en las pantallas de Expo.【F:contexts/CompaniesContext.tsx†L160-L188】【F:app/companies/viewModal.tsx†L107-L160】
- Las operaciones de alta y edición serializan los bloques anidados antes de invocar la API, manteniendo la compatibilidad con la base `sisa.api`, que continúa sin claves foráneas según lo acordado a nivel backend.【F:contexts/CompaniesContext.tsx†L205-L218】【F:docs/setup-and-configuration.md†L21-L26】
- Todos los requests al endpoint `/companies` incluyen el encabezado `Authorization: Bearer <token>`, requisito obligatorio salvo en el flujo de login inicial.【F:contexts/CompaniesContext.tsx†L229-L344】【F:docs/setup-and-configuration.md†L14-L24】

## Membresías de empresas (`CompanyMembershipsContext`)
### Modelo
- `CompanyMembership`: vincula una empresa con un usuario final e incluye datos auxiliares como rol, estado, notas y marcas de auditoría.【F:contexts/CompanyMembershipsContext.tsx†L14-L39】

### Métodos del contexto
- `loadCompanyMemberships()`: consulta `/company_memberships`, normaliza la colección devuelta y la almacena en caché local.【F:contexts/CompanyMembershipsContext.tsx†L86-L138】
- `addCompanyMembership(payload)`: serializa el vínculo empresa-usuario, envía `POST /company_memberships` e inserta la respuesta en el estado compartido.【F:contexts/CompanyMembershipsContext.tsx†L140-L185】
- `updateCompanyMembership(id, payload)`: ejecuta `PUT /company_memberships/{id}` y fusiona la respuesta con el elemento existente.【F:contexts/CompanyMembershipsContext.tsx†L187-L227】
- `deleteCompanyMembership(id)`: elimina el registro remoto mediante `DELETE /company_memberships/{id}` y depura la caché local.【F:contexts/CompanyMembershipsContext.tsx†L229-L253】

### Endpoints consumidos
- `GET ${BASE_URL}/company_memberships` — listado actualizado de membresías.【F:contexts/CompanyMembershipsContext.tsx†L103-L138】
- `POST ${BASE_URL}/company_memberships` — alta de relación empresa-usuario.【F:contexts/CompanyMembershipsContext.tsx†L140-L185】
- `PUT ${BASE_URL}/company_memberships/{id}` — actualización del vínculo existente.【F:contexts/CompanyMembershipsContext.tsx†L187-L222】
- `DELETE ${BASE_URL}/company_memberships/{id}` — baja lógica del vínculo.【F:contexts/CompanyMembershipsContext.tsx†L229-L253】

### Permisos requeridos
- `listCompanyMemberships` habilita el módulo desde el menú comercial.【F:constants/menuSections.ts†L36-L40】【F:app/company_memberships/index.tsx†L44-L67】
- `addCompanyMembership`, `updateCompanyMembership`, `deleteCompanyMembership` controlan la disponibilidad de altas, ediciones y bajas dentro de las pantallas del módulo.【F:app/company_memberships/index.tsx†L44-L172】【F:app/company_memberships/create.tsx†L24-L109】【F:app/company_memberships/[id].tsx†L44-L211】

### Pantallas relacionadas
- `app/company_memberships/index.tsx` — listado con búsqueda, orden dinámico y acciones rápidas de baja.【F:app/company_memberships/index.tsx†L1-L196】
- `app/company_memberships/create.tsx` — formulario de alta que reutiliza catálogos de empresas y usuarios registrados.【F:app/company_memberships/create.tsx†L1-L147】
- `app/company_memberships/[id].tsx` — edición del vínculo con controles para reasignar usuario, actualizar rol/estado y eliminar la membresía.【F:app/company_memberships/[id].tsx†L1-L258】
- `app/company_memberships/viewModal.tsx` — vista de lectura rápida con opción de salto a edición si el usuario posee permisos.【F:app/company_memberships/viewModal.tsx†L1-L94】

## Proveedores (`ProvidersContext`)
### Modelo
- `Provider`: razón social, identificadores y datos de contacto opcionales.【F:contexts/ProvidersContext.tsx†L13-L21】

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
- `loadPayments()` hidrata la cache financiera.【F:contexts/PaymentsContext.tsx†L51-L72】
- `addPayment(payment)` serializa adjuntos y recarga datos.【F:contexts/PaymentsContext.tsx†L74-L108】
- `updatePayment(id, payment)` aplica la misma normalización y vuelve a cargar.【F:contexts/PaymentsContext.tsx†L110-L148】
- `deletePayment(id)` filtra el pago eliminado en memoria.【F:contexts/PaymentsContext.tsx†L150-L168】

### Endpoints consumidos
- `GET ${BASE_URL}/payments` — listado.【F:contexts/PaymentsContext.tsx†L56-L67】
- `POST ${BASE_URL}/payments` — alta.【F:contexts/PaymentsContext.tsx†L86-L100】
- `PUT ${BASE_URL}/payments/{id}` — actualización.【F:contexts/PaymentsContext.tsx†L122-L140】
- `DELETE ${BASE_URL}/payments/{id}` — baja.【F:contexts/PaymentsContext.tsx†L150-L164】

### Permisos requeridos
- `listPayments` habilita la vista general.【F:app/Home.tsx†L20-L37】【F:app/payments/index.tsx†L41-L133】
- `addPayment`, `updatePayment`, `deletePayment` gobiernan formularios y acciones destructivas.【F:app/payments/create.tsx†L166-L206】【F:app/payments/[id].tsx†L29-L120】【F:app/payments/index.tsx†L145-L187】

### Pantallas relacionadas
- `app/payments/index.tsx` — listado con búsqueda y accesos a detalle/modales.【F:app/payments/index.tsx†L1-L187】
- `app/payments/create.tsx` — captura de pagos con selección de acreedor y adjuntos.【F:app/payments/create.tsx†L160-L207】
- `app/payments/[id].tsx` — edición completa, cambio de acreedor y carga a cliente.【F:app/payments/[id].tsx†L1-L205】
- `app/payments/viewModal.tsx` — lectura resumida, enlaza a edición.【F:app/payments/viewModal.tsx†L1-L99】

## Plantillas de pago (`PaymentTemplatesContext`)
### Modelo
- `PaymentTemplate`: define valores predeterminados de acreedor, categoría, cuenta contable, monto y banderas para reutilizar en altas de pagos.【F:contexts/PaymentTemplatesContext.tsx†L15-L43】
- El backend expone los campos `title`, `price` y `client_id`, que la app normaliza respectivamente como `name`, `default_amount` y `default_charge_client_id` para mantener compatibilidad con versiones previas.【F:contexts/PaymentTemplatesContext.tsx†L208-L234】

### Métodos del contexto
- `loadPaymentTemplates()` recupera las plantillas ordenadas por fecha más reciente y respeta el token Bearer activo.【F:contexts/PaymentTemplatesContext.tsx†L271-L309】
- `addPaymentTemplate(template)` serializa el payload, invoca `POST /payment_templates` y refresca la caché local tras crear la plantilla.【F:contexts/PaymentTemplatesContext.tsx†L319-L343】
- `updatePaymentTemplate(id, template)` envía `PUT /payment_templates/{id}`, reordena la colección y vuelve a consultar al backend cuando la respuesta es satisfactoria.【F:contexts/PaymentTemplatesContext.tsx†L357-L393】
- `deletePaymentTemplate(id)` elimina la plantilla en el servidor con `DELETE /payment_templates/{id}` y filtra el ítem local al confirmar éxito.【F:contexts/PaymentTemplatesContext.tsx†L407-L429】
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
- La pantalla de Permisos agrupa estos sectores en el bloque "Payment Templates" para facilitar su asignación global o por usuario.【F:app/permission/PermissionScreen.tsx†L23-L52】

### Pantallas relacionadas
- `app/payment_templates/index.tsx` — catálogo con filtros, orden dinámico y acceso a modales/detalle.【F:app/payment_templates/index.tsx†L1-L206】
- `app/payment_templates/create.tsx` — formulario de alta que reutiliza catálogos (clientes, proveedores, categorías, cajas) y soporta selección diferida.【F:app/payment_templates/create.tsx†L1-L462】
- `app/payment_templates/[id].tsx` — edición con carga de datos locales, rescate de permisos y acciones de eliminación.【F:app/payment_templates/[id].tsx†L1-L205】
- `app/payment_templates/viewModal.tsx` — modal de lectura con accesos a edición según permisos.【F:app/payment_templates/viewModal.tsx†L1-L139】

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
- `CashBox`: nombre, imagen asociada y usuario responsable.【F:contexts/CashBoxesContext.tsx†L13-L19】

### Métodos del contexto
- `loadCashBoxes()` carga y cachea el inventario de cajas.【F:contexts/CashBoxesContext.tsx†L46-L57】
- `addCashBox(data)` crea cajas y fuerza recarga.【F:contexts/CashBoxesContext.tsx†L63-L85】
- `updateCashBox(id, data)` actualiza nombre/imagen.【F:contexts/CashBoxesContext.tsx†L89-L107】
- `deleteCashBox(id)` elimina la caja en backend y estado local.【F:contexts/CashBoxesContext.tsx†L116-L128】
- `listCashBoxHistory(id)` obtiene histórico de movimientos desde la API.【F:contexts/CashBoxesContext.tsx†L136-L151】

### Endpoints consumidos
- `GET ${BASE_URL}/cash_boxes` — listado.【F:contexts/CashBoxesContext.tsx†L46-L55】
- `POST ${BASE_URL}/cash_boxes` — creación.【F:contexts/CashBoxesContext.tsx†L63-L74】
- `PUT ${BASE_URL}/cash_boxes/{id}` — actualización.【F:contexts/CashBoxesContext.tsx†L89-L103】
- `DELETE ${BASE_URL}/cash_boxes/{id}` — baja.【F:contexts/CashBoxesContext.tsx†L116-L127】
- `GET ${BASE_URL}/cash_boxes/{id}/history` — historial (consulta opcional).【F:contexts/CashBoxesContext.tsx†L136-L147】

### Permisos requeridos
- `listCashBoxes` para acceder a la sección.【F:app/Home.tsx†L28-L36】【F:app/cash_boxes/index.tsx†L38-L46】
- `addCashBox`, `updateCashBox`, `deleteCashBox` determinan las acciones CRUD.【F:app/cash_boxes/create.tsx†L29-L41】【F:app/cash_boxes/[id].tsx†L31-L112】【F:app/cash_boxes/index.tsx†L55-L126】

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

## Comentarios (`CommentsContext`)
### Modelo
- `CommentEntry`: identifica autor, título, comentario, archivos asociados (`file_ids` como arreglo), estado, respuesta y metadatos de seguimiento (fechas y usuario que responde).【F:contexts/CommentsContext.tsx†L17-L52】

### Métodos del contexto
- `loadMyComments()`: sincroniza los comentarios enviados por el usuario autenticado.【F:contexts/CommentsContext.tsx†L214-L239】
- `loadAllComments()`: recupera todos los comentarios para usuarios con permisos de respuesta.【F:contexts/CommentsContext.tsx†L241-L268】
- `submitComment(payload)`: registra un nuevo comentario del usuario y actualiza las colecciones en caché.【F:contexts/CommentsContext.tsx†L270-L306】
- `respondComment(id, response)`: guarda la respuesta del superusuario y refresca los listados.【F:contexts/CommentsContext.tsx†L308-L340】

### Endpoints consumidos
- `GET ${BASE_URL}/comments/mine` — listado personal del usuario.【F:contexts/CommentsContext.tsx†L226-L235】
- `GET ${BASE_URL}/comments` — listado global para revisión del superusuario.【F:contexts/CommentsContext.tsx†L239-L268】
- `POST ${BASE_URL}/comments` — envío de comentarios por parte del usuario autenticado.【F:contexts/CommentsContext.tsx†L270-L306】
- `POST ${BASE_URL}/comments/{id}/respond` — registro/actualización de la respuesta del superusuario.【F:contexts/CommentsContext.tsx†L308-L340】

### Permisos requeridos
- `listComments` habilita el acceso al módulo desde el menú (todos los usuarios que puedan enviar comentarios deberían contar con él).【F:constants/menuSections.ts†L63-L70】
- `addComment` controla la visibilidad del formulario de envío en la app móvil.【F:app/comments/index.tsx†L53-L84】【F:app/comments/create.tsx†L32-L99】
- `respondComment` habilita la vista consolidada y la posibilidad de responder comentarios ajenos.【F:app/comments/index.tsx†L53-L113】【F:app/comments/[id].tsx†L69-L170】

### Pantallas relacionadas
- `app/comments/index.tsx` — listado personal/global con filtros por permiso y acceso a detalles.【F:app/comments/index.tsx†L1-L214】
- `app/comments/create.tsx` — formulario para que cualquier usuario envíe un nuevo comentario.【F:app/comments/create.tsx†L1-L168】
- `app/comments/[id].tsx` — detalle del comentario con lectura de respuesta, archivos adjuntos y formulario para responder si corresponde.【F:app/comments/[id].tsx†L1-L228】
