<div align="center">

# GRUPOSIETE Reservas

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**ERP modular de reservas corporativas: plazas de parking y escritorios de oficina, con tres roles, integración Microsoft 365 y configuración por recurso**

</div>

---

## 🎯 El Problema

[GRUPOSIETE](https://gruposiete.es) necesitaba gestionar dos tipos de recursos con lógica similar pero reglas distintas: las plazas de aparcamiento de directivos (que quedan vacías cuando viajan) y los escritorios en zonas de hoteling (que deben reservarse por franjas horarias). Todo se gestionaba "de palabra, o no se gestionaba".

> 💡 En empresas con +50 empleados y recursos limitados, la tasa de infrautilización del parking corporativo puede superar el 30% — y los escritorios de hoteling sin sistema son fuente constante de conflictos.

## ✨ La Solución

| ❌ Sin el sistema                            | ✅ Con GRUPOSIETE Reservas                             |
| -------------------------------------------- | ------------------------------------------------------ |
| Plazas vacías cuando el directivo viaja      | Cesión temporal al pool de plazas disponibles          |
| Sin visibilidad de disponibilidad            | Mapa SVG interactivo con estado en tiempo real         |
| Escritorios de hoteling sin control          | Reservas por franja horaria con configuración global   |
| Gestión de visitantes por email o de palabra | Reserva con notificación automática al visitante       |
| Sin control de quién aparca dónde            | Panel admin con gestión de plazas, usuarios y roles    |
| Cada herramienta va por separado             | Integrado en el ecosistema Microsoft 365 de la empresa |

**Resultado:** Un sistema modular con tres roles (Empleado, Dirección, Administrador) que cubre parking y oficinas desde una sola aplicación, con configuración independiente por recurso.

---

## 🏗️ Tecnologías Utilizadas

<div align="center">

### Frontend & UI

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn/ui-000000?style=flat-square&logo=shadcnui&logoColor=white)
![Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white)

### Backend & Data

