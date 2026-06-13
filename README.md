<div align="center">

# Seven Suite - Portal del empleado

_Trabajo de Fin de Grado · Ingeniería Informática · UNEATLANTICO · 2025–2026_

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

ERP modular de reservas corporativas y gestión interna para GRUPOSIETE: parking, oficinas, vacaciones, directorio y tablón.

</div>

---

## Marco teórico

### Contexto GRUPOSIETE

- GRUPOSIETE nace en 2022 de la fusión de ocho empresas de distribución de materiales de construcción, con sedes en seis comunidades autónomas y oficina central en Alcobendas (Madrid, 240 m²). El reto principal: unificar procesos que cada empresa gestionaba de forma distinta.
- El intento previo de unificación fue a3innuva (Wolters Kluwer) como panel del empleado. Solo se usa para nóminas; la baja usabilidad abandonó el resto de secciones.
- El proyecto arrancó como una app de reservas de parking para Alcobendas (Madrid). Durante el requisitado escaló: se añadió reserva de oficinas y finalmente multi-sede, vacaciones, directorio y tablón para dar cohesión a todas las sedes.
- El mercado ofrece herramientas de RRHH por un lado y de gestión de espacios por otro, pero ninguna las unifica integrándose además con servicios de Microsoft. Para ocho empresas en plena fusión, esa fragmentación es especialmente grave.

---

## Modelo del dominio

El diagrama organiza las entidades en cuatro áreas conceptuales: organización, espacios, recursos humanos y comunicación. La jerarquía de roles (`Empleado` → `RRHH` → `Manager` → `Administrador`) sigue una cadena de herencia; `Plaza` unifica aparcamiento y oficinas; `Reserva`, `Cesión` y `ReservaVisitante` modelan las operaciones sobre los espacios.

<div align="center">

![Modelo del dominio](modelosUML/svg/dominioClases.svg)

<sub>[Código fuente](modelosUML/puml/dominioClases.puml)</sub>

</div>

---

## Diagramas de estados

<div align="center">

| Cesión                                                                                                                   | Solicitud de Ausencia                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Estados de Cesión](modelosUML/svg/estadosCesion.svg)<br><sub>[Código fuente](modelosUML/puml/estadosCesion.puml)</sub> | ![Estados de SolicitudAusencia](modelosUML/svg/estadosSolicitudAusencia.svg)<br><sub>[Código fuente](modelosUML/puml/estadosSolicitudAusencia.puml)</sub> |

</div>

---

## Actores y Casos de Uso

| Actor             | Tipo     | Descripción                                                           |
| ----------------- | -------- | --------------------------------------------------------------------- |
| **Empleado**      | Primario | Reserva plazas, solicita ausencias y consulta información.            |
| **RRHH**          | Primario | Gestiona solicitudes de ausencia y publica anuncios.                  |
| **Manager**       | Primario | Administra su sede: plazas, usuarios, directorio y configuración.     |
| **Administrador** | Primario | Gestiona entidades, módulos y la configuración global del sistema.    |
| **Visitante**     | Pasivo   | Persona externa sin acceso al portal. Recibe confirmación por correo. |

El sistema colabora con dos servicios externos: **Microsoft Entra ID** como proveedor de identidad (OAuth 2.0/OIDC) y **Microsoft Graph API** para estado fuera de oficina y notificaciones por Teams.

<div align="center">

| Espacios                                                                                                             | Personas                                                                                                                             | Administración                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ![Casos de uso - espacios](modelosUML/svg/casosUso.svg)<br><sub>[Código fuente](modelosUML/puml/casosUso.puml)</sub> | ![Casos de uso - personas](modelosUML/svg/casosUsoPersonas.svg)<br><sub>[Código fuente](modelosUML/puml/casosUsoPersonas.puml)</sub> | ![Casos de uso - administración](modelosUML/svg/casosUsoAdmin.svg)<br><sub>[Código fuente](modelosUML/puml/casosUsoAdmin.puml)</sub> |

</div>

