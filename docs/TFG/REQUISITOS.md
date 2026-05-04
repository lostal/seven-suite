# 3. Requisitos

> [← Cap. 2](MARCO_TEORICO.md) · [Índice](../../README.md) · [Siguiente →](ANALISIS_DISENO.md)

## Contenido

- [3.1. Sesiones de levantamiento de información](#31-sesiones-de-levantamiento-de-información)
- [3.2. Modelo del dominio](#32-modelo-del-dominio)
  - [3.2.1. Diagrama de clases del dominio](#321-diagrama-de-clases-del-dominio)
  - [3.2.2. Diagramas de estados](#322-diagramas-de-estados)
  - [3.2.3. Glosario](#323-glosario)
  - [3.2.4. Requisitos suplementarios](#324-requisitos-suplementarios)
- [3.3. Disciplina de requisitos](#33-disciplina-de-requisitos)
  - [3.3.1. Diagrama de contexto](#331-diagrama-de-contexto)
  - [3.3.2. Actores del sistema](#332-actores-del-sistema)
  - [3.3.3. Casos de uso](#333-casos-de-uso)
  - [3.3.4. Detalle de casos de uso representativos](#334-detalle-de-casos-de-uso-representativos)
  - [3.3.5. Prototipos de interfaz](#335-prototipos-de-interfaz)

El objetivo de esta iteración es delimitar el alcance del sistema mediante la construcción del
modelo del dominio y la especificación de los casos de uso del MVP. El resultado es el acuerdo
formal entre cliente y desarrollador sobre lo que el sistema debe hacer, expresado en artefactos
UML trazables al código y a los entregables posteriores.

## 3.1. Sesiones de levantamiento de información

El levantamiento de requisitos se realizó mediante videollamadas con el perfil clave de
GRUPOSIETE: el director de IT de la empresa que además trabaja en la sede de Alcobendas.

Las sesiones pusieron de manifiesto tres patrones de uso recurrentes. El primero es la
coordinación informal de plazas de parking mediante WhatsApp: los directivos comunican su
ausencia al grupo general y cualquier empleado responde en hilo libre, sin registro, sin confirmación
y sin visibilidad del estado real de ocupación. El segundo es la gestión de puestos de oficina: dado
que la sede tiene 240 m² y no todos los empleados acuden a diario, existe un problema crónico de
infrautilización algunos días. El tercero es la gestión de ausencias: las solicitudes de vacaciones se
tramitan directamente a través de un Excel (los responsables se encargan de pasar a RRHH las
vacaciones de los empleados de su sede).

De las sesiones emergieron tres decisiones de diseño que condicionan el resto del análisis.
Primera: la cesión de plazas de parking debe ser una operación intencional del propietario, no una
liberación automática, para evitar conflictos de acceso. Segunda: el sistema debe integrarse con
Microsoft 365 para la detección automática del estado fuera de oficina, ya que los directivos
utilizan Outlook de forma habitual. Tercera: el flujo de aprobación de ausencias debe contemplar
dos niveles (manager y RRHH) para respetar la estructura organizativa actual de la empresa.

## 3.2. Modelo del dominio

El modelo del dominio construye una abstracción de la realidad de GRUPOSIETE independiente
de cualquier decisión de implementación. Sus artefactos (diagrama de clases, diagramas de
estados y glosario) recogen el vocabulario compartido entre cliente y desarrollador a lo largo
de todo el proyecto.

### 3.2.1. Diagrama de clases del dominio

El diagrama organiza las entidades en cuatro áreas conceptuales: organización, espacios, recursos
humanos y comunicación.

![Diagrama de clases del dominio](../../modelosUML/svg/dominioClases.svg)
<sub>[Código fuente](../../modelosUML/puml/dominioClases.puml)</sub>

El área de **organización** refleja la jerarquía de roles mediante herencia: `Empleado` es el rol
base; `Manager` lo extiende añadiendo la capacidad de tener una plaza asignada y de ceder; `RRHH`
extiende a `Manager` y añade la validación de ausencias en segundo nivel; `Administrador` tiene
acceso pleno a la configuración del sistema. Todos pertenecen a una `Entidad`, que representa cada
sede o empresa del grupo.

El área de **espacios** gira en torno a la entidad `Plaza`, que unifica conceptualmente las plazas de
aparcamiento y los puestos de oficina mediante el atributo `recurso` debido a su similitud. La `Reserva` vincula a un
empleado con una plaza en una fecha concreta, con soporte opcional de franja horaria para los
puestos de oficina. La `Cesión` representa la liberación voluntaria de una plaza asignada por su
propietario: cuando queda en estado disponible, cualquier empleado puede generar sobre ella una
`Reserva`, estableciendo así la relación `reserva de cesión` que las vincula. La `ReglaAutoCesión`
automatiza este proceso cuando el propietario está fuera de la oficina o en días concretos de la
semana. La `ReservaVisitante` cubre el caso de uso de parking para personas externas gestionadas
por un empleado.

El área de **RRHH** contiene la `SolicitudAusencia`, cuya complejidad reside en su ciclo de
aprobación en dos niveles. El área de **comunicación** incluye el `Anuncio` y el
`CalendarioFestivos`, este último compuesto por `Festivos` individuales y asociado a cada entidad
para el registro correcto de días laborables.

### 3.2.2. Diagramas de estados

Se documentan los ciclos de vida de las tres entidades con comportamiento dinámico no trivial.

**Reserva**. El ciclo es muy simple: una reserva se crea siempre en estado confirmada
y solo puede transitar a cancelada. La restricción de unicidad (una plaza, un día, una reserva
confirmada) se garantiza a nivel de base de datos mediante índices parciales.

![Estados de Reserva](../../modelosUML/svg/estadosReserva.svg)
<sub>[Código fuente](../../modelosUML/puml/estadosReserva.puml)</sub>

**Cesión**. Nace en estado disponible cuando el propietario la cede. Transita a reservada en
cuanto un empleado genera una reserva sobre ella, o a cancelada si el propietario la retira antes
de que sea reservada. Una cesión reservada también puede cancelarse, lo que libera la reserva
asociada.

![Estados de Cesión](../../modelosUML/svg/estadosCesion.svg)
<sub>[Código fuente](../../modelosUML/puml/estadosCesion.puml)</sub>

**SolicitudAusencia**. Es el ciclo más complejo del sistema. Una solicitud nace como pendiente y
requiere aprobación secuencial: primero el manager directo del empleado y después el equipo de
RRHH. En cualquier punto anterior a la aprobación final el empleado puede cancelarla; el manager
o RRHH pueden rechazarla en su respectivo nivel.

![Estados de SolicitudAusencia](../../modelosUML/svg/estadosSolicitudAusencia.svg)
<sub>[Código fuente](../../modelosUML/puml/estadosSolicitudAusencia.puml)</sub>

### 3.2.3. Glosario

| Término                | Definición                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entidad**            | Cada una de las sedes o empresas que conforman GRUPOSIETE. Cada entidad puede activar o desactivar módulos de forma independiente.                             |
| **Empleado**           | Usuario autenticado del sistema. Su rol determina las acciones que puede realizar.                                                                             |
| **Plaza**              | Espacio físico reservable: plaza de aparcamiento o puesto de trabajo en oficina.                                                                               |
| **Plaza asignada**     | Plaza vinculada de forma permanente a un Manager concreto. Solo este puede cederla.                                                                            |
| **Reserva**            | Registro que vincula a un empleado con una plaza en una fecha y, opcionalmente, una franja horaria.                                                            |
| **Cesión**             | Liberación voluntaria de una plaza asignada por su propietario para que otros empleados la reserven en una fecha concreta.                                     |
| **ReglaAutoCesión**    | Configuración que automatiza la cesión cuando el propietario está fuera de la oficina (detectado vía Microsoft 365) o en días fijos de la semana.              |
| **Hot desking**        | Modelo de trabajo en el que los puestos de oficina no están asignados de forma permanente sino que se reservan dinámicamente según disponibilidad.             |
| **SolicitudAusencia**  | Petición formal de ausencia laboral que sigue un flujo de aprobación en dos niveles: manager y RRHH.                                                           |
| **Visitante**          | Persona externa a GRUPOSIETE para la que un empleado gestiona una reserva de parking. No tiene acceso al portal y recibe únicamente un correo de confirmación. |
| **Anuncio**            | Comunicación interna publicada por RRHH o Administrador, con ámbito de entidad o global, y con fecha de expiración opcional.                                   |
| **CalendarioFestivos** | Conjunto de días festivos asociado a una entidad para excluirlos del cómputo de días laborables y de la disponibilidad de reservas.                            |
| **Módulo**             | Funcionalidad activable o desactivable de forma independiente por entidad desde el panel de administración.                                                    |

### 3.2.4. Requisitos suplementarios

Los requisitos suplementarios especifican propiedades del sistema que trascienden la funcionalidad
individual de cada caso de uso.

| ID     | Categoría            | Descripción                                                                                                                                               |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | Rendimiento          | Las operaciones de reserva y cancelación responderán en menos de 2 segundos bajo carga normal de uso.                                                     |
| RNF-02 | Disponibilidad       | El sistema estará disponible el 99,5 % del tiempo en horario laboral (L–V, 07:00–21:00).                                                                  |
| RNF-03 | Seguridad            | La autenticación se delega en Microsoft Entra ID mediante OAuth 2.0/OIDC. No se almacenan contraseñas para cuentas M365.                                  |
| RNF-04 | Seguridad            | La autorización se gestiona en la capa de aplicación mediante guardas de rol. Ningún dato de una entidad es visible para usuarios de otra entidad.        |
| RNF-05 | Usabilidad           | La interfaz será responsiva y utilizable desde dispositivos móviles sin necesidad de aplicación nativa.                                                   |
| RNF-06 | Mantenibilidad       | La arquitectura modular permitirá añadir o desactivar módulos sin modificar el código base existente.                                                     |
| RNF-07 | Portabilidad         | El sistema se desplegará sobre infraestructura estándar (PostgreSQL, Node.js) sin dependencia de un proveedor cloud concreto.                             |
| RNF-08 | Notificaciones       | El sistema enviará notificaciones de confirmación y recordatorio a través de Microsoft Teams o correo electrónico según las preferencias de cada usuario. |
| RNF-09 | Internacionalización | La interfaz estará disponible en español. La arquitectura soportará la incorporación de otros idiomas sin cambios estructurales.                          |

## 3.3. Disciplina de requisitos

### 3.3.1. Diagrama de contexto

El diagrama de contexto representa el sistema como una máquina de estados cuyos estados
principales corresponden a los módulos del portal. Las transiciones de entrada (`autenticarse()`) y
salida (`cerrarSesion()`) delimitan la frontera del sistema. Las acciones
ejecutables dentro de cada módulo se enumeran como comportamientos internos de su estado
correspondiente, de forma que el diagrama sirve de índice navegable de toda la funcionalidad del
sistema.

![Diagrama de contexto](../../modelosUML/svg/contexto.svg)
<sub>[Código fuente](../../modelosUML/puml/contexto.puml)</sub>

### 3.3.2. Actores del sistema

| Actor               | Tipo              | Descripción                                                                                                                   |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Empleado**        | Primario          | Usuario base del sistema. Realiza reservas, solicita ausencias y consulta información.                                        |
| **Manager**         | Primario          | Extiende a Empleado. Dispone de plaza asignada, puede cederla y aprueba solicitudes de ausencia de su equipo en primer nivel. |
| **RRHH**            | Primario          | Extiende a Manager. Valida solicitudes de ausencia en segundo nivel y publica anuncios.                                       |
| **Administrador**   | Primario          | Extiende a RRHH. Gestiona entidades, plazas, usuarios y la configuración global del sistema.                                  |
| **Visitante**       | Secundario pasivo | Persona externa sin acceso al portal. Recibe un correo de confirmación cuando un empleado registra una visita en su nombre.   |
| **Entra ID**        | Sistema externo   | Proveedor de identidad Microsoft utilizado para la autenticación SSO mediante OAuth 2.0/OIDC.                                 |
| **Microsoft Graph** | Sistema externo   | API de Microsoft 365 consultada para la detección del estado fuera de oficina y el envío de notificaciones vía Teams.         |

### 3.3.3. Casos de uso

El siguiente diagrama presenta la totalidad de los casos de uso del sistema, agrupados por módulo
y vinculados a los actores que los inician. La generalización entre actores refleja la herencia de
capacidades: un Manager puede realizar todo lo que hace un Empleado, y así sucesivamente.

![Diagrama de casos de uso](../../modelosUML/svg/casosUso.svg)
<sub>[Código fuente](../../modelosUML/puml/casosUso.puml)</sub>

La siguiente tabla recoge la priorización de los casos de uso conforme al método MoSCoW,
estableciendo el alcance del MVP documentado en este trabajo.

| Prioridad  | Caso de uso                     | Módulo         |
| ---------- | ------------------------------- | -------------- |
| **Must**   | `autenticarse()`                | Acceso         |
| **Must**   | `reservarPlaza()`               | Parking        |
| **Must**   | `cancelarReservaParking()`      | Parking        |
| **Must**   | `cederPlaza()`                  | Parking        |
| **Must**   | `cancelarCesion()`              | Parking        |
| **Must**   | `registrarVisitante()`          | Parking        |
| **Must**   | `reservarPuesto()`              | Oficinas       |
| **Must**   | `cancelarReservaPuesto()`       | Oficinas       |
| **Must**   | `solicitarAusencia()`           | Vacaciones     |
| **Must**   | `cancelarSolicitudAusencia()`   | Vacaciones     |
| **Must**   | `aprobarSolicitudAusencia()`    | Vacaciones     |
| **Must**   | `rechazarSolicitudAusencia()`   | Vacaciones     |
| **Must**   | `validarSolicitudAusencia()`    | Vacaciones     |
| **Must**   | `rechazarValidacionAusencia()`  | Vacaciones     |
| **Must**   | `editarPerfil()`                | Ajustes        |
| **Must**   | `gestionarPlazas()`             | Administración |
| **Must**   | `gestionarUsuarios()`           | Administración |
| **Must**   | `configurarSistema()`           | Administración |
| **Should** | `cancelarVisitante()`           | Parking        |
| **Should** | `configurarPreferencias()`      | Ajustes        |
| **Should** | `conectarMicrosoft365()`        | Ajustes        |
| **Should** | `consultarTablon()`             | Tablón         |
| **Should** | `publicarAnuncio()`             | Tablón         |
| **Should** | `consultarDirectorio()`         | Directorio     |
| **Should** | `gestionarEntidades()`          | Administración |
| **Should** | `configurarModulos()`           | Administración |
| **Could**  | `consultarAnalytics()`          | Administración |
| **Won't**  | Gestión de nóminas y documentos | —              |

### 3.3.4. Detalle de casos de uso representativos

Se detallan a continuación cuatro casos de uso que cubren los flujos más representativos del
sistema: el flujo estándar de reserva, la lógica específica de cesión, el flujo de aprobación
multinivel y la gestión de visitantes con notificación externa.

**`reservarPlaza()`** — El empleado accede al calendario de parking, selecciona una fecha
disponible y elige entre las plazas libres para esa fecha, incluyendo las cesiones vigentes. El
sistema valida la unicidad (un empleado, una plaza, un día) y confirma la reserva. El flujo
alternativo en azul recoge la cancelación en cualquier punto del proceso.

![Detalle reservarPlaza()](../../modelosUML/svg/cuReservarPlaza.svg)
<sub>[Código fuente](../../modelosUML/puml/cuReservarPlaza.puml)</sub>

**`cederPlaza()`** — El manager accede a su plaza asignada, selecciona la fecha en la que no la
utilizará y confirma la cesión. El sistema registra la cesión en estado disponible y notifica a los
empleados que tenían una alerta activa para esa fecha. Es el caso de uso que habilita el modelo de
reutilización de plazas asignadas.

![Detalle cederPlaza()](../../modelosUML/svg/cuCederPlaza.svg)
<sub>[Código fuente](../../modelosUML/puml/cuCederPlaza.puml)</sub>

**`aprobarSolicitudAusencia()`** — El manager accede a la bandeja de solicitudes pendientes de
su equipo, revisa el detalle de la solicitud seleccionada y toma una decisión con nota opcional. Si
aprueba, el sistema actualiza el estado a `aprobada_manager` y notifica al equipo de RRHH para la
validación en segundo nivel.

![Detalle aprobarSolicitudAusencia()](../../modelosUML/svg/cuAprobarSolicitudAusencia.svg)
<sub>[Código fuente](../../modelosUML/puml/cuAprobarSolicitudAusencia.puml)</sub>

**`registrarVisitante()`** — El empleado introduce los datos del visitante (nombre, empresa,
email) y la fecha de la visita, y selecciona una plaza de visitante disponible. El sistema crea la
reserva y envía automáticamente un correo de confirmación al visitante. Este es el único caso de
uso en el que el sistema interactúa con un actor externo pasivo sin acceso al portal.

![Detalle registrarVisitante()](../../modelosUML/svg/cuRegistrarVisitante.svg)
<sub>[Código fuente](../../modelosUML/puml/cuRegistrarVisitante.puml)</sub>

### 3.3.5. Prototipos de interfaz

Los prototipos de baja fidelidad validan la correspondencia entre los casos de uso detallados y la
interfaz del sistema. Se presentan como wireframes funcionales centrados en la estructura de la
pantalla y el flujo de interacción, no en el diseño visual final.

**Reservar plaza** — Vista de dos paneles: calendario mensual con indicación de disponibilidad
por día en la columna izquierda y lista de plazas disponibles para la fecha seleccionada en la
derecha, con acción de confirmación.

![Prototipo reservarPlaza()](../../modelosUML/svg/protoReservarPlaza.svg)
<sub>[Código fuente](../../modelosUML/puml/protoReservarPlaza.puml)</sub>

**Ceder plaza** — Vista centrada en la plaza asignada del manager, con selector de fecha y acción
de cesión directa.

![Prototipo cederPlaza()](../../modelosUML/svg/protoCederPlaza.svg)
<sub>[Código fuente](../../modelosUML/puml/protoCederPlaza.puml)</sub>

**Aprobar solicitud de ausencia** — Vista de dos zonas: tabla de solicitudes pendientes del
equipo en la parte superior y panel de detalle con acción de aprobación o rechazo con nota en la
parte inferior.

![Prototipo aprobarSolicitudAusencia()](../../modelosUML/svg/protoAprobarSolicitudAusencia.svg)
<sub>[Código fuente](../../modelosUML/puml/protoAprobarSolicitudAusencia.puml)</sub>

**Registrar visitante** — Formulario estructurado en dos bloques: datos del visitante y detalles
de la visita (fecha y selección de plaza), con acción de registro y envío automático de confirmación.

![Prototipo registrarVisitante()](../../modelosUML/svg/protoRegistrarVisitante.svg)
<sub>[Código fuente](../../modelosUML/puml/protoRegistrarVisitante.puml)</sub>

---

[← Cap. 2](MARCO_TEORICO.md) · [Índice](../../README.md) · [Siguiente →](ANALISIS_DISENO.md)
