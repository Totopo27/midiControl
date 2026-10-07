# Plan de arquitectura y fases de validación técnica

Documento de referencia para el diseño, las fases de desarrollo y los criterios de aceptación del puente MIDI y OSC para presentaciones en vivo y trabajo en estudio.

---

## 1. Arquitectura del sistema

El objetivo del software es funcionar como un intermediario entre controladores táctiles o de red y los dispositivos receptores (hardware analógico, sintetizadores modulares y motores de síntesis por software), garantizando entrega concurrente con baja latencia y sin bloqueo del bucle de eventos.

```text
 Capa 1: Entradas y controladores
 - Tablets o iPads (conexión por cable USB con red local o Wi-Fi)
 - Interfaces web interactivas (Hexgrid, teclados Wilson microtonales, TouchOSC)
 - Controladores físicos entrantes por puerto MIDI In
          │
          │ WebSockets (puerto 8081) / UDP / MIDI In
          ▼
 Capa 2: Ingesta y transporte
 - Servidor de red asíncrono en Node.js
 - Validación de formato de paquetes y asignación de marcas de tiempo
 - Cola de procesamiento inmediato sin buffer bloqueante
          │
          ▼
 Capa 3: Ruteo y bifurcación
 - Selección y filtrado por canal MIDI (1 a 16)
 - Registro de notas activas en memoria para prevenir notas colgadas
 - Despacho concurrente e independiente hacia ambas ramas de salida
          │
          ├── Rama A (MIDI físico)
          │   └── Puerto MIDI Out (USB / DIN-5) -> Sintetizadores, módulos Eurorack (µTune)
          │
          └── Rama B (OSC sobre UDP)
              └── Datagramas binarios hacia SuperCollider (57120), Max/MSP (8000) o DAWs
          │
          ▼
 Capa 4: Monitoreo y telemetría
 - Inspección de tráfico en vivo (origen, destino, nota, velocidad, canal, latencia)
 - Servidor HTTP local con panel visual (puerto 3000)
 - Comando de pánico global (All Notes Off en los 16 canales)
```

---

## 2. Organización modular del proyecto

El desarrollo se organiza en módulos de responsabilidad delimitada:

| Módulo | Archivos principales | Responsabilidad |
| :--- | :--- | :--- |
| **Ruteo de hardware** | `src/router.js` | Detección de puertos MIDI físicos mediante `jzz`, apertura de interfaz de salida y manejo de reconexión. |
| **Procesador de flujo** | `src/processor.js` | Recepción de eventos, bifurcación paralela (MIDI y OSC), seguimiento de notas activas (`activeNotesMap`) y ejecución del corte de pánico. |
| **Transporte OSC** | `src/osc.js` | Codificación binaria manual de mensajes OSC 1.0 según la especificación y envío por socket UDP nativo (`dgram`). |
| **Monitor y telemetría** | `src/monitor.js`, `dist/index.html` | Registro circular de eventos en memoria, cálculo de estadísticas de latencia y emisión por WebSocket hacia la interfaz gráfica. |
| **Servidor principal** | `src/server.js`, `src/app.js` | Orquestación de servicios, servidor HTTP en puerto 3000 y servidor WebSocket en puerto 8081. |

---

## 3. Fases de validación secuencial

Cada fase del desarrollo cuenta con una compuerta técnica de validación con criterios observables antes de dar por cerrada la etapa.

```text
Fase 0: Auditoría de interfaces
  └── Detección de puertos MIDI físicos y disponibilidad de sockets UDP.
       │
Fase 1: Emisión MIDI física básica
  └── Note-On y Note-Off estándar por cable DIN/USB en canal configurable.
       │
Fase 2: Concurrencia paralela (MIDI + OSC)
  └── Despacho simultáneo a hardware y a SuperCollider sin retraso mutuo.
       │
Fase 3: Monitor de inspección y pánico
  └── Visualización en tiempo real y corte instantáneo de notas colgadas.
       │
Fase 4: Prueba de estrés y estabilidad
  └── Ráfagas continuas de notas y desconexión/reconexión en caliente.
```