---

## Diagrama de contexto

El sistema se expresa como una máquina de estados: se pueden asociar vistas del portal a los estados del diagrama de contexto y cada transición a un caso de uso. `SESION_CERRADA` es el estado de entrada; `SISTEMA_DISPONIBLE` actúa como hub central. El retorno desde cualquier módulo se unifica mediante `completarGestion()`, materializada como la barra de navegación lateral.

<div align="center">

![Diagrama de contexto](modelosUML/svg/contexto.svg)

<sub>[Código fuente](modelosUML/puml/contexto.puml)</sub>

</div>

---

## Análisis

<div align="center">

![Panorama de clases de análisis](modelosUML/svg/analisisClases.svg)

<sub>[Código fuente](modelosUML/puml/analisisClases.puml)</sub>

</div>

---

## Detalle de casos de uso representativos

### reservarPlaza()

Flujo estándar de reserva: el empleado selecciona fecha, consulta disponibilidad y confirma. La Server Action `createReservation` verifica autenticación, valida con Zod y comprueba conflictos antes de persistir en PostgreSQL.

| Contexto                                        | Solución                                              |
| ----------------------------------------------- | ----------------------------------------------------- |
| ![Contexto](modelosUML/svg/contextoReserva.svg) | ![Calendario](docs/TFG/images/calendario-parking.png) |

#### Colaboración

<div align="center">

![Colaboración](modelosUML/svg/colabReservarPlaza.svg)

</div>

`CalendarioParkingView` se comunica exclusivamente con `ReservaController`, que coordina la carga de disponibilidad y la detección de conflictos delegando en `PlazaRepository` y `ReservaRepository`.

#### Secuencia

<div align="center">

![Secuencia](modelosUML/svg/seqReservarPlaza.svg)

</div>

La página resuelve la consulta de disponibilidad en servidor antes de renderizar. La Server Action ejecuta tres pasos: autenticación → validación Zod → persistencia con control de conflicto. La respuesta es un `ActionResult<Reserva>` que la página maneja sin recargar.

### cederPlaza()

Cesión intencional de plaza asignada: solo el propietario puede liberarla para que otros empleados la reserven. La arquitectura deja preparada la consulta del estado fuera de oficina vía Microsoft Graph para sugerir cesiones en futuras iteraciones.

| Contexto                                       | Solución                                    |
| ---------------------------------------------- | ------------------------------------------- |
| ![Contexto](modelosUML/svg/contextoCesion.svg) | ![Cesión](docs/TFG/images/panel-cesion.png) |

#### Colaboración

<div align="center">

![Colaboración](modelosUML/svg/colabCederPlaza.svg)

</div>

`CesionView` recibe la acción desde el calendario de parking. El controlador recupera la plaza asignada mediante `PlazaRepository` y registra la cesión en `CesionRepository`. Microsoft Graph colabora en segundo plano, pero la decisión final siempre es del empleado.

### gestionarSolicitudAusencia()

Flujo de aprobación en un único paso: RRHH, manager de sede o administrador aprueban o rechazan solicitudes de ausencia. La interfaz presenta dos zonas (lista de pendientes y panel de detalle con acción).

| Contexto                                          | Solución                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| ![Contexto](modelosUML/svg/contextoSolicitud.svg) | ![Bandeja](docs/TFG/images/bandeja-solicitudes.png) |

#### Colaboración

<div align="center">

![Colaboración](modelosUML/svg/colabGestionarSolicitud.svg)

</div>

`BandejaSolicitudesView` presenta las solicitudes pendientes del equipo. `AusenciaController` coordina la carga consultando `SolicitudRepository` y `EmpleadoRepository`, y al resolver dispara una notificación mediante `NotificacionService`.

#### Secuencia

<div align="center">

![Secuencia](modelosUML/svg/seqGestionarSolicitud.svg)

</div>

La Server Action `approveLeaveRequest` valida el rol del actor, verifica que la solicitud esté pendiente y transita el estado en un único paso, enviando la notificación correspondiente al empleado.

