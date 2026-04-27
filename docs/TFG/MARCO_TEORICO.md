# 2. Marco teórico

Gestionar los RRHH y los espacios en las pequeñas y medianas empresas que están
empezando a adaptar un sistema de trabajo híbrido puede ser difícil, y más estando en medio de
una fusión multi-empresa. Este capítulo analiza la condición actual y particular de
GRUPOSIETE, el estado actual de los portales ESS, las herramientas para administrar espacios y
las habilidades técnicas que han de emplearse para elaborar la estructura planteada. El objetivo
es explicar la razón por la que se han tomado ciertas decisiones al planear el proyecto.

## 2.1. Contexto GRUPOSIETE

En 2022, ocho compañías de materiales para la construcción llegaron a un acuerdo para
fusionarse dando así lugar a GRUPOSIETE. Estas compañías tienen su sede principal en
Alcobendas, Madrid, y están ubicadas en distintas comunidades autónomas de España. Aunque
la fusión ofrece ventajas comerciales y operativas, también plantea retos al integrar procesos que
eran bastante distintos en cada compañía.

En España, las fusiones y adquisiciones son cada vez más frecuentes. En 2024, se
contabilizaron 3.473 operaciones de este tipo, que sumaron un total de 95.791 millones de euros.
Tras una fusión, la integración tecnológica es clave (a día de hoy, esencial) y puede representar
un riesgo significativo a la hora de buscar buenos resultados. Si la integración tecnológica no se
lleva a cabo de forma eficaz, es posible perder entre el 30% y el 50% del valor de una fusión
(Gartner, 2024).

La fusión enfrenta retos cotidianos en la sede de Alcobendas. No se puede expandir el
espacio de 240 m² sin incurrir en gastos considerables (es decir, alquilar nuevas oficinas).
Además, los directivos tienen espacios de estacionamiento asignados, pero frecuentemente están
vacíos porque no se encuentran en la oficina o están de viaje mientras que otros trabajadores
requieren estacionamiento. Hoy en día, la coordinación se realiza por medio de WhatsApp. Esta
solución no es la mejor porque carece de un registro formal y escapa al control de la
organización.

En la sesión inicial con el director de IT se propuso un sistema unificado para gestionar los espacios en la sede. Este sistema
debía ofrecer:

- Visibilidad de los espacios disponibles en cada sede
- Un directorio central de usuarios
- Notificaciones integradas en Microsoft Teams
- Capacidad para añadir módulos adicionales según sea necesario

Pero el planteamiento de una aplicación específica para espacios hace pensar que quizás
aumente el problema de la fragmentación al añadir más aplicaciones en vez de integrar, así que
finalmente se propuso una solución híbrida entre un portal de empleados para sustituir al que
están usando actualmente que, según ellos, no funciona bien (a3innuva) y un sistema de gestión
de espacios en la sede. Dicha aplicación sería modular y adaptable a cada sede.

## 2.2. Estado del arte

La revisión del estado del arte se organiza en cuatro ámbitos: el trabajo híbrido en España
(que define la razón de existir del proyecto), los portales ESS como aplicaciones de software, las
soluciones específicas de gestión de RRHH y espacios, y los fundamentos técnicos de la
arquitectura propuesta.

### 2.2.1 El trabajo híbrido en España

El teletrabajo en España ha evolucionado desde la pandemia de 2020 hacia una
estabilización en un nuevo equilibrio híbrido. Según el Instituto Nacional de Estadística, el
**15,4% de los ocupados teletrabajó durante 2024**: el 7,8% de forma habitual y el 7,6%
ocasionalmente, sumando aproximadamente 3,32 millones de personas (INE, 2025). El ONTSI
sitúa a España 1,9 puntos (en porcentaje) por debajo de la media europea en teletrabajo habitual,
y proyecta en su informe Teletrabajo 2025 que esta cifra continuará creciendo de forma
moderada (ONTSI, 2025).

