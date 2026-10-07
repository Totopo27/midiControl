# midiControl

Puente de baja latencia para control musical en vivo. Recibe eventos desde interfaces táctiles, teclados web o controladores USB (vía WebSockets y MIDI In) y los bifurca en paralelo hacia sintetizadores físicos por MIDI DIN/USB y hacia entornos de audio digital (SuperCollider, Max/MSP, Pure Data) mediante datagramas UDP OSC.

---

## Qué resuelve este sistema

Al tocar en vivo con interfaces táctiles o controladores experimentales (como teclados microtonales Wilson o grillas Hexgrid en iPad), el setup suele romperse por tres frentes:

1. **Colisiones de drivers en Windows (WinMM):** Si un DAW (Ableton, Reaper) abre un puerto MIDI USB físico, ninguna otra aplicación puede tocarlo sin arrojar un error de dispositivo ocupado.
2. **Notas colgadas (*stuck notes*):** Un paquete de red perdido o un corte de Wi-Fi deja notas sonando indefinidamente en sintetizadores modulares analógicos o en patches polifónicos.
3. **Bucle de retroalimentación (*feedback loop*):** Si envías notas a un software de visuales (Resolume) y este devuelve datos por MIDI Out, el hardware entra en un ciclo de disparo infinito que satura el bus.

`midiControl` corre como un proceso único en Node.js que actúa de intermediario maestro: multiplexa el hardware físico, levanta un puerto virtual transparente para el DAW, aísla retornos con una matriz anti-bucle, y ofrece telemetría en tiempo real con botón de pánico físico y por software.

---

## Arquitectura y características técnicas

- **Bifurcación paralela determinista:** Despacho simultáneo a la capa MIDI del sistema operativo (`jzz` sobre WinMM/CoreMIDI/ALSA) y a sockets UDP OSC (`dgram`). En pruebas de estrés con 200 eventos concurrentes, la latencia media se mantiene en **~160 microsegundos** (pico máximo bajo 1.9 ms).
- **Virtual Loopback Proxy (Fase 8):** Expone puertos virtuales (`midiControl Virtual IN` / `OUT` vía loopMIDI o puente software). Ableton o Reaper se conectan al proxy sin bloquear la interfaz física USB/DIN, permitiendo tocar el hardware analógico y grabar el MIDI en la pista del DAW a la vez.
- **Ruteo asimétrico y matriz anti-bucle (Fase 6):** Filtro direccional por aplicación. Permite que la app principal reciba y devuelva notas, mientras silencia el retorno de aplicaciones secundarias para evitar bucles.
- **Motor Shift con StateCache (Fase 7):** Alterna capas de interpretación (Flash o Toggle) y vuelca el estado lumínico completo de 64 pads en **15 microsegundos**, muy por debajo del umbral perceptible en escenario (límite crítico: 2 ms).
- **Modo Rendimiento (Bypass Zero-Overhead):** Silencia por completo la emisión de telemetría hacia el navegador durante pasajes de alta densidad polifónica, manteniendo el procesamiento de notas y OSC intacto.
- **Rastreo de notas activas y pánico:** Mapa en memoria de cada par Note-On / Note-Off. El botón Panic corta todas las voces registradas y dispara mensajes CC 123 (All Notes Off) y CC 120 (All Sound Off) en los 16 canales MIDI en menos de 1 milisegundo.

---

## Interfaz de Monitoreo y Mapeo Web

El servidor levanta dos herramientas web servidas localmente por HTTP (puerto 3000) y alimentadas por WebSocket bidireccional (puerto 8081):

### 1. Monitor Principal (`http://localhost:3000/`)
- **Pestaña MIDI Monitor:** Inspección detallada de eventos de hardware entrantes y salientes (tiempo en microsegundos, canal, nota/CC, velocidad, valor hex y origen).
- **Pestaña OSC Monitor:** Registro de datagramas UDP enviados hacia SuperCollider o Max.
- **Pestaña Vista Dual:** Monitoreo simultáneo lado a lado de flujos MIDI y OSC en columnas paralelas.
- **Pestaña Mapping Matrix & Learn:** Matriz de reglas configurables (disparadores por umbral, CC o notas) con inspector lateral, captura de teclado físico (*Shortcut Learn*) y escucha activa de hardware (*MIDI Learn*). Permanece oculta por defecto para no consumir ciclos de CPU durante conciertos.
- **Reconexión automática:** Si el servidor centinela se reinicia durante un ensayo, el frontend reintenta el enlace WebSocket cada 2 segundos sin requerir refrescar la página manualmente.