---

## Arquitectura

<div align="center">

![C4](modelosUML/svg/arquitectura.svg)

<sub>[Código fuente](modelosUML/puml/arquitectura.puml)</sub>

</div>

El portal concentra las tres responsabilidades del servidor en un único contenedor Next.js: renderizado, Server Actions y callbacks de autenticación. PostgreSQL se comunica directamente con el portal mediante Drizzle ORM, eliminando la sobrecarga de serialización REST.

<div align="center">

![Paquetes](modelosUML/svg/paquetes.svg)

<sub>[Código fuente](modelosUML/puml/paquetes.puml)</sub>

</div>

Los módulos del dashboard dependen débilmente de `lib/`: importan lo necesario pero `lib/` no conoce a sus consumidores. Las acciones dependen de consultas y autenticación; las consultas, del cliente de base de datos. La dependencia unidireccional garantiza que los módulos puedan activarse o desactivarse sin modificar el código de los demás.

<div align="center">

![Despliegue](modelosUML/svg/despliegue.svg)

<sub>[Código fuente](modelosUML/puml/despliegue.puml)</sub>

</div>

Next.js y PostgreSQL 16 se ejecutan en servidor propio mediante Docker Compose. La separación entre servidor de aplicaciones y base de datos responde al requisito de disponibilidad (RNF-02). La ausencia de proveedores cloud para la persistencia materializa el requisito de portabilidad (RNF-07).

#### Trazabilidad clases de análisis → código

Cada clase de análisis tiene su contraparte directa en el repositorio, verificable sin ambigüedad:

| Clase de análisis        | Clase de diseño                       | Archivo                                             | CdU asociado                                        |
| ------------------------ | ------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `CalendarioParkingView`  | `ParkingPage` (Server Component)      | `src/app/(dashboard)/parking/page.tsx`              | `reservarPlaza`                                     |
| `ReservaController`      | `createReservation` (Server Action)   | `src/app/(dashboard)/parking/actions.ts`            | `reservarPlaza`                                     |
| `PlazaRepository`        | `getAvailableSpotsForDate`            | `src/app/(dashboard)/parking/actions.ts`            | `reservarPlaza`, `cederPlaza`, `registrarVisitante` |
| `ReservaRepository`      | `getReservationsByDate` (Query)       | `src/lib/queries/reservations.ts`                   | `reservarPlaza`                                     |
| `CesionView`             | `ParkingPage` (panel de cesión)       | `src/app/(dashboard)/parking/page.tsx`              | `cederPlaza`                                        |
| `CesionController`       | `createCession` (Server Action)       | `src/app/(dashboard)/parking/cession-actions.ts`    | `cederPlaza`                                        |
| `BandejaSolicitudesView` | `VacacionesPage` (Server Component)   | `src/app/(dashboard)/vacaciones/page.tsx`           | `gestionarSolicitudAusencia`                        |
| `AusenciaController`     | `approveLeaveRequest` (Server Action) | `src/app/(dashboard)/vacaciones/actions.ts`         | `gestionarSolicitudAusencia`                        |
| `VisitanteView`          | `VisitantesPage` (Server Component)   | `src/app/(dashboard)/parking/visitantes/page.tsx`   | `registrarVisitante`                                |
| `VisitanteController`    | `createVisitorReservation` (SA)       | `src/app/(dashboard)/parking/visitantes/actions.ts` | `registrarVisitante`                                |
| `AuthController`         | `config.ts` + `helpers.ts`            | `src/lib/auth/`                                     | `cerrarSesion`                                      |
| `NotificacionService`    | `sendVisitorReservationEmail`         | `src/lib/email/`                                    | `registrarVisitante`                                |

---

## Tecnologías