Esto tiene consecuencias directas sobre el espacio físico. CBRE España sitúa el tráfico
promedio en oficinas en un **55% de la capacidad en 2024**, con caídas del 70% los viernes
(CBRE, 2025). El ratio de puestos por persona ha bajado a 0,74 en empresas híbridas
consolidadas, lo que implica que el modelo de un puesto fijo por empleado ha sido sustituido por
el hot desking. Gestionar dinámicamente este espacio requiere herramientas digitales de reserva.

Hablando de regulaciones, la Ley 10/2021, de 9 de julio, de trabajo a distancia
(BOE-A-2021-11472) establece el marco legal del teletrabajo en España, exigiendo un acuerdo
bilateral cuando el trabajo remoto supera el 30% de la jornada. A este marco se suma la
obligación de registro de jornada laboral, que un borrador del Real Decreto en tramitación
(2025–2026) prevé digitalizar de forma obligatoria para todas las empresas.

### 2.2.2 Portales ESS: evolución y estado actual

Los portales de autoservicio del empleado (ESS, Employee Self-Service) están dentro del
campo del e-HRM (Electronic Human Resource Management). Han evolucionado en tres
generaciones:

- Sistemas HRIS on-premise (Sistema de Información de Recursos Humanos en local) en
  los años 90 centrados en nóminas, intranets corporativas en los 2000 añadiendo solicitudes de
  vacaciones.
- Plataformas HCM (Human Capital Management) Cloud en los 2010 con autoservicio
  ampliado y apps móviles.
- La generación actual, denominada EXP (Employee Experience Platforms), integra
  además la gestión de espacios físicos, directorios interactivos y comunicación interna (Deloitte,
  2023).

El mercado global HCM fue valorado en 58.700 millones de dólares en 2024, con un
crecimiento proyectado hasta 81.100 millones en 2029 (Gartner, 2024).

### 2.2.3. Soluciones ESS/RRHH en el mercado español

En España, las soluciones más usadas entre pymes son Personio y Factorial. Personio se
originó en Alemania y ofrece diversos módulos de gestión de RRHH y cuenta con integraciones
con Microsoft Teams y sistemas de nómina externos, entre ellos a3innuva (Personio, 2026).
Factorial tiene origen barcelonés y destaca por su facilidad de uso y precio competitivo (desde
5,50€/usuario/mes), con funcionalidades bien valoradas para la gestión de asistencia y
vacaciones en entornos multisede (Factorial, 2026). Sin embargo, ambas plataformas comparten
una limitación estructural: no ofrecen funcionalidades para la gestión de espacios físicos como
plazas de aparcamiento o puestos de trabajo.

En el extremo opuesto se encuentran las grandes suites HCM como SAP SuccessFactors,
Workday u Oracle HCM Cloud. Estas plataformas cubren prácticamente cualquier necesidad de
RRHH, pero su coste de licencia e implementación (que requiere meses de consultoría
especializada) las hace inaccesibles para una empresa en plena fase de fusión. La plataforma
actualmente en uso, a3innuva de Wolters Kluwer, ocupa un lugar intermedio: funcional para
nóminas y documentación laboral, pero los usuarios no la usan para nada más que para obtener
sus documentos; quedando las demás secciones totalmente vacías o sin actualizar. Esto se debe a
una experiencia de usuario poco intuitiva para perfiles no administrativos, secciones confusas y
no tener ningún mecanismo para la gestión de espacios físicos (Wolters Kluwer, 2024).

| Solución    | Precio/mes | M365 Graph/Teams | Multi-sede | Nóminas API    | Custom/Modular     |
| ----------- | ---------- | ---------------- | ---------- | -------------- | ------------------ |
| Personio    | Consulta\* | Teams/Slack      | Sí         | Sí (a3innuva)  | Alta               |
| Factorial   | 5,50 €/usu | Outlook          | Sí         | Automatización | Alta               |
| a3innuva    | Consulta\* | No               | Parcial    | Sí             | Baja               |
| SAP/Workday | Muy alto   | Parcial          | Sí         | No             | Media              |
| GRUPOSIETE  | Sin licencia | Graph+Bot      | Sí         | Sí (futuro)    | Total              |

_Tabla 1. Comparativa de soluciones ESS/RRHH. \* Precio no público, requiere contacto comercial. Fuente: elaboración propia con datos de mercado consultados en marzo de 2026._