![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![Auth.js](https://img.shields.io/badge/Auth.js_v5-000000?style=flat-square&logo=authjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-000000?style=flat-square&logo=resend&logoColor=white)

### Testing & DevOps

![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

**Decisiones Clave:**

| Elegí esto...         | En lugar de esto...  | ¿Por qué?                                                                |
| --------------------- | -------------------- | ------------------------------------------------------------------------ |
| Drizzle ORM + Auth.js | Firebase / Supabase  | PostgreSQL self-hosted, tipado end-to-end sin codegen, Auth.js v5 JWT    |
| Server Actions        | API REST separada    | Mutaciones tipadas como funciones de servidor, sin capa API intermedia   |
| Desarrollo a medida   | SaaS (Parkalot, etc) | Integración profunda con M365 + lógica de cesión específica + coste cero |
| SVG interactivo       | Canvas / WebGL       | Cada plaza es un elemento DOM accesible, clicable y estilizable con CSS  |

---

## ⚡ Features Principales

<table>
<tr>
<td width="50%">

### 🔐 Autenticación y Roles

- ✅ Login con credenciales (bcrypt) + Microsoft Entra ID (próximo)
- ✅ Tres roles: Empleado, Manager/HR, Admin
- ✅ Autorización en capa de servicio (Auth.js + helpers)
- ✅ Perfil automático vía evento `createUser` de Auth.js

</td>
<td width="50%">

### 🗺️ Parking — Mapa Interactivo

- ✅ SVG del plano real del parking
- ✅ Color por estado (libre, reservada, cedida...)
- ✅ Clic en plaza → flujo de reserva
- ✅ Estado recalculado en servidor (Next.js revalidation)

</td>
</tr>
<tr>
<td>

### 🏢 Oficinas — Escritorios por Franja

- ✅ Reservas por franja horaria configurable
- ✅ Días permitidos y horarios definidos por admin
- ✅ Misma lógica de cesión que parking
- ✅ Activable/desactivable independientemente

</td>
<td>

### 📅 Cesiones y Reservas

- ✅ Directivos ceden recurso los días que no lo usan
- ✅ Empleados reservan recursos cedidos (1/día)
- ✅ Cancelación con lógica de estados
- ✅ Alertas "Avísame si hay plaza el día X"

</td>
</tr>
<tr>
<td>

### 👥 Visitantes y Notificaciones

- ✅ Reserva para visitante externo (nombre, empresa, email)
- ✅ Correo automático con confirmación, nº plaza y dirección
- ✅ Templates profesionales con React Email + Resend
- ✅ Sistema de alertas por disponibilidad

</td>
<td>

### ⚙️ Panel de Administración

- ✅ CRUD de plazas y asignaciones (parking + oficinas)
- ✅ Gestión de usuarios y roles
- ✅ Configuración global por recurso (`system_config`)
- ✅ Dashboard de estadísticas con Recharts

</td>
</tr>
</table>

---

## 🧩 Retos Técnicos Superados

### 🔥 Challenge #1: Seguridad RBAC a Nivel de Servicio

**El problema:**
Implementar control de acceso granular para tres roles con reglas complejas (ej: un directivo solo puede ceder SI tiene plaza asignada), sin depender de validaciones en el frontend que son bypasseables.

**La solución:**

- Capa de autorización en `src/lib/auth/authorize.ts` con helpers componibles (`assertAdmin()`, `assertOwner()`, `assertHasAssignedSpot()`)
- Cada Server Action verifica permisos antes de ejecutar la mutación
- `requireAuth()`, `requireAdmin()`, `requireManagerOrAbove()` en helpers de servidor como building blocks
- Auth.js JWT embebe `role` y `entityId` — sin roundtrips adicionales a la BD por autenticación

**Tech stack:** Auth.js v5 • Next.js Server Actions • TypeScript

---

### ⚡ Challenge #2: Consistencia de Estado entre Cesiones y Reservas

**El problema:**
Una cesión puede pasar de "available" a "reserved" cuando alguien reserva la plaza cedida. Si estas actualizaciones no son atómicas, es posible tener una cesión en estado "available" mientras la plaza ya está reservada (estado inconsistente).

**La solución:**

- Trigger `trg_sync_cession_status` que se ejecuta automáticamente tras INSERT/UPDATE en reservations
- Sincronización dentro de la misma transacción (imposible estado inconsistente)
- El código de aplicación no necesita coordinar ambas tablas manualmente

**Tech stack:** PostgreSQL Triggers • Transacciones ACID • Drizzle ORM

---

### 🎯 Challenge #3: Server Actions Tipadas con Validación Automática

**El problema:**
Las Server Actions de Next.js no ofrecen validación de entrada ni gestión de errores estandarizada out-of-the-box. Cada acción reinventaba el manejo de errores y la validación.

**La solución:**

- Builder pattern propio (`actionClient`) que encadena schema Zod + handler
- Tipo de retorno `ActionResult<T>` discriminado: nunca lanza excepciones, siempre devuelve `{ success, data }` o `{ success, error, fieldErrors }`
- Los errores de validación se devuelven como `fieldErrors` mapeados al formulario (React Hook Form)
- Una sola línea para crear una acción validada y tipada end-to-end

**Tech stack:** Next.js Server Actions • Zod v4 • TypeScript Generics

---

### 🧩 Challenge #4: Dos Módulos, Un Modelo de Datos

**El problema:**
Parking y oficinas comparten el mismo modelo de datos (`spots`, `reservations`, `cessions`) pero tienen reglas distintas: el parking tiene mapa SVG, las oficinas tienen franjas horarias; el parking permite visitantes externos, las oficinas no. Añadir oficinas no podía romper parking.

**La solución:**

- Campo `resource_type: "parking" | "office"` en todas las tablas clave
- Capa de configuración `system_config` con claves prefijadas (`parking.*`, `office.*`) cacheadas con `unstable_cache`
- Cada módulo activa sus propias features vía config — mismas queries, distintos parámetros
- Módulos activables/desactivables desde el panel admin sin tocar código

**Tech stack:** PostgreSQL • Drizzle ORM • Next.js unstable_cache

---

## ⚙️ Arquitectura del Sistema

```mermaid
flowchart TB
    subgraph Cliente["Next.js 16 — App Router"]
        A[🔐 Auth Module] --> B[📊 Dashboard]
        B --> C[🗺️ Parking]
        B --> C2[🏢 Oficinas]
        B --> D[👥 Visitantes]
        B --> E[⚙️ Admin Panel]
        B --> F[📈 Panel Stats]
        B --> G[🔧 Ajustes]
    end

    subgraph Servidor["Server Actions + Middleware"]
        C --> H[actionClient + Zod]
        C2 --> H
        D --> H
        E --> H
        H --> I[Drizzle ORM]
    end

    subgraph Data["PostgreSQL Self-Hosted"]
        I --> J[(PostgreSQL + Triggers)]
        J --> K[Auth.js + JWT Sessions]
        J --> L[DrizzleAdapter]
    end

    subgraph Servicios["Servicios Externos"]
        H --> N[📧 Resend - React Email]
        K --> O[Microsoft Graph API]
    end
```

**Módulos de la aplicación:**

| Ruta              | Propósito                                    |
| ----------------- | -------------------------------------------- |
| `parking/`        | Reservas, cesiones, mapa SVG, calendario     |
| `oficinas/`       | Escritorios por franja horaria, cesiones     |
| `administracion/` | CRUD de plazas, usuarios, config por recurso |
| `panel/`          | Dashboard de estadísticas (solo admin)       |
| `mis-reservas/`   | Reservas propias del usuario                 |
| `visitantes/`     | Reservas de visitantes externos              |
| `ajustes/`        | Preferencias, Microsoft 365, seguridad       |

---

## 🎓 Lo Que Aprendí

> Este proyecto me obligó a migrar de Supabase (BaaS) a un stack self-hosted completo: Drizzle ORM + Auth.js v5 + PostgreSQL. La migración reveló cuánta lógica "gratis" da un BaaS — y cuánto más control ganas al construirlo tú. Diseñar la capa de autorización desde cero me hizo entender que la seguridad real vive en el servicio, no solo en el middleware. Las Server Actions con un builder pattern eliminan una cantidad brutal de boilerplate — una sola función reemplaza controller + route + validación + error handling. Lo más gratificante fue ver cómo el trigger de sincronización cesión ↔ reserva hace imposible el estado inconsistente sin que el código de aplicación tenga que preocuparse por ello. Añadir el módulo de oficinas sobre la misma base de datos demostró que el diseño `resource_type` era la abstracción correcta desde el principio.

---

<div align="center">

## 👨‍💻 Desarrollado por Álvaro Lostal

**Ingeniero Informático • Web Developer**

[![Portfolio](https://img.shields.io/badge/Portfolio-lostal.dev-d5bd37?style=for-the-badge&logo=astro&logoColor=white)](https://lostal.dev)
[![GitHub](https://img.shields.io/badge/GitHub-lostal-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/lostal)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Álvaro%20Lostal-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/alvarolostal)

</div>

---

<div align="center">

### ⭐ Si este proyecto te resulta interesante, considera darle una estrella

</div>
