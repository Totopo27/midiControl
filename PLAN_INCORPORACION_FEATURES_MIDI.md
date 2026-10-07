# Plan de Incorporación y Valoración Técnica: Features de MidiShift, MIDI Split y MidiView en `midiControl`

**Estado de RDD:** Activo (High Risk Tier)  
**Metodología:** `project-architect` (Arquitectura por Fases + Compuertas Binarias / Gates)  
**Objetivo:** Diseñar un plan de evaluación e integración técnica riguroso para incorporar las funcionalidades clave descubiertas en el análisis de software especializado (MidiShift, MIDI Split y MidiView) dentro del núcleo de `midiControl`.

---

## 1. Diagnóstico del Estado Actual de `midiControl`

Actualmente, el proyecto `midiControl` cuenta con las siguientes capacidades ya consolidadas y validadas en E2E:
1. **Fase 0 - Detección:** Detección de puertos MIDI físicos mediante `jzz` y apertura de sockets UDP.
2. **Fase 1 - Despacho MIDI:** Despacho estándar Note-On / Note-Off con latencia < 5 ms.
3. **Fase 2 - Concurrencia:** Bifurcación paralela e independiente hacia hardware MIDI y datagramas OSC (SuperCollider/Max).
4. **Fase 3 - Inspección y Pánico:** Registro de eventos en memoria, interfaz web de telemetría (puerto 3000/8081) y vaciado de notas colgadas (`activeNotesMap` + All Notes Off).
5. **Fase 4 - Resiliencia:** Pruebas de estrés y estabilidad con 0 fugas de notas.

### Oportunidades y Carencias Actuales frente a las Herramientas Analizadas
- **Sin soporte de capas virtuales (Shift):** Si el músico se queda sin botones o pads físicos en su controlador, no puede duplicar la superficie de control.
- **Sin almacenamiento de estado de LEDs/Feedback:** Al cambiar de canal o función, el hardware no puede refrescar su iluminación de pads RGB ni faders motorizados.
- **Sin puertos virtuales ni prevención de bucles multi-app:** Si dos programas intentan acceder al mismo dispositivo físico o enviar feedback a la vez, Windows colisiona o se generan bucles de retroalimentación (*MIDI feedback loops*).
- **Sobrecarga de UI en vivo:** El monitor actual siempre procesa y emite eventos hacia la interfaz gráfica, lo cual puede introducir fluctuaciones de latencia (jitter) en un concierto o sesión en vivo exigente.

---

## 2. Mapa de Valoración Técnica (Matriz de Aporte vs. Complejidad)

| Funcionalidad Analizada | Origen | Valor / Aporte Real al Proyecto | Complejidad Técnica | Decisión de Arquitectura |
| :--- | :--- | :--- | :--- | :--- |
| **A. Modo Bypass UI / Zero-Overhead Live** | MidiView | **Muy Alto (Crítico para show en vivo)**. Evita jank y sobrecarga de CPU/EventLoop durante ejecuciones críticas. | Baja (Implementación limpia en Node.js y WebSocket). | **Incorporar de inmediato (Fase 5)** |
| **B. Matriz de Ruteo Asimétrico & Loop Prevention** | MIDI Split | **Muy Alto**. Permite bifurcar hacia múltiples programas (ej. DAW + Motor de Luces/Visuales) garantizando que solo una app envíe feedback al hardware físico. | Media (Añadir flags de enrutamiento direccional en `src/router.js` y `src/processor.js`). | **Incorporar como núcleo de ruteo (Fase 6)** |
| **C. Capas Shift con `StateCache` de Feedback** | MidiShift | **Alto**. Multiplica la superficie física (Toggle / Flash) manteniendo en memoria el estado de los LEDs para sincronizar el controlador al instante al conmutar capa. | Media-Alta (Requiere interceptar respuestas MIDI In/Out y mapeo condicional por capa). | **Incorporar como módulo de expansión (Fase 7)** |
| **D. Creación Nativa de Puertos Virtuales (Virtual Loopback)** | MidiView / MIDI Split | **Estratégico pero dependiente del OS**. En Windows requiere drivers de kernel de terceros (ej. loopMIDI / teevid) o binding nativo en Rust/Tauri (`midir-virtual`). | Alta en Windows puro / Media si se delega a Tauri o loopMIDI. | **Fase de aislamiento y abstracción (Fase 8)** |

---

## 3. Plan Secuencial por Fases con Compuertas Binarias (*Gates*)

Siguiendo la metodología estricta de `project-architect`, cada fase cuenta con una compuerta (*Gate*) verificable y medible mediante scripts automatizados:

```text
[Fase 5: Modo Bypass UI & Telemetría en Caliente]
   └── Objetivo: Desacoplar el loop de audio/MIDI del frontend visual.
   └── Gate 5: Jitter < 0.2ms con UI silenciada bajo ráfaga de 2000 msgs.
        │
[Fase 6: Ruteo Asimétrico & Aislamiento de Retorno]
   └── Objetivo: Matriz In/Out independiente para prevenir bucles de feedback.
   └── Gate 6: Verificación de bloqueo de retorno en canal secundario sin fuga hacia HW.
        │
[Fase 7: Motor Shift & Memoria de Estado de LEDs (StateCache)]
   └── Objetivo: Capas Toggle/Flash y refresco instantáneo de estado de pads/luces.
   └── Gate 7: Conmutación de capa con re-emisión completa de colores en < 2ms.
        │
[Fase 8: Integración de Puertos Virtuales / Virtual Proxy]
   └── Objetivo: Abstracción de puertos virtuales multiplataforma (Windows/macOS/Linux).
   └── Gate 8: DAW externo recibe y envía a través del puerto virtual proxy sin acceso exclusivo al HW.
```

---

### Fase 5: Modo Rendimiento (Bypass UI / Zero-Overhead)
* **Objetivo:** Permitir que el motor de `midiControl` desactive en caliente la serialización y el despacho de telemetría a WebSockets/UI sin interrumpir el flujo MIDI/OSC en tiempo real.
* **Componentes afectados:** `src/monitor.js`, `src/server.js`, `dist/index.html`.
* **Criterio de aprobación (Gate 5 - Binario):**
  - Script automatizado `test_fase5_bypass.js` enviando 2000 eventos a 500 msgs/segundo.
  - Al activar `bypass: true` vía comando o toggle, el consumo de memoria en la cola del monitor debe permanecer en 0 bytes y la latencia media de reenvío debe ser < 0.5 ms con jitter < 0.2 ms.

### Fase 6: Matriz de Ruteo Asimétrico y Prevención de Bucles
* **Objetivo:** Extender `src/processor.js` y `src/router.js` para admitir múltiples destinos lógicos con control direccional estricto:
  - Destino A (ej. DAW): Habilitado `In` (Hardware -> DAW) y `Out` (DAW -> Hardware).
  - Destino B (ej. Visuales / Resolume): Habilitado `In` (Hardware -> Visuales) pero **deshabilitado `Out` (Visuales no pueden enviar mensajes hacia el Hardware)**.
* **Componentes afectados:** `src/processor.js`, `src/router.js`.
* **Criterio de aprobación (Gate 6 - Binario):**
  - Script `test_fase6_routing.js` inyectando mensajes simultáneos desde Destino A y Destino B.
  - Confirmación estricta de que el hardware recibe los eventos de A, pero el 100% de los intentos de retroalimentación provenientes de B son descartados sin generar bucle ni colisión.

### Fase 7: Motor de Capas Shift con `StateCache` (Feedback de LEDs)
* **Objetivo:** Dotar a `midiControl` de una capa modificadora configurable (*Shift*):
  - Detección automática por *MIDI Learn* del botón Shift.
  - Soporte de modos **Toggle** (conmutación) y **Flash** (momentáneo).
  - Almacén de estado en memoria (`StateCache[layer] = Map<controlId, lastValue>`) que guarde los últimos mensajes de feedback recibidos.
  - Al cambiar de capa, disparo en ráfaga de los mensajes guardados de esa capa hacia el hardware físico para restaurar el mapa lumínico.
* **Componentes afectados:** `src/shift_engine.js` (nuevo módulo), `src/processor.js`.
* **Criterio de aprobación (Gate 7 - Binario):**
  - Script `test_fase7_shift.js` simulando un controlador APC o Launchpad.
  - Validación de que al alternar de Capa 1 a Capa 2, se envían exactamente los comandos SysEx/NoteOn de color correspondientes a la Capa 2 en menos de 2 milisegundos.

### Fase 8: Abstracción de Puertos Virtuales (Virtual Loopback Proxy)
* **Objetivo:** Evaluar la mejor estrategia de puertos virtuales según la plataforma:
  - En Windows: Integración y documentación con `loopMIDI` o driver virtual nativo a través de Tauri (Rust `midir` virtual).
  - En Linux/macOS: Creación de puertos virtuales nativos del kernel (ALSA / CoreMIDI).
* **Criterio de aprobación (Gate 8 - Binario):**
  - Un DAW externo (Reaper/Ableton/Resolume) abre el puerto virtual de `midiControl` mientras el hardware físico sigue bajo control del motor Node/Tauri, sin errores de `MIDI device already in use`.

---

## 4. Próximo Paso Recomendado

Con este plan estructurado y RDD en modo High activo, estamos listos para decidir por dónde arrancar. La recomendación técnica arquitectónica es:

1. **Iniciar por la Fase 5 (Bypass UI / Zero-Overhead):** Es de muy bajo riesgo, fortalece inmediatamente la estabilidad en vivo del proyecto y prepara el monitor para las fases subsiguientes.
2. O bien, **Iniciar por la Fase 6 (Matriz de Ruteo Asimétrico):** Si tu prioridad actual es conectar múltiples programas a la vez sin colisiones.