### 2.2.4. Soluciones de gestión de espacios físicos

Paralelamente a la evolución de los portales ESS, está apareciendo un mercado específico
de herramientas para la gestión de espacios de trabajo, impulsado por el auge del modelo híbrido.
Skedda es una de las plataformas más completas: permite gestionar puestos de trabajo, salas de
reuniones y plazas de aparcamiento desde una interfaz unificada, con integración básica con
calendarios de Microsoft 365, pero sin conexión con módulos de RRHH (Skedda, 2026).

Deskbird se centra en desk booking con integración notable con Microsoft Teams
(2,50€/usuario/mes), pero no contempla la gestión de plazas de aparcamiento (Deskbird, 2026).
Parkalot aborda específicamente el parking corporativo multisede (desde 49$/50 usuarios/mes),
con integración M365 básica y sin soporte para puestos de oficina ni visitantes (Parkalot, 2026).
KALENA es la solución española más cercana al caso de uso de GRUPOSIETE, cubriendo
parking y oficinas con soporte multisede, pero sin integración con Microsoft 365 Graph API y
sin posibilidad de extensión a otros módulos ESS (KALENA, 2026).

| Solución   | Precio/mes     | M365   | Parking | Oficina | Multi-sede |
| ---------- | -------------- | ------ | ------- | ------- | ---------- |
| Skedda     | Consulta\*     | Básico | Sí      | Sí      | No         |
| Deskbird   | 2,50 €/usu/mes | Teams  | No      | Sí      | Sí         |
| Parkalot   | 49 $/50 usu    | Básico | Sí      | No      | Sí         |
| KALENA     | 60 €/mes       | No     | Sí      | Sí      | Sí         |
| GRUPOSIETE | Sin licencia   | Graph  | Sí      | Sí      | Sí         |

_Tabla 2. Comparativa de soluciones de gestión de espacios. \* Precio no público, requiere contacto comercial. Fuente: Precios consultados en webs oficiales en marzo de 2026._

**Análisis:** ninguna solución del mercado combina en un único producto la gestión de
parking y oficinas con integración nativa en Microsoft 365 Graph y capacidad de extensión hacia
un portal del empleado completo. Las herramientas más cercanas al caso de uso (Skedda,
KALENA) funcionan de forma aislada y requieren herramientas adicionales para cubrir el resto
de necesidades de GRUPOSIETE.

### 2.2.5. Arquitectura modular de software

El concepto de modularidad en la ingeniería del software tiene raíces teóricas
consolidadas. El artículo de Parnas (1972), «On the criteria to be used in decomposing systems
into modules», publicado en Communications of the ACM, estableció el principio de ocultación
de información como criterio fundamental de descomposición modular: los módulos deben
encapsular decisiones de diseño susceptibles de cambio, minimizando el impacto de cualquier
modificación sobre el resto del sistema. Este principio, con más de cincuenta años de vigencia,
sigue siendo la base teórica de la arquitectura del portal propuesto.

Visto lo anterior, la arquitectura de este proyecto podría basarse en tres patrones:

- El monolito tradicional: código sin separación explícita de responsabilidades.
- Los microservicios: servicios independientes desplegados por separado.
- El monolito modular: descomposición lógica en módulos; mismo despliegue.

Su y Li (2024) analizan y documentan que el monolito modular es el patrón emergente
que «combina la simplicidad de la estructura monolítica con las ventajas de los microservicios»,
con casos de adopción en empresas como Shopify entre las más destacadas (Su & Li, 2024).
Martin Fowler es claro: «casi todas las historias de éxito con microservicios comenzaron con un
monolito que se volvió demasiado grande; casi todos los sistemas construidos desde cero como
microservicios han acabado en problemas serios» (Fowler, 2015).

El patrón de arquitectura plug-in extiende el monolito modular definiendo un sistema
core con puntos de extensión donde los módulos se conectan de forma independiente (Newman,
2019). Este patrón se mapea directamente al portal del TFG: el core es el shell de la aplicación
(autenticación, navegación, configuración del sistema) y los módulos plug-in son las
funcionalidades activables o desactivables desde el panel de administración sin modificar código
base.