---

### Fase 0: Auditoría de interfaces y entorno
- **Objetivo:** Comprobar que el entorno de ejecución tenga acceso a los subsistemas MIDI del sistema operativo (WinMM en Windows, CoreMIDI en macOS) y a la pila de red UDP sin restricciones de firewall local.
- **Tareas:**
  1. Instalar y evaluar la librería `jzz` en el entorno Node.js.
  2. Ejecutar script de descubrimiento (`diagnostico_fase0.js`) para listar puertos MIDI IN y OUT.
  3. Verificar disponibilidad de puertos de red locales para OSC (57120, 8000).
- **Criterio de aprobación (Gate 0):** Salida por terminal con la lista completa de interfaces físicas detectadas y confirmación de socket UDP abierto para transmisión.

---

### Fase 1: Ingesta y disparo de notas MIDI estándar
- **Objetivo:** Recibir un evento de nota (desde un cliente web o socket) y emitir los bytes MIDI 1.0 estándar hacia el puerto físico seleccionado.
- **Tareas:**
  1. Conectar la recepción de eventos con el canal MIDI configurado (1 a 16).
  2. Implementar despacho estricto de Note-On (`0x90 | canal`, nota, velocidad) y Note-Off (`0x80 | canal`, nota, 0).
  3. Comprobar que un sintetizador físico o módulo receptor responda de inmediato ante cada mensaje.
- **Criterio de aprobación (Gate 1):** Script de prueba (`test_fase1.js`) ejecutando secuencias de notas con confirmación de recepción en el hardware y latencia de despacho inferior a 5 milisegundos.

---

### Fase 2: Concurrencia paralela (MIDI físico + OSC)
- **Objetivo:** Garantizar que el envío de datagramas UDP a software local (SuperCollider, Max) y el envío a la interfaz física ocurran en paralelo sin que una rama retrase a la otra.
- **Tareas:**
  1. Implementar la bifurcación asíncrona en `src/processor.js`.
  2. Construir el codificador de datagramas OSC sin dependencias pesadas en `src/osc.js`.
  3. Medir marcas de tiempo de despacho en ambas ramas.
- **Criterio de aprobación (Gate 2):** Prueba de concurrencia (`test_fase2.js`) con 200 eventos simultáneos arrojando una latencia media inferior a 1 ms en ambas salidas combinadas.

---

### Fase 3: Monitor de tráfico y comando de pánico
- **Objetivo:** Proveer una herramienta de inspección visual para verificar el flujo de datos y reaccionar ante imprevistos durante un ensayo o concierto.
- **Tareas:**
  1. Conectar el observador de eventos para registrar: timestamp, canal, tipo de mensaje, nota/CC, velocidad y destino.
  2. Implementar rutina de pánico: envío de Note-Off para todas las notas activas registradas en memoria, seguido de CC 123 (All Notes Off) y CC 120 (All Sound Off) en los 16 canales.
  3. Servir el panel web en el puerto 3000 con conexión WebSocket para telemetría continua.
- **Criterio de aprobación (Gate 3):** Prueba automatizada (`test_fase3.js`) validando la ingesta de telemetría y el vaciado completo del registro de notas activas tras activar el botón de pánico.

---

### Fase 4: Prueba de estrés y estabilidad operativa
- **Objetivo:** Certificar la estabilidad del puente bajo condiciones de carga continua similares o superiores a las de una interpretación en vivo exigente.
- **Tareas:**
  1. Ejecutar ráfaga de 1000 eventos distribuidos en varias octavas a alta velocidad (`test_fase4.js`).
  2. Evaluar el estado de la memoria para descartar fugas o retención de notas no liberadas.
  3. Probar la ejecución integrada de extremo a extremo (`test_integration_e2e.js`).
- **Criterio de aprobación (Gate 4):** 100% de eventos procesados, 0% de pérdida de paquetes, registro `activeNotesMap` vacío al concluir la prueba y cero excepciones no capturadas.

---

