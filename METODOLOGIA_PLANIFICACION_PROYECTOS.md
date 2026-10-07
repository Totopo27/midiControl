# Metodología de Planificación y Arquitectura de Proyectos

> **Guía práctica y reproducible para el diseño de sistemas modulares, ecosistemas de skills y flujos de trabajo con compuertas de validación (*gates*).**  
> *Basada en el proceso implementado y validado en el proyecto `yiMod` (Smart Sentinel-Yi).*

---

## 1. Visión General del Proceso

El objetivo de esta metodología es evitar la improvisación técnica y el desarrollo desordenado. Antes de programar código final, el proyecto se estructura en **cuatro etapas secuenciales**:

```text
┌─────────────────────────────────┐
│ 1. Levantamiento de Recursos    │ ──► Mapeo comunitario, firmwares/drivers, librerías base
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 2. Arquitectura del Sistema     │ ──► Separación en capas de responsabilidad única
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 3. Ecosistema de Skills (.md)   │ ──► Creación de roles/agentes expertos modulares
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 4. Fases con Compuertas (Gates) │ ──► Flujo secuencial: ningún paso avanza sin test medible
└─────────────────────────────────┘
```

---

## 2. Detalle de las 4 Etapas de Preparación

### Etapa 1: Levantamiento y Curaduría de Recursos Base
* **Objetivo:** No reinventar la rueda; mapear el estado del arte y el soporte del hardware o ecosistema.
* **Acciones:**
  1. Identificar librerías clave, repositorios en GitHub con soluciones similares o firmwares/drivers oficiales.
  2. Documentar foros de discusión técnica (ej. DashCamTalk, foros de audio/MIDI, StackOverflow, GitHub Issues).
  3. Registrar herramientas de configuración de bajo nivel o utilidades existentes.
* **Artefacto resultante:** `recursos_<tema_o_dispositivo>.md` (con enlaces, descripciones y casos de uso concretos de cada recurso).

---

### Etapa 2: Diseño de la Arquitectura en Capas
* **Objetivo:** Definir con precisión qué componente hace qué cosa, separando el hardware, la ingesta de datos, el procesamiento central y la capa de interacción o usuario.
* **Patrón aplicado en `yiMod`:**
  1. **Capa Edge / Dispositivo:** Configuración de bajo nivel y servicio nativo (ej. streaming RTSP en cámara).
  2. **Capa de Ingesta / Transporte:** Hilo desacoplado para capturar eventos o datos en tiempo real sin latencia acumulada ni bloqueos.
  3. **Capa de Procesamiento / Lógica Central:** Inferencia o transformación pesada (ej. modelos de IA en GPU o procesamiento de mensajes).
  4. **Capa de Control / Interfaz de Usuario:** Servicio asíncrono para alertas, comandos o interacción externa (ej. bot de Telegram con whitelist).
* **Artefacto resultante:** Diagrama de bloques y descripción del pipeline en la sección 1 del plan de trabajo.

---

### Etapa 3: Modularización en Skills Especializadas (`.opencode/skills/`)
* **Objetivo:** Asignar dominios de conocimiento acotados a agentes/skills específicos para que cada tarea técnica se ejecute con estándares rigurosos.
* **Estructura típica de 4 roles:**

| Tipo de Rol | Función en el Proyecto | Ejemplo en `yiMod` |
| :--- | :--- | :--- |
| **Auditor de Stack / Dependencias** | Extraer contratos técnicos oficiales (Context7), detectar gotchas comunitarios (WebSearch/GitHub) y verificar compatibilidad y CVEs antes de instalar nada. | `tech-researcher-evaluator` |
| **Experto en Hardware / Protocolo** | Manejo de bajo nivel, scripts de arranque, formatos de archivo o protocolos de comunicación (ej. MIDI, RTSP, serie). | `yi-firmware-expert` |
| **Motor de Procesamiento Central** | Pipeline de ejecución crítica, manejo de buffers y algoritmos principales. | `vision-relation-engine` |
| **Controlador de Salida / UI / Bot** | Despacho asíncrono, seguridad, control de acceso, filtros de saturación (*debounce*) y comandos remotos. | `sentinel-bot-handler` |

* **Artefacto resultante:** Directorios en `.opencode/skills/<nombre-skill>/SKILL.md` definiendo el rol, inputs, outputs y reglas operativas de cada una.

---

### Etapa 4: Flujo de Trabajo Secuencial con Compuertas de Validación (*Gates*)
* **Objetivo:** Dividir el desarrollo en fases incrementales donde **la compuerta de salida (*Gate*) es un criterio medible e innegociable** para poder pasar a la siguiente fase.

```text
[FASE 0] Auditoría & Fijación del Stack  ────► Gate 0: Entorno virtual limpio y dependencias fijadas
   │
   ▼
[FASE 1] Hardware & Conectividad Base    ────► Gate 1: Comunicación funcional básica verificada
   │
   ▼
[FASE 2] Ingesta / Transporte en Tiempo Real ──► Gate 2: Latencia controlada y estabilidad sostenida
   │
   ▼
[FASE 3] Núcleo de Procesamiento / Lógica ──► Gate 3: Algoritmo/modelo corriendo bajo el SLA requerido
   │
   ▼
[FASE 4] Integración & Control de Usuario ────► Gate 4: Interfaz final recibiendo datos y respondiendo
```

* **Artefacto resultante:** `FLUJO_DE_TRABAJO.md` estructurado con objetivos, actividades y la compuerta de salida explícita de cada fase.

---

## 3. Lista de Chequeo (*Checklist*) para un Nuevo Proyecto

1. [ ] **Definir el problema:** ¿Cuál es la entrada, cuál es la transformación y cuál es la salida deseada?
2. [ ] **Crear `recursos_<proyecto>.md`:** Listar SDKs, repositorios de referencia, especificaciones de protocolo y foros clave.
3. [ ] **Dibujar el flujo de datos:** Esquematizar cómo viaja la señal o el dato desde el origen hasta el destino.
4. [ ] **Crear las skills en `.opencode/skills/`:** Definir los 3 a 4 especialistas que resolverán cada tramo técnico.
5. [ ] **Redactar `FLUJO_DE_TRABAJO.md`:** Detallar las fases desde la Fase 0 (auditoría previa) hasta la entrega final, estableciendo el criterio de aprobación de cada compuerta (*Gate*).
