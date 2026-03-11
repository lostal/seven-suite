# Panel del Empleado GRUPOSIETE — ERP Modular

## Qué es

ERP modular "Panel del Empleado" para GRUPOSIETE (sector materiales de construcción, 7 empresas fusionadas, sedes en España). Sustituto moderno de A3/portalempleado.net, con módulos independientes:

- **Nóminas** — subida masiva desde A3 + asignación automática por DNI
- **Vacaciones** — solicitud, aprobación, calendario integrado
- **Directorio empleados** — fichas completas, búsqueda, organigrama
- **Reservas espacios** — parking, oficinas, salas reuniones
- **Tablón anuncios** — noticias por sede
- **Documentos corporativos** — políticas, procedimientos descargables
- **Calendario laboral** — festivos por comunidad + vacaciones

Todos comparten núcleo (auth, notificaciones, admin) y se habilitan/deshabilitan por sede desde panel admin.

## El problema

GRUPOSIETE nace de fusión de 7 empresas con procesos y herramientas distintas. El portal actual (A3 portalempleado.net) está desactualizado:

- **Único módulo usado**: nóminas (automatizadas)
- **Resto desactualizado**: vacaciones, directorio, tablón, documentos
- **Información dispersa**: cada sede tiene Excel propio, correos, WhatsApp
- **Sin unificación post-fusión**: empleados no se conocen entre sedes

## La solución

Panel del empleado integrado en Microsoft 365 que:

- Automatiza nóminas (parsing DNI desde PDF A3)
- Unifica procesos entre sedes
- Reemplaza Excel/WhatsApp con base de datos central
- Escala por sede (Madrid, Santander, etc.)

---

## Roles

| Rol            | Descripción                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| **Empleado**   | Ve nóminas, solicita vacaciones, reserva espacios, busca compañeros, lee anuncios |
| **Jefe**       | Todo lo anterior + aprueba vacaciones de su equipo                                |
| **RRHH/Admin** | Gestión completa: nóminas, usuarios, módulos, estadísticas                        |

---

## Alcance funcional

### MVP (implementado)

**Nóminas**

- RRHH sube ZIP con nóminas A3 (`Hoja de Salario.pdf`)
- Parsing automático DNI/nombre/mes desde PDF
- Asignación a empleado correcto
- Historial descargable por mes/año

**Vacaciones**

- Solicitud días por empleado (fechas, motivo)
- Aprobación/rechazo por jefe
- Calendario visual del equipo
- Festivos por comunidad autónoma

**Directorio empleados**

- Ficha: nombre, foto, cargo, sede, teléfono, email
- Búsqueda por nombre/sede/departamento
- Organigrama básico por niveles

**Reservas espacios**

- Parking: cesión directivos + reservas + visitantes
- Puestos oficina: franjas horarias
- Salas reuniones: capacidad + equipamiento

**Tablón anuncios**

- Admin publica noticias (global/sede)
- Empleado lee y marca como leído

**Documentos**

- RRHH sube PDFs (políticas, contratos)
- Empleado busca y descarga

**Calendario laboral**

- Festivos nacionales + por CCAA
- Integrado con vacaciones (días disponibles)

### Integración Microsoft 365

- **Auth**: Microsoft Entra ID (perfil auto)
- **Outlook**: sincroniza vacaciones como eventos
- **Teams**: bot para nóminas/reservas
- **Emails**: confirmaciones automáticas

### Futuras líneas

- Fichaje entrada/salida
- Notas de gasto
- Inventario activos por sede
- Onboarding digital

---

## Stack técnico

| Capa      | Tecnología              | Justificación                   |
| --------- | ----------------------- | ------------------------------- |
| Framework | Next.js 15 + TypeScript | Server Actions, SSR, PWA nativa |
| UI        | Tailwind + shadcn/ui    | Mobile-first, accesible         |
| DB        | Supabase PostgreSQL     | RLS para RBAC, Realtime mapas   |
| Auth      | Supabase + Entra ID     | Sin contraseñas nuevas          |
| Nóminas   | pdf-parse + regex DNI   | Parsing A3 automático           |
| Emails    | Resend + React Email    | Transaccionales                 |
| Gráficas  | Recharts                | Dashboard ocupación             |
| Testing   | Vitest + Playwright     | Unit + E2E                      |
| Deploy    | Vercel                  | CI/CD automático                |

---

## Prioridades implementación

**P0**: Auth + Directorio + Nóminas + Vacaciones
**P1**: Reservas espacios + Tablón + Documentos
**P2**: Calendario laboral + Outlook sync
**P3**: Teams bot + Dashboard

---

## Decisiones clave

**¿Por qué a medida vs A3?** A3 solo hace nóminas bien. El resto está desactualizado. Nuestro parsing de nóminas + módulos modernos unifica todo en una sola plataforma, coste cero.

**¿Por qué Supabase?** PostgreSQL para nóminas complejas (DNI, fechas, estados), RLS por sede/rol, Realtime para reservas.

**¿Por qué Next.js Server Actions?** Mutaciones seguras (subir ZIP, parsear PDF) en servidor, sin API externa.

---

## Metodología

RUP adaptado individual, 4 fases = capítulos TFG:

1. **Requisitos**: sesiones GRUPOSIETE, dominio, casos uso
2. **Análisis/Diseño**: clases, arquitectura, DER
3. **Implementación**: MVP incremental, tests
4. **Evaluación**: métricas, conclusiones

**Soporte**: GitHub, Notion Kanban, Draw.io UML.