### 2.2.6. Stack tecnológico: Next.js, PostgreSQL y Drizzle ORM

Next.js, el meta-framework React más adoptado según el State of JavaScript 2024,
introduce con su App Router (estable desde la versión 13.4) un sistema que unifica frontend y
backend en un único proyecto: React Server Components renderizan en el servidor reduciendo el
bundle del cliente, y Server Actions permiten ejecutar funciones asíncronas de servidor
directamente desde componentes React, eliminando la necesidad de una capa API REST
separada para mutaciones. Para un proyecto de equipo de desarrollo pequeño, esta combinación
reduce drásticamente la complejidad: un único lenguaje (TypeScript) para todo el stack y un
único despliegue.

La capa de persistencia se apoya en PostgreSQL autoalojado mediante Docker Compose, lo
que elimina la dependencia de proveedores externos y permite gestionar el ciclo de vida de la
base de datos como parte del propio proyecto. El acceso a los datos se realiza a través de
Drizzle ORM, un ORM de TypeScript con inferencia de tipos estricta: el esquema de la base de
datos es la única fuente de verdad y los tipos de la aplicación se derivan directamente de él sin
necesidad de generación de código adicional. La autorización se gestiona de forma explícita en
la capa de aplicación mediante guardas de rol, con Auth.js v5 (next-auth) como solución de autenticación
y DrizzleAdapter como puente entre la sesión y la base de datos.

## 2.3. Justificación de la propuesta

El análisis del estado del arte evidencia que el mercado ofrece soluciones bien
consolidadas para cada categoría de necesidad de forma individual (portales ESS, herramientas
de desk booking, sistemas de parking) pero ninguna que las integre de forma coherente y
extensible en el contexto de una pyme española integrada en el ecosistema Microsoft 365.

Esta fragmentación tiene consecuencias prácticas directas. Adoptar Factorial o Personio
resolvería las carencias de a3innuva en autoservicio de RRHH, pero no eliminaría la
coordinación informal de espacios por WhatsApp. Complementarlo con Deskbird cubriría los
puestos de oficina, pero no el parking. Añadir Parkalot cubriría el parking, pero no la gestión de
visitantes con la lógica de cesión de plazas de directivos. El resultado sería un ecosistema de tres
o cuatro herramientas desconectadas, con diferentes interfaces, diferentes contratos y ninguna
visión unificada del empleado: exactamente el problema que se intenta resolver.

El valor económico refuerza este argumento. La suma de licencias de varias herramientas
especializadas representa un coste recurrente que, para una empresa en plena fase de fusión,
puede resultar difícil de justificar. El desarrollo de una solución propia transfiere el valor a un
activo propio y controlado por la organización, con coste operativo de licencias cero.

La integración nativa con Microsoft 365 es una gran ventaja ya que GRUPOSIETE
utiliza el ecosistema de Microsoft como columna vertebral de su actividad diaria. Una
herramienta que no esté integrada con este ecosistema generará en los empleados una negativa a
la hora de adoptarlo en su flujo de trabajo normal por lo que terminarían ignorándolo (como
ocurre ahora). La integración con Microsoft Entra ID como proveedor de identidad único, con Microsoft
Graph API para sincronización de calendarios y con Teams para notificaciones, es por tanto una
condición necesaria y no una ventaja diferencial.

Por todo lo anterior, el desarrollo a medida de un portal del empleado modular,
construido sobre Next.js, TypeScript y PostgreSQL autoalojado, integrado nativamente en
Microsoft 365, se presenta como la única alternativa que responde simultáneamente a la totalidad de los requisitos
de GRUPOSIETE: cobertura funcional completa para el MVP, integración real con M365,
arquitectura extensible a módulos futuros y coste operativo cero en licencias.

**Hipótesis**: la implementación de un portal del empleado modular basado en Next.js,
PostgreSQL y Microsoft 365 Graph resolverá la fragmentación entre sedes de GRUPOSIETE,
optimizando el uso de espacios corporativos sin inversiones adicionales en licencias de software
o cambios de sede, y proporcionando diversos módulos de panel del empleado y una base
arquitectónica extensible a módulos futuros más complejos de gestión avanzada de RRHH y
contabilidad.

