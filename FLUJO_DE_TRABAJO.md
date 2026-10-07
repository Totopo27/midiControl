# Sistema Universal de Puente y Monitoreo MIDI/OSC en Tiempo Real

> **Plan de Arquitectura y Flujo de Trabajo Técnico (Gated Execution)**  
> *Interconexión universal de controladores (iPad, hardware, aplicaciones web), ruteo matricial paralelo a puertos físicos MIDI DIN/USB, sockets OSC para software de audio (SuperCollider, Max MSP), monitoreo en vivo y compatibilidad con sintetizadores de hardware (analógicos, modulares, eurorack, digitales).*

---

## 1. Visión General y Filosofía de Arquitectura

El sistema es una **estación universal de interconexión y monitoreo en vivo**. No depende de ningún sintetizador, marca o controlador en particular: actúa como una tubería transparente, ultrarrápida y de alta fidelidad para músicos e intérpretes en vivo.

```text
 ┌────────────────────────────────────────────────────────┐
 │            CAPA 1: CONTROLADORES / ENTRADAS            │
 │  - Tablets / iPad (Cable USB con red local o Wi-Fi)    │
 │  - Teclados e interfaces (Hexgrid, TouchOSC, WebApps)  │
 │  - Hardware físico entrante (Controladores MIDI, etc.) │
 └───────────────────────────┬────────────────────────────┘
                             │ WebSockets / MIDI IN / OSC
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │            CAPA 2: INGESTA Y TRANSPORTE                │
 │  - Servidor de red no bloqueante (Node.js / Python)    │
 │  - Sockets UDP asíncronos para OSC                     │
 │  - Cola de eventos thread-safe con latencia <1 ms      │
 └───────────────────────────┬────────────────────────────┘
                             │ Flujo de eventos continuo
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │        CAPA 3: NÚCLEO DE RUTEO Y BIFURCACIÓN           │
 │  - Selector de Canal MIDI (1-16)                       │
 │  - Mapeo de notas y parámetros                         │
 │  - Registro de notas activas (anti-stuck notes)        │
 │  - Despacho simultáneo sin interferencia mutua         │
 └─────────────┬────────────────────────────┬─────────────┘
               │ Rama A: MIDI Físico        │ Rama B: OSC UDP
               ▼                            ▼
 ┌───────────────────────────┐ ┌──────────────────────────┐
 │ PUERTO MIDI FÍSICO OUT    │ │ PUERTO OSC / RED         │
 │ - Interfaz USB / DIN-5    │ │ - SuperCollider (57120)  │
 │ - Módulos Eurorack / CV   │ │ - Max/MSP (8000)         │
 │ - Sintes Analógicos / HW  │ │ - DAWs / VST Hosts       │
 └─────────────┬─────────────┘ └────────────┬─────────────┘
               │                            │
               └──────────────┬─────────────┘
                              │
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │      CAPA 4: MONITOR DE TRÁFICO EN TIEMPO REAL         │
 │  - Inspección en vivo de entradas y salidas            │
 │  - Timestamp, Canal, Tipo, Nota/CC, Valor y Destino    │
 │  - Panel de pánico accesible (All Notes Off)           │
 └────────────────────────────────────────────────────────┘
```

---

## 2. Ecosistema de Skills Modulares del Proyecto

Ubicación: `.opencode/skills/`

| Skill | Ubicación | Rol y Responsabilidad |
| :--- | :--- | :--- |
| **`midi-hardware-router`** | `.opencode/skills/midi-hardware-router/` | Detección y apertura de interfaces físicas MIDI (USB, DIN-5), transporte de red/cable para iPad (IDAM, rtpMIDI) y sockets UDP OSC con tolerancia a desconexión en vivo. |
| **`midi-stream-processor`** | `.opencode/skills/midi-stream-processor/` | Tubería central de baja latencia (<2 ms): ruteo matricial, filtrado, bifurcación paralela (MIDI físico + OSC) y ciclo garantizado Note-On / Note-Off. |
| **`midi-live-monitor`** | `.opencode/skills/midi-live-monitor/` | Monitoreo visual de tráfico en vivo (consola TUI o panel interactivo), diagnóstico de latencia, captura de anomalías y función de pánico (*All Notes Off*). |
| **`midi-terminal-ui`** | `.opencode/skills/midi-terminal-ui/` | Constructor de interfaces de terminal avanzadas (Textual/Rich) con medidores de CC y visualización desacoplada sin frenar el flujo de datos. |
| **`midi-tauri-architect`** | `.opencode/skills/midi-tauri-architect/` | Arquitectura de empaquetado final nativo en Tauri (Rust + Web) para aplicaciones de escritorio de alto rendimiento. |

---

## 3. Flujo de Trabajo Secuencial con Compuertas de Validación (*Gates*)

