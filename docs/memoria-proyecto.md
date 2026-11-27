# Memoria del proyecto — Intranet de gestión docente (apartado 5)

> Transcripción del apartado 5 de la memoria del Proyecto Intermodular DAW (IES Ramón Arcas Meca).
> Es la **referencia funcional** de los requisitos: qué debe hacer cada módulo y en qué fase.
> Las decisiones técnicas concretas del repositorio (endpoints, roles, nombres de campos) siguen en
> [architecture.md](architecture.md), [api-contract.md](api-contract.md) y
> [roles-and-permissions.md](roles-and-permissions.md). Si hay discrepancia, se documenta como
> **PENDIENTE DE DECISIÓN**; no se cambia en silencio ni la memoria ni la arquitectura.
>
> Decisiones del equipo que matizan la memoria están en [Notas del equipo](#notas-del-equipo) al final.

## 5.1 Descripción general

La intranet es una aplicación web privada, instalable como PWA tanto en escritorio como en dispositivos móviles (Android e iOS), que digitaliza la gestión diaria del centro educativo. A diferencia de la web pública, es una herramienta transaccional: gestiona datos personales del profesorado y del alumnado, requiere autenticación y aplica un sistema de roles y permisos en todas sus funcionalidades.

A continuación se describe, módulo a módulo, el detalle funcional que cada pareja responsable deberá implementar.

## 5.2 Comunicación interna

### 5.2.1 Tablón de anuncios

- Feed de anuncios segmentado por departamento didáctico, curso o ámbito (general/departamental).
- Cada anuncio incluye: título, cuerpo, autor, fecha de publicación, fecha de caducidad opcional y posibilidad de fijarlo como destacado.
- Los anuncios caducados dejan de mostrarse automáticamente en el feed, sin necesidad de borrarlos (borrado lógico).

### 5.2.2 Notificaciones

- Notificaciones push mediante Web Push API mostradas mientras la PWA está instalada, y notificaciones por correo electrónico como canal alternativo.
- Eventos que deben generar notificación: publicación de un anuncio destacado, asignación de una guardia, cambios de horario, y cambios de estado en cualquier ticket (RMI, compras, RRSS).

### 5.2.3 Publicaciones en RRSS con IA

- El formulario de creación recoge: título de la actividad, departamento didáctico responsable, una o varias imágenes adjuntas y una descripción breve de la actividad.
- Al enviarse el formulario, una llamada a un modelo de IA generativa produce un borrador de texto de la publicación a partir de esos datos. El sistema no publica automáticamente en redes sociales: solo genera el borrador de texto.
- La solicitud se registra como un "ticket" (ver apartado 5.7) visible para el administrador de RRSS, quien podrá copiar el texto generado y descargar las imágenes adjuntas antes de publicarlas manualmente.

## 5.3 Aula y alumnado

### 5.3.1 Emplazamiento de estudiantes en el aula

- Permite definir distintos diseños de aula (distribución de pupitres y agrupaciones) de forma configurable, no necesariamente mediante un editor visual libre.
- Cada diseño de aula puede asociarse a una clase (grupo + módulo) concreta.

### 5.3.2 Gestión de retrasos

- El profesorado únicamente registra el retraso de un alumno (fecha, hora, módulo en el que se produce) y puede consultar el histórico acumulado de retrasos de cualquier alumno durante el curso escolar.
- Las estadísticas agregadas de retrasos —tanto globales como desglosadas por módulo— no son visibles para el profesorado: se calculan exclusivamente para el Dashboard del equipo directivo (ver apartado 5.11).

### 5.3.3 Aula de convivencia

- Jefatura de estudios da de alta la derivación de un alumno concreto al aula de convivencia, indicando el motivo y el trabajo académico asignado.
- Cada hueco horario del aula de convivencia se cubre mediante una guardia con destino específico (ver 5.4.2): el docente asignado a esa guardia en ese hueco concreto visualiza, únicamente durante su hora, el alumno o alumnos derivados y el trabajo que deben realizar.
- Se recomienda vincular la derivación con el sistema de incidencias/partes disciplinarios del centro, de forma que quede trazado el motivo de origen.

## 5.4 Horarios y guardias

### 5.4.1 Horarios del profesorado

- Visualización del horario semanal individual de cada docente, incluyendo las horas de reducción horaria, modeladas como bloques adicionales de no disponibilidad.
- Comparador de horarios: dados dos o más docentes, calcula la intersección de sus huecos libres para proponer instantes válidos en los que convocar una reunión.

### 5.4.2 Gestión de guardias — regla de asignación

Este es uno de los módulos con mayor complejidad de negocio de toda la intranet y debe implementarse siguiendo exactamente la siguiente regla:

1. En cada hueco horario de guardia puede haber más de un docente asignado.
2. La asignación se organiza por rondas. El sistema mantiene, para cada docente y para cada hueco horario concreto, un contador de guardias realizadas.
3. Al comenzar una ronda nueva, si varios docentes están en igualdad de condiciones (mismo número de guardias realizadas), la selección entre ellos es aleatoria.
4. La comparación del contador de guardias realizadas se hace siempre entre los docentes disponibles en ese hueco horario concreto, nunca contra el conjunto total del claustro.
5. Si el docente al que le corresponde la guardia no puede asistir, la guardia la realiza otro docente disponible en ese hueco, aunque tenga más guardias realizadas que el primero. El sistema da prioridad, en la ronda siguiente, a asignar la guardia de nuevo a quien tiene menos guardias realizadas.
6. Ejemplo de aplicación: el docente A tiene 3 guardias realizadas y le corresponde la guardia, pero no puede asistir. La cubre el docente B, que tenía 5, y pasa a 6. En las semanas siguientes que coincidan en ese mismo hueco horario, si solo hay una guardia que cubrir, se asignará al docente A hasta que su contador también alcance 6. A partir de ese momento, A y B quedan en igualdad de condiciones para ese hueco y el sorteo vuelve a decidir entre ambos.

> **Nota de diseño.** El modelo de datos debe distinguir entre "docente asignado" (a quien le corresponde por ronda) y "docente que realiza" la guardia (quien finalmente la cubre), ya que ambos conceptos pueden no coincidir.

### 5.4.3 Tipos de ausencia del profesorado

- **Genérica:** requiere justificación del motivo y adjuntar un justificante una vez transcurrida la guardia correspondiente.
- **Administrativa:** gestiones o trámites propios del puesto docente.
- **Extraescolar:** derivada de la asistencia a una excursión o actividad con alumnado; el profesorado que participa en la actividad queda marcado automáticamente como ausente durante los días y horas en que esta transcurre.

## 5.5 Flujo completo de ausencias y firma de documentos

El flujo de ausencias es transversal a los distintos tipos descritos en el apartado anterior y debe implementarse como una máquina de estados única, reutilizada también por el módulo de Comisiones de servicio (apartado 5.6.3):

1. El docente marca su ausencia, indicando si afecta a un día completo o a determinadas horas, y el tipo (genérica, administrativa, extraescolar).
2. Si la ausencia es genérica, una vez transcurrida la hora de guardia correspondiente, el docente debe justificar el motivo y adjuntar el justificante correspondiente.
3. Los datos personales necesarios para el documento se autocompletan a partir de la cuenta de Google vinculada por OAuth; si el docente aún no ha iniciado sesión mediante OAuth, se toman como alternativa los datos de su perfil.
4. El sistema genera automáticamente un documento PDF con toda la información recogida.
5. El docente firma el documento generado, mediante una de estas dos vías: firma electrónica utilizando AutoFirma, o firma manuscrita capturada en pantalla (dedo o ratón) e incrustada en el PDF.

> **Alcance de la firma electrónica.** La firma manuscrita en pantalla es un objetivo garantizado del proyecto. La integración con AutoFirma depende de que el usuario disponga de certificado digital y de la aplicación instalada en su equipo, factores fuera del control del sistema; se tratará como un objetivo a alcanzar en la medida de lo posible, sin que su ausencia impida la evaluación positiva del módulo si la vía manuscrita funciona correctamente.

## 5.6 Documentación y recursos

### 5.6.1 Repositorio documental

- Organización de documentos por departamento didáctico y por proyecto del centro.
- La visibilidad de cada documento depende de la asignación del docente que consulta: solo se muestran los documentos vinculados a su departamento o a los proyectos en los que participa.

### 5.6.2 Reserva de espacios y recursos

- Gestión de la disponibilidad de espacios compartidos (salón de actos, biblioteca, aulas de informática) y de recursos materiales (portátiles, proyectores).
- El sistema debe detectar e impedir solapamientos de reserva sobre un mismo espacio o recurso en la misma franja horaria.

### 5.6.3 Comisiones de servicio

- Formulario de solicitud de permiso para asistir a formaciones o reuniones convocadas por la Consejería de Educación y Formación Profesional.
- Una vez completados los datos requeridos, el sistema genera un PDF y aplica el mismo flujo de firma descrito en el apartado 5.5 (electrónica o manuscrita).

## 5.7 Entidad genérica de solicitudes ("ticket")

Los tres módulos siguientes comparten exactamente el mismo patrón funcional: un formulario de creación, una notificación al responsable correspondiente y una cola de gestión con estados (pendiente, en curso, finalizado). Se recomienda modelar una única entidad reutilizable en lugar de implementar tres flujos independientes.

| Módulo | Campos del formulario | Responsable / gestión |
|--------|-----------------------|-----------------------|
| Incidencias RMI | Título, descripción, dispositivo(s) afectado(s), aula | Email automático al responsable de RMI; vista con histórico y filtros por estado |
| Gestión de compras | Nombre del artículo o artículos, precio total, checklist "¿Requiere presupuesto?" con adjunto si aplica | Email automático al secretario del centro; cola de acciones pendientes |
| Publicaciones RRSS (vista admin) | Heredados del formulario de creación (5.2.3): texto generado por IA e imágenes adjuntas | Cola para el administrador de RRSS: copiar texto y descargar imágenes antes de publicar |

La entidad genérica de "solicitud/ticket" debe contemplar, como mínimo, los siguientes atributos: tipo de solicitud, datos del solicitante, responsable asignado, estado, datos específicos del tipo (en un campo flexible) y acciones disponibles según el tipo de ticket.

## 5.8 Seguimiento de la Formación en Empresas (FEM)

Este módulo debe ser válido para todos los ciclos formativos del centro que incluyan un periodo de Formación en Empresas, no solo para el ciclo de DAW.

- Cada docente visualiza únicamente la FEM que tiene asociada, según el ciclo o ciclos que tutoriza.
- Vista de mapa geográfico: empresas colaboradoras activas e inactivas, geolocalizadas (se recomienda Leaflet junto con datos de OpenStreetMap y geocodificación mediante Nominatim, ambos gratuitos).
- Vista de listado: alumnado en prácticas, empresa asignada y estado del seguimiento.
- Indicador de progreso: porcentaje de horas de FEM cursadas por cada alumno respecto al total previsto (500 horas).

## 5.9 Administración, acceso y seguridad

### 5.9.1 Roles y permisos

- Perfiles estándar (accesibles a todo el profesorado), perfil de administrador (acceso total) y perfiles definidos por competencias asignadas (por ejemplo: jefatura de estudios, secretaría, responsable de RMI, administrador de RRSS).
- Registro de auditoría: toda acción relevante realizada en el sistema queda registrada (usuario, acción, fecha/hora), de forma consultable en caso de ser necesario.

### 5.9.2 Acceso mediante OAuth

- Inicio de sesión mediante OAuth de Google, sin restricción de dominio (abierto a cualquier cuenta de Google).
- Alta de usuarios por dos vías: alta manual realizada por un administrador (sin necesidad de OAuth), o alta mediante OAuth, que deja al usuario en estado "Pendiente de confirmación" hasta que un administrador la apruebe.

### 5.9.3 RGPD

- Gestión de consentimientos y de los derechos de acceso y rectificación sobre los datos personales tratados.
- Trazabilidad de accesos a datos sensibles, especialmente los referidos a menores de edad.

## 5.10 Primeros pasos (onboarding)

- Guía de bienvenida para el profesorado de nueva incorporación al centro o a la intranet.
- Incluye instrucciones básicas de funcionamiento y sugerencias de vídeos cortos explicativos de cada módulo.

## 5.11 Dashboard del equipo directivo

Acceso restringido exclusivamente al equipo directivo, mediante el sistema de roles descrito en el apartado 5.9.1. Debe mostrar, como mínimo, los siguientes indicadores:

| # | Indicador (KPI) |
|---|-----------------|
| 1 | Tasa de abandono por curso |
| 2 | Rendimiento académico por grupo |
| 3 | Retrasos organizados por grupo, con umbral de "tasa alta" configurable por dirección, particularizando en los estudiantes que lo superen |
| 4 | Ausencias del profesorado |
| 5 | Formación en Empresas: porcentaje de empresas activas respecto a las registradas, desglosado por municipio y por ciclo formativo |
| 6 | Formación en Empresas: porcentaje de horas cursadas respecto al total previsto (500 horas) |
| 7 | Publicaciones en RRSS por departamento y porcentaje efectivamente publicado |
| 8 | Uso del aula de convivencia |
| 9 | Comisiones de servicio gestionadas |

El umbral que define una "tasa alta" de retrasos (indicador 3) debe implementarse como un parámetro configurable por el equipo directivo, nunca como un valor fijo en el código.

## 5.12 Interfaz por dispositivo

La intranet debe construirse como una PWA instalable, con un único código base que ofrezca dos paradigmas de navegación distintos según el dispositivo detectado:

- **Escritorio:** interfaz web completa con un menú de navegación lateral izquierdo, de forma similar a las herramientas de IA conversacional actuales (Claude, ChatGPT, Gemini).
- **Móvil:** interfaz con un estilo visual próximo a las versiones más recientes de iOS, con barra de navegación inferior y tarjetas de contenido de mayor tamaño, adaptada a interacción táctil.

## 5.13 Arquitectura técnica

La intranet se implementará dividiendo claramente el frontend del backend:

- **Backend:** Python con el framework FastAPI. Autenticación mediante JWT (access/refresh) y control de permisos mediante dependencias (`Depends()`) aplicadas de forma transversal a todos los endpoints.
- **Persistencia:** base de datos NoSQL con MongoDB como almacén principal (usuarios, expedientes, guardias, ausencias, tickets, FEM, auditoría) y Redis como complemento —nunca como sustituto— para caché de consultas frecuentes, gestión de sesiones y cola de tareas en segundo plano.
- **Tareas en segundo plano:** envío de correos electrónicos, generación de documentos PDF y envío de notificaciones push, mediante `BackgroundTasks` de FastAPI (recomendado para el volumen de un centro educativo) o Celery + Redis si el volumen de trabajo lo justifica.
- **Generación de PDF y firma:** librerías como WeasyPrint o ReportLab para la generación del documento, y Pillow para incrustar la firma manuscrita capturada en el frontend.
- **Notificaciones:** Web Push API junto con un Service Worker en el frontend, y una librería como pywebpush en el backend; el envío de correo puede resolverse con fastapi-mail o SMTP directo.
- **Mapas:** Leaflet en el frontend junto con datos de OpenStreetMap, y Nominatim para la geocodificación de direcciones de empresas colaboradoras (FEM).
- **Frontend:** framework a elegir por cada equipo (React o Vue) combinado con TypeScript, compartiendo un mismo sistema de diseño entre el layout de escritorio y el de móvil.
- **Entorno:** contenerización con Docker/docker-compose, variables de entorno mediante fichero `.env`, versionado de la API (`/api/v1/...`) y pruebas automatizadas con pytest, especialmente sobre el núcleo de autenticación, roles y el algoritmo de asignación de guardias.

**Servicios externos:** Google OAuth (acceso) · Google Calendar (sincronización) · SMTP (envío de correo) · Web Push (notificaciones) · Nominatim/OpenStreetMap (geocodificación y mapas) · API de un modelo de IA generativa (borrador de texto para RRSS) · AutoFirma (firma electrónica, mejor esfuerzo).

## 5.14 Fases de desarrollo

| Fase | Contenido |
|------|-----------|
| **Fase 1 — Cimientos** | Esquema de datos inicial y temporalización completa del proyecto; autenticación básica; núcleo mínimo de roles y permisos. |
| **Fase 2 — Núcleo funcional** | Tablón de anuncios; Seguimiento FEM; Publicaciones RRSS (borrador con IA); Gestión de retrasos; Emplazamiento en el aula; Roles y permisos (capa completa); Primeros pasos; Incidencias RMI y/o Gestión de compras (repartidos según carga de trabajo). |
| **Fase 3 — Guardias y firma** | Guardias (con flujo de ausencias y firma); Aula de convivencia; Comisiones de servicio (con firma); Incidencias RMI y/o Gestión de compras (el módulo restante de la Fase 2). |
| **Fase 4 — Integraciones** | OAuth completo; integración con Google Calendar; notificaciones (push y email); documentación técnica final. |

## Notas del equipo

Decisiones acordadas que concretan o matizan la memoria para este repositorio:

- **Frontend:** se eligió React + Vite + TypeScript (5.13 permite React o Vue).
- **RRSS con IA (5.2.3):** por indicación del profesorado, de momento el borrador lo genera un **mock** (generador `plantilla`, sin IA real) detrás de la interfaz `GeneradorBorrador` de `backend/app/services/ia/`. El proveedor real se elige con `IA_PROVEEDOR` y sigue **PENDIENTE DE DECISIÓN**. El resto del flujo (ticket, cola, copiar texto, descargar imágenes) usa el backend real.
- **Sin datos simulados en la PWA:** todas las vistas consumen la API real; los módulos sin API aparecen como "En desarrollo".
- **Estados del ticket (5.7):** el repositorio usa `abierto → en_proceso → resuelto → cerrado`. Equivalencia con la memoria: *pendiente* = `abierto`, *en curso* = `en_proceso`, *finalizado* = `resuelto` / `cerrado` (`cerrado` es el archivo definitivo tras la resolución).
- **Responsables por competencias (5.9.1):** los perfiles de secretaría, responsable de RMI o administrador de RRSS son el rol `responsable_ticket` más `competencias` (`compras`, `rmi`, `rrss`), no roles nuevos. Ver [roles-and-permissions.md](roles-and-permissions.md).
- **FEM:** prefijo `/api/v1/fem` (Formación en Empresas Murcia); no se renombra a `/fct`.