### 2. MidiShortcut Studio (`http://localhost:3000/midi_shortcut_studio.html`)
Entorno de escritorio enfocado en mapeo y gestión de hardware. Detecta inventario de puertos físicos y virtuales en tiempo real, permite seleccionar el controlador de entrada activo y enlazar atajos de teclado del sistema operativo directamente a notas o faders físicos.

---

## Flujo de datos

```text
 Controladores e interfaces táctiles
 ├── iPad / Tablet (TouchOSC, Wilson microtonal vía WebSockets 8081)
 ├── Teclados web y grillas matriciales
 └── Controladores físicos (USB-MIDI / DIN-5)
          │
          ▼
 midiControl (Node.js)
 ├── StreamProcessor: normalización, filtrado de eventos de sistema y StateCache
 ├── ShiftEngine: conmutación de capas (Flash/Toggle)
 ├── RoutingMatrix: control de flujo direccional y corte de bucles
 ├── VirtualProxy: intermediación bidireccional hacia DAWs externos
 ├── MidiRouter: despacho físico USB/DIN (WinMM / CoreMIDI)
 └── OSCRouter: codificación binaria de datagramas OSC 1.0
          │
          ├──► Hardware analógico / Eurorack (USB2.0-MIDI, convertidores DIN)
          ├──► DAW externo (Ableton Live, Reaper vía midiControl Virtual Bus)
          ├──► Síntesis digital (UDP 127.0.0.1:57120 -> SuperCollider / Max/MSP)
          └──► Telemetría web (WebSocket 8081 -> http://localhost:3000)
```

---

## Requisitos del sistema

- **Node.js:** Versión 18 o superior (validado en v20 y v24 en Windows y macOS).
- **Controlador MIDI:** Cualquier interfaz USB-MIDI clase complaciente, módulo MIDI-CV o cable USB-DIN.
- **Puertos de red libres:**
  - UDP `57120` (destino de datagramas OSC hacia SuperCollider).
  - TCP `3000` (servidor HTTP para los paneles web).
  - TCP `8081` (puerto de telemetría y control WebSocket).

---

## Puesta en marcha

### 1. Instalación de dependencias

```bash
git clone https://github.com/Totopo27/midiControl.git
cd midiControl
npm install
```

### 2. Batería de pruebas y compuertas técnicas

Antes de tocar en vivo, ejecuta las 9 compuertas automatizadas para comprobar latencias de hardware, ausencia de notas colgadas y aislamiento de drivers:

```bash
npm test
```

### 3. Iniciar la estación

```bash
npm start
```

La consola confirmará la apertura de la interfaz MIDI física detectada, el socket de telemetría y los enlaces web:
- Dashboard de monitoreo: `http://localhost:3000`
- Estudio de shortcuts y mapeo: `http://localhost:3000/midi_shortcut_studio.html`
- Conexión WebSocket: `ws://localhost:8081`

---

## Resultados de las Compuertas Técnicas (Gates 1 al 8 + E2E)

| Compuerta | Módulo evaluado | Criterio de aceptación | Medición obtenida | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Gate 1** | Emisión MIDI estándar | Note-On/Off byte a byte y canal seleccionable | Bytes hex conformes en hardware físico | **PASS** |
| **Gate 2** | Concurrencia MIDI + OSC | 200 eventos simultáneos; latencia media < 1.0 ms | Avg: 0.161 ms / Max: 1.94 ms | **PASS** |
| **Gate 3** | Telemetría & Pánico | Transmisión WS sin bloqueo y corte All Notes Off | Telemetría en microsegundos y corte instantáneo | **PASS** |
| **Gate 4** | Estrés y anti-stuck | 1000 eventos (500 notas en 5 octavas); 0 notas colgadas | 1000/1000 entregados; 0 notas colgadas | **PASS** |
| **Gate 5** | Modo Bypass Rendimiento | Supresión total de telemetría bajo ráfaga masiva | 0 eventos WS filtrados; 100% OSC entregado | **PASS** |
| **Gate 6** | Ruteo Asimétrico Split | Aislamiento estricto de retorno por app para evitar bucles | Bloqueo verificado de canal de retorno no autorizado | **PASS** |
| **Gate 7** | Motor Shift & StateCache | Volcado completo de 64 pads en memoria; límite < 2.0 ms | Tiempo de volcado: 0.015 ms (14.6 µs) | **PASS** |
| **Gate 8** | Virtual Loopback Proxy | Intermediación bidireccional DAW <-> Hardware sin colisión | Flujo bidireccional 100% íntegro; 0 notas pegadas | **PASS** |
| **E2E** | Integración Teclados-Wilson | Flujo completo WebSocket iPad -> midiControl -> Hardware/OSC | Acordes EDO-53 procesados sin latencia | **PASS** |

---

## Licencia

ISC.