## 2.4. Objetivos Generales y Específicos

### 2.4.1 Objetivo general

Desarrollar un portal del empleado modular para GRUPOSIETE que gestione espacios
corporativos (parking y oficinas) y módulos básicos del panel de empleado, integrado
nativamente en Microsoft 365, demostrando mediante su implementación una arquitectura
extensible a módulos futuros de gestión de recursos humanos.

### 2.4.2 Objetivos específicos

- **OS1:** Capturar los requisitos del sistema mediante sesiones de levantamiento de
  información con personas clave de GRUPOSIETE, elaborar el modelo del dominio y definir y
  priorizar los casos de uso que delimitan el alcance del MVP (Capítulo 3).
- **OS2:** Realizar el análisis y diseño del sistema: definir la arquitectura (Next.js con App
  Router, PostgreSQL autoalojado con Drizzle ORM, Microsoft Entra ID como proveedor de identidad), el modelo
  lógico y físico de datos en PostgreSQL, y los diagramas de despliegue y paquetes (Capítulo 4).
- **OS3:** Implementar y validar el MVP funcional con pruebas unitarias (Vitest) y pruebas
  end-to-end (Playwright), desplegando en un servidor propio mediante pipeline CI/CD con GitHub Actions
  (Capítulo 5).
- **OS4:** Evaluar la solución mediante métricas de cobertura de tests, rendimiento (Core Web
  Vitals) y usabilidad (SUS), verificar la trazabilidad entre requisitos y entrega, y proponer un
  roadmap de evolución futura (Capítulo 6).

## 2.5. Estructura del trabajo

Para el desarrollo de este proyecto se adopta el Proceso Unificado de Rational (RUP) en
una adaptación individual, organizada en cuatro iteraciones que se corresponden directamente
con los capítulos del documento (Jacobson et al., 2000). Se elige RUP frente a otras
metodologías (como el ciclo de vida en cascada o marcos ágiles puros como Scrum) por su
capacidad para gestionar la incertidumbre de los requisitos mediante iteraciones cortas, su
énfasis en la documentación formal de las disciplinas de análisis y diseño, y su alineación con la
estructura de entregables del TFG. La adaptación individual concentra todos los roles en el
mismo autor, con supervisión iterativa semanal por parte de la tutora académica.

1. **Primera iteración - Requisitos (Capítulo 3):** a partir de sesiones de levantamiento de
   información con personas clave de GRUPOSIETE, se elabora el modelo del dominio, se
   identifican los actores del sistema y se definen los casos de uso del MVP. Se producen prototipos
   de interfaz de baja y alta fidelidad con plantUML para validar la comprensión de los requisitos.

2. **Segunda iteración - Análisis y diseño (Capítulo 4):** a partir de los casos de uso
   formalizados se derivan las clases de análisis y diseño, se define la arquitectura del sistema y el
   modelo lógico y físico de datos en PostgreSQL, y se elaboran los diagramas de despliegue y
   paquetes.

3. **Tercera iteración - Implementación (Capítulo 5):** el MVP se construye de forma
   incremental comenzando por la capa de autenticación SSO con Microsoft Entra ID, seguida de
   los módulos de reservas y el panel de administración, con pruebas unitarias (Vitest) y end-to-end
   (Playwright). El despliegue se realiza en un servidor propio mediante CI/CD con GitHub Actions.

4. **Cuarta iteración - Evaluación y conclusiones (Capítulo 6):** se evalúa la solución
   mediante métricas de cobertura de tests, rendimiento (Core Web Vitals) y usabilidad (SUS), se
   verifica la trazabilidad entre requisitos y entrega, y se propone un roadmap de evolución que
   contemple módulos adicionales como integración con Personio para nóminas y gestión
   avanzada de documentación laboral.

Las herramientas de soporte empleadas a lo largo del proyecto son: GitHub para control
de versiones y trazabilidad de commits, el repositorio de código abierto
https://github.com/satnaing/shadcn-admin como plantilla para el dashboard (core), Notion para la
gestión de tareas y apuntes, PlantUML para la elaboración de diagramas UML.
