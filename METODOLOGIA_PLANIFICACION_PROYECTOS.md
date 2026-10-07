# Metodología de planificación técnica por compuertas de validación

Guía de arquitectura y organización de proyectos técnicos basada en desarrollo modular y compuertas de validación (*gates*).

---

## 1. Principio fundamental

El propósito de esta metodología es evitar el desarrollo por ensayo y error sin rumbo fijo. Antes de escribir código definitivo, cualquier proyecto técnico se estructura en cuatro etapas concretas:

```text
 1. Levantamiento de recursos
    └── Documentar herramientas, protocolos, librerías y restricciones del hardware.
         │
 2. Arquitectura del sistema
    └── Separar el sistema en capas con responsabilidades independientes.
         │
 3. Definición modular de tareas
    └── Aislar los componentes del sistema para resolver problemas acotados.
         │
 4. Fases con compuertas de validación
    └── Cada etapa concluye con una prueba medible y reproducible.
```

---

## 2. Las cuatro etapas de preparación

### Etapa 1: Levantamiento y selección de recursos base
- **Objetivo:** Analizar el estado de las herramientas disponibles, especificaciones de protocolos y compatibilidad antes de tomar decisiones técnicas irreversibles.
- **Acciones:**
  1. Identificar librerías clave y dependencias directas.
  2. Documentar limitaciones conocidas de la plataforma (controladores de sistema operativo, puertos, restricciones de red o seguridad).
  3. Registrar proyectos de referencia y estándares oficiales (por ejemplo, especificaciones MIDI 1.0, OSC 1.0, RFC de WebSockets).
- **Documento resultante:** Un archivo de recursos (`recursos_<tema>.md`) con enlaces, comandos de prueba y notas concretas de compatibilidad.

---

### Etapa 2: Diseño de la arquitectura en capas
- **Objetivo:** Delimitar con precisión qué hace cada componente para evitar acoplamientos innecesarios entre el transporte de datos, la lógica central y la interfaz.
- **Estructura recomendada:**
  1. **Capa de interfaz o periférico:** Conexión directa con hardware físico o clientes remotos (puertos USB, sockets de red, controladores).
  2. **Capa de ingesta y transporte:** Hilos o procesos asíncronos para recibir y emitir mensajes sin frenar el flujo de datos.
  3. **Capa de procesamiento central:** Normalización de datos, seguimiento de estado, enrutamiento matricial y lógica de negocio.
  4. **Capa de telemetría e inspección:** Herramientas de diagnóstico, registro de eventos y paneles de control accesibles en tiempo real.
- **Documento resultante:** Diagrama de bloques y descripción del flujo de datos en el plan de arquitectura.

---

### Etapa 3: Modularización de componentes
- **Objetivo:** Dividir el sistema en módulos con responsabilidades claras y contratos de entrada/salida definidos.
- **Roles habituales en un sistema de tiempo real:**
  - **Manejador de hardware y puertos:** Encargado de la detección, apertura y reconexión de interfaces físicas.
  - **Procesador de flujo:** Encargado del filtrado, conversión de formato y despacho sin bloqueo.
  - **Manejador de protocolos de red:** Codificación de paquetes, manejo de datagramas UDP o conexiones TCP/WebSocket.
  - **Módulo de diagnóstico y control:** Interfaz de usuario, métricas de rendimiento y comandos de seguridad (como rutinas de pánico o reinicio).
- **Documento resultante:** Definición de responsabilidades en la documentación técnica del repositorio.

---

### Etapa 4: Fases de desarrollo con compuertas (*Gates*)
- **Objetivo:** Dividir el ciclo de trabajo en etapas secuenciales donde avanzar a la siguiente requiere superar una prueba técnica objetiva.

```text
Fase 0: Diagnóstico de entorno   ──► Gate 0: Entorno configurado y dependencias verificadas
   │
   ▼
Fase 1: Conectividad elemental   ──► Gate 1: Comunicación unidireccional comprobada
   │
   ▼
Fase 2: Concurrencia y flujo     ──► Gate 2: Transporte paralelo sin degradación de latencia
   │
   ▼
Fase 3: Telemetría y control     ──► Gate 3: Monitor funcional y comandos de contingencia operativos
   │
   ▼
Fase 4: Pruebas de estrés        ──► Gate 4: Ejecución continua bajo carga sin errores ni fugas
```

- **Documento resultante:** `FLUJO_DE_TRABAJO.md` con los criterios de aceptación y comandos de verificación de cada fase.

---

## 3. Lista de control para nuevos proyectos

1. [ ] **Definir entradas y salidas:** Qué dispositivo genera datos, qué formato tienen y qué receptor debe recibirlos.
2. [ ] **Crear documento de recursos:** Listar librerías, estándares de comunicación y herramientas de diagnóstico previas.
3. [ ] **Trazar el diagrama de flujo:** Seguir el recorrido de un paquete de datos desde su origen hasta cada destino.
4. [ ] **Establecer las compuertas técnicas:** Definir qué prueba medible marca el cierre de cada fase de desarrollo.
5. [ ] **Ejecutar en orden:** No pasar a la capa de interfaz o estrés sin haber validado la conectividad base y el transporte de datos.
