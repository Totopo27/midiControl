# MIDI Control: Universal Live Sentinel Bridge (MIDI & OSC)

> **Estación Universal de Interconexión, Ruteo Matricial y Monitoreo en Tiempo Real para Conciertos en Vivo y Estudio**  
> *Soporte simultáneo para Controladores Físicos y Tablets (iPad vía cable USB / Wi-Fi), Salida MIDI 1.0 estándar hacia Sintetizadores de Hardware (Analógicos, Modulares, Eurorack) y Datagramas UDP OSC hacia Software Creativo (SuperCollider, Max/MSP).*

---

## 🚀 Características Principales

- **Bifurcación Paralela de Latencia Cero:** Envío simultáneo a puertos físicos MIDI DIN/USB y sockets UDP OSC con latencia media de **~142 µs** y pico máximo inferior a 1.2 ms.
- **Protección Anti-Stuck Notes (Cero Notas Pegadas):** Mapeo estricto del ciclo Note-On / Note-Off con registro de notas activas en memoria (`activeNotesMap`).
- **Botón de Pánico Universal (`All Notes Off`):** Apagado instantáneo de notas activas y envío de controladores CC 123 y CC 120 en los 16 canales ante cualquier emergencia en vivo.
- **Dashboard Web de Telemetría en Tiempo Real:** Monitor visual de alto contraste accesible en red local (`http://localhost:3000` o desde iPad) con tasa de refresco no bloqueante vía WebSocket (`:8081`).
- **Agnóstico al Hardware:** Funciona de forma transparente con interfaces USB-MIDI estándar, módulos eurorack cuantizadores (ej. Tubbutec µTune) y sintetizadores externos.

---

## 📐 Arquitectura del Sistema

```text
 ┌────────────────────────────────────────────────────────┐
 │            CAPA 1: CONTROLADORES / ENTRADAS            │
 │  - Tablets / iPad (Cable USB con red local o Wi-Fi)    │
 │  - Teclados e interfaces web (Hexgrid, TouchOSC)       │
 │  - Controladores MIDI físicos                          │
 └───────────────────────────┬────────────────────────────┘
                             │ WebSockets / MIDI IN / OSC
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │        CAPA 2 & 3: INGESTA, RUTEO Y BIFURCACIÓN        │
 │  - StreamProcessor: Despacho asíncrono no bloqueante   │
 │  - MidiRouter: Salida física estándar (0-127, Ch 1-16) │
 │  - Encoder OSC 1.0: Datagramas UDP directos            │
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
 │  - Dashboard Web & Consola de telemetría               │
 │  - Control de Pánico (All Notes Off)                   │
 └────────────────────────────────────────────────────────┘
```

---

## 🛠️ Instalación y Uso

### 1. Requisitos
- **Node.js:** v18 o superior (validado en Node.js v24 sobre Windows y macOS).
- **Interfaz MIDI:** Cualquier interfaz USB-MIDI o puerto DIN reconocido por el sistema operativo.

### 2. Instalación
```bash
git clone https://github.com/Totopo27/midiControl.git
cd midiControl
npm install
```

### 3. Ejecución de Tests con Compuertas (Gates 0 a 4)
Para certificar el entorno y la latencia antes de un concierto:
```bash
npm test
```

### 4. Puesta en Marcha en Vivo
```bash
npm start
```

Al iniciar la estación:
- Se conectará automáticamente al puerto MIDI físico disponible (ej. `USB2.0-MIDI`).
- Levantará el **Dashboard de Monitoreo** en `http://localhost:3000`.
- Abrirá el socket WebSocket en el puerto `8081` para recibir eventos de tus controladores.
- Enviará datagramas OSC a `127.0.0.1:57120` (SuperCollider) de forma transparente.

---

## 📋 Validación de Calidad (Metodología de Compuertas)

El sistema fue desarrollado bajo una metodología estricta de 5 compuertas de validación (*Gates*):

| Fase | Compuerta | Verificación Técnica | Estado |
| :--- | :--- | :--- | :---: |
| **Fase 0** | Gate 0: Auditoría | Detección de interfaces MIDI físicas y sockets UDP sin bloqueos de red. | **PASS** ✅ |
| **Fase 1** | Gate 1: MIDI Out | Note-On/Off estándar byte a byte con canal seleccionable (1-16). | **PASS** ✅ |
| **Fase 2** | Gate 2: Concurrencia | 200 eventos concurrentes: MIDI + OSC simultáneos con latencia media de 142 µs. | **PASS** ✅ |
| **Fase 3** | Gate 3: Live Monitor | Telemetría en tiempo real y comando de pánico (*All Notes Off*) verificado. | **PASS** ✅ |
| **Fase 4** | Gate 4: Estrés Directo | Ráfaga de 1000 eventos (500 notas en 5 octavas): 0% pérdida, 0 notas pegadas. | **PASS** ✅ |

---

## 📄 Licencia
ISC License.