```text
[FASE 0] Auditoría & Enumeración de Interfaces ──► Gate 0: Puertos físicos detectados y sockets UDP listos
   │
   ▼
[FASE 1] Ingesta y Disparo MIDI Estándar       ──► Gate 1: Note-On y Note-Off emitidos por DIN con canal configurable
   │
   ▼
[FASE 2] Concurrencia Paralela (MIDI + OSC)    ──► Gate 2: Salida física + SuperCollider simultáneos sin latencia
   │
   ▼
[FASE 3] Monitor de Inspección en Vivo         ──► Gate 3: Visualización de eventos en tiempo real con botón de pánico
   │
   ▼
[FASE 4] Prueba de Confiabilidad y Estrés      ──► Gate 4: Test de 15 min sin notas colgadas y reconexión en caliente
```

---

### Fase 0: Auditoría y Enumeración de Interfaces
* **Skill Encargada:** `midi-hardware-router`.
* **Objetivo:** Verificar que el entorno host (Node.js o Python) tenga acceso directo a las interfaces MIDI del sistema operativo (WinMM en Windows, CoreMIDI en macOS) y a la pila de red UDP.
* **Actividades:**
  1. Instalar y validar la librería MIDI multiplataforma (`jzz` en Node.js o `python-rtmidi` en Python).
  2. Ejecutar script de descubrimiento para listar todos los puertos MIDI IN y OUT disponibles en la máquina.
  3. Verificar disponibilidad de puertos de red locales para OSC (57120, 8000).
* **Compuerta de Salida (Gate 0):** Script ejecutado que imprime en consola la lista completa de interfaces MIDI físicas conectadas y confirma que el socket UDP está listo para enviar.

---

### Fase 1: Ingesta y Disparo de Notas MIDI Estándar
* **Skill Encargada:** `midi-hardware-router` + `midi-stream-processor`.
* **Objetivo:** Recibir un evento de nota (desde un controlador, iPad o cliente web) y emitir los bytes MIDI 1.0 estándar hacia un puerto físico DIN/USB seleccionado.
* **Actividades:**
  1. Conectar la recepción de eventos con el canal MIDI configurado por el usuario (1 al 16).
  2. Implementar despacho de Note-On (`0x90 | canal`, nota, velocidad) y Note-Off (`0x80 | canal`, nota, 0).
  3. Comprobar que cualquier sintetizador externo conectado al puerto DIN reciba y suene las notas en tiempo real.
* **Compuerta de Salida (Gate 1):** Accionar notas en el controlador y verificar recepción inmediata en el hardware receptor externo con latencia inferior a 5 ms y cero notas pegadas.

---

### Fase 2: Concurrencia Paralela (Bifurcación MIDI Físico + OSC)
* **Skill Encargada:** `midi-stream-processor`.
* **Objetivo:** Garantizar que el envío de datos OSC a software en la computadora (SuperCollider, Max) y el envío físico por cable MIDI convivan en paralelo sin interferirse.
* **Actividades:**
  1. Implementar la bifurcación asíncrona: ante un evento de nota, despachar el datagrama UDP OSC y los bytes MIDI físicos al mismo tiempo.
  2. Medir tiempos de procesamiento para confirmar que el envío por red no retrase la salida MIDI por cable ni viceversa.
* **Compuerta de Salida (Gate 2):** Sintetizador analógico por MIDI DIN y sintetizador en SuperCollider sonando al unísono ante la misma pulsación con sincronía imperceptible.

---

### Fase 3: Monitor de Inspección en Vivo y Herramienta de Pánico
* **Skill Encargada:** `midi-live-monitor`.
* **Objetivo:** Proveer una herramienta de visualización clara para monitorear el flujo de datos durante ensayos o conciertos.
* **Actividades:**
  1. Conectar el observador de eventos para desplegar en tiempo real: timestamp, canal, tipo de mensaje, nota/CC, velocidad y destino.
  2. Implementar función de pánico (*All Notes Off* en todos los canales) activable por comando o atajo.
  3. Verificar que el renderizado visual no agregue carga al bucle de audio/MIDI.
* **Compuerta de Salida (Gate 3):** Monitor activo reflejando ráfagas de notas en vivo sin saltos de cuadros y función de pánico silenciando todas las notas instantáneamente.

---

### Fase 4: Prueba de Confiabilidad y Estrés para Conciertos en Vivo
* **Skill Encargada:** `midi-hardware-router` + `midi-stream-processor`.
* **Objetivo:** Certificar la estabilidad total del sistema bajo condiciones exigentes de interpretación en vivo.
* **Actividades:**
  1. Ejecutar prueba de estrés de 15 minutos tocando acordes rápidos, glissandos y polirritmias.
  2. Simular desconexión y reconexión del cable de red o USB para validar la recuperación automática sin reiniciar el sistema.
  3. Confirmar que el consumo de memoria y CPU se mantenga plano.
* **Compuerta de Salida (Gate 4):** Cero excepciones no controladas, cero notas colgadas (*stuck notes*) y latencia constante durante toda la prueba de estrés.