| Categoría        | Tecnología                      | Para qué                                                |
| ---------------- | ------------------------------- | ------------------------------------------------------- |
| Framework        | Next.js 16 (App Router)         | Full-stack: renderizado, Server Actions y API           |
| Lenguaje         | TypeScript                      | Tipado estático en todo el proyecto                     |
| Base de datos    | PostgreSQL 16                   | Autoalojada en servidor propio con Docker Compose       |
| ORM              | Drizzle ORM                     | Acceso a datos con tipos inferidos del esquema SQL      |
| Autenticación    | Auth.js v5 + Microsoft Entra ID | Login con cuenta Microsoft, sin almacenar contraseñas   |
| UI               | Tailwind CSS v4 + shadcn/ui     | Componentes accesibles y responsivos                    |
| Testing unitario | Vitest (45 archivos, 831 tests) | Cobertura de Server Actions, queries y validaciones Zod |
| Testing E2E      | Playwright                      | Flujos completos desde la perspectiva del usuario       |
| CI/CD            | GitHub Actions                  | Tests automáticos en cada push, despliegue al pasar     |
| Contenedores     | Docker + Docker Compose         | App y base de datos en servidor propio                  |
| Email            | Resend + React Email            | Correos transaccionales de confirmación                 |

---

## Validación

| Métrica          | Puntuación |
| ---------------- | ---------- |
| Rendimiento      | 100        |
| Accesibilidad    | 96         |
| Buenas prácticas | 100        |
| SEO              | 100        |

Cobertura global de tests: **85,3 %** sentencias · **74,3 %** ramas · **88,8 %** funciones · **85,6 %** líneas.

<div align="center">

![CI/CD](docs/TFG/images/ci-pipeline.png)

</div>

Pipeline mediante GitHub Actions: `pnpm check` (typecheck, lint, format, tests) en cada push. El despliegue se activa automáticamente al superar todas las comprobaciones.

---

## Solución

[https://github.com/lostal/seven-suite](https://github.com/lostal/seven-suite)

---

## Conclusiones

- El portal resuelve la fragmentación entre sedes integrando parking, oficinas, vacaciones, directorio y tablón en una única plataforma con SSO Microsoft 365.
- La arquitectura modular (monolito modular con patrón plugin) permite activar o desactivar módulos por entidad sin modificar el código base, validando la decisión de diseño estructural del proyecto.
- La integración con Microsoft Entra ID elimina la fricción de acceso; la arquitectura está preparada para integrarse con Graph API (notificaciones por Teams, sincronización con calendarios de Outlook).
- La migración temprana de Supabase a PostgreSQL autoalojado mantuvo la compatibilidad del modelo de datos y dio al cliente el control total sobre su información, con coste operativo asumible.
- 85,3 % de cobertura de tests, 100/100 Lighthouse en rendimiento y CI/CD automatizado mediante GitHub Actions.
- La trazabilidad completa -escenario → requisitos → análisis y diseño → implementación → evaluación- verifica un proceso de ingeniería riguroso y auditable.

---

## 📂 Documentación del TFG

|               | _(este README)_ | Capítulo I                                 | Capítulo II                          | Capítulo III                                     | Capítulo IV                                  | Capítulo V                               |
| ------------- | --------------- | ------------------------------------------ | ------------------------------------ | ------------------------------------------------ | -------------------------------------------- | ---------------------------------------- |
| **Fecha**     | -               | 16/03                                      | 06/04                                | 27/04                                            | 26/05                                        | 26/05                                    |
| **Documento** | Presentación    | [Marco teórico](docs/TFG/MARCO_TEORICO.md) | [Requisitos](docs/TFG/REQUISITOS.md) | [Análisis y diseño](docs/TFG/ANALISIS_DISENO.md) | [Implementación](docs/TFG/IMPLEMENTACION.md) | [Conclusiones](docs/TFG/CONCLUSIONES.md) |

| [Cap. 1 →](docs/TFG/MARCO_TEORICO.md) |
| :-----------------------------------: |

---

<div align="center">

**Álvaro Lostal Sanz** · [lostal.dev](https://lostal.dev) · [GitHub](https://github.com/lostal) · [LinkedIn](https://linkedin.com/in/alvarolostal)

</div>