### Fase 5: Modo Rendimiento (Bypass UI / Zero-Overhead Live)
- **Objetivo:** Desacoplar en caliente la serialización y el streaming de telemetría hacia WebSockets y consola sin detener ni interferir en el transporte de notas en tiempo real (patrón inspirado en MidiView).
- **Tareas:**
  1. Incorporar `isBypass` y `setBypass()` en `src/monitor.js` y `src/app.js`.
  2. Integrar botón interactivo y sincronización de estado en el panel web (`midi_monitor.html`).
  3. Diseñar compuerta automatizada con prueba de ráfaga de 1000 eventos bajo bypass (`test_fase5_bypass.js`).
- **Criterio de aprobación (Gate 5):** 0 eventos de telemetría transmitidos por WebSocket mientras el modo bypass está activo, 100% de los paquetes entregados intactos a los destinos de audio/OSC, y reanudación limpia en caliente sin fugas.

---

### Fase 6: Matriz de Ruteo Asimétrico y Prevención de Bucles (MIDI Split)
- **Objetivo:** Implementar una matriz direccional de enrutamiento con permisos `allowIn` / `allowOut` independientes por origen y destino para evitar bucles de retroalimentación (*feedback loops*) al conectar múltiples aplicaciones concurrentes.
- **Tareas:**
  1. Añadir `routingMatrix`, `setRoutePermission()` y `isRouteAllowed()` en `src/router.js`.
  2. Conectar las compuertas de despacho en `src/processor.js` tanto para el bus físico como para la rama OSC.
  3. Habilitar sincronización y conmutación de permisos en caliente vía WebSockets (`set_routing`) en `src/app.js`.
- **Criterio de aprobación (Gate 6):** Script automatizado (`test_fase6_routing.js`) confirmando que el retorno de apps autorizadas (App A) llega al hardware, mientras que el retorno de apps no autorizadas (App B) es bloqueado al 100% sin generar colisión ni fuga, con reconfiguración dinámica en caliente y aislamiento independiente para la rama OSC.

---

### Fase 7: Motor Shift & Memoria de Estado de LEDs (StateCache)
- **Objetivo:** Conmutación de capas físicas de control (*Shift*) con modos Toggle (conmutado) y Flash (momentáneo), soporte de *MIDI Learn*, y memoria de estado de LEDs (`StateCache`) con re-emisión instantánea (<2 ms) al alternar entre capas.
- **Tareas:**
  1. Diseñar el módulo `src/shift_engine.js` con soporte multicapa, modos de activación e inspección de ráfaga.
  2. Integrar el motor Shift en `src/processor.js` para intercepción de entradas y despacho del buffer lumínico hacia el hardware físico.
  3. Construir la compuerta automatizada de validación (`test_fase7_shift.js`) midiendo latencia de volcado y preservación de estado en 64 controles.
- **Criterio de aprobación (Gate 7):** Volcado completo del buffer de estados (64 pads simulados) en menos de 2 ms hacia el hardware, funcionamiento riguroso de modos Toggle y Flash, y captura precisa vía MIDI Learn sin fugas de notas.

---

### Fase 7: Motor Shift & Memoria de Estado de LEDs (StateCache - MidiShift)
- **Objetivo:** Conmutación dinámica de capas físicas (Toggle / Flash) con memoria de estado bidireccional (`StateCache`) para re-emitir en ráfaga el mapa lumínico de LEDs al hardware en menos de 2 ms al cambiar de capa.
- **Tareas:**
  1. Implementar `src/shift_engine.js` con soporte para modos `flash`, `toggle`, `midiLearn` y `StateCache` indexado por capa.
  2. Integrar el motor de capas con el despacho de hardware y telemetría en `src/processor.js` y `src/app.js`.
  3. Validar con prueba de estrés (`test_fase7_shift.js`) con 64 controles por capa demostrando volcado de estado ultrarrápido (< 2 ms).
- **Criterio de aprobación (Gate 7):** Volcado completo del buffer de LEDs ejecutado en menos de 2 milisegundos con cero pérdida de paquetes y asignación por MIDI Learn certificada.
