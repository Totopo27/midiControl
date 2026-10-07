# midiControl

Puente de baja latencia para control musical en vivo. Recibe eventos desde interfaces táctiles o controladores web (vía WebSockets) y los despacha simultáneamente a sintetizadores físicos por MIDI DIN/USB y a entornos de audio digital (SuperCollider, Max/MSP) mediante datagramas UDP OSC.

---

## Qué resuelve este sistema

Al tocar en vivo con interfaces experimentales (como teclados microtonales Wilson en navegadores de iPad o tablets), suele surgir la necesidad de controlar dos mundos a la vez:
1. Hardware analógico o modular (módulos Eurorack cuantizadores como el Tubbutec µTune, sintetizadores con entrada DIN-5 o USB).
2. Motores de síntesis algorítmica en la computadora (SuperCollider, Max/MSP, Pure Data).

Este puente unifica ambas salidas en un único proceso de Node.js, manteniendo las notas sincronizadas, evitando notas colgadas (*stuck notes*) y ofreciendo un monitor web de inspección en tiempo real con botón de pánico.

---

## Características técnicas

- **Bifurcación paralela:** Despacho concurrente a la interfaz MIDI del sistema operativo (WinMM en Windows, CoreMIDI en macOS vía `jzz`) y a sockets UDP OSC (vía `dgram`). En pruebas locales con 200 eventos concurrentes, la latencia media se situó en ~142 microsegundos (pico máximo bajo 1.2 ms).
- **Control de notas activas:** Mapeo en memoria de cada par Note-On / Note-Off (`activeNotesMap`) para garantizar que ninguna tecla quede sonando indefinidamente si se interrumpe la conexión o se suelta rápido una tecla táctil.
- **Función de pánico (All Notes Off):** Corte inmediato de todas las notas activas registradas y emisión de controladores de emergencia CC 123 y CC 120 en los 16 canales MIDI.
- **Monitor de tráfico en tiempo real:** Interfaz web local (`http://localhost:3000`) servida mediante Express y actualizada vía WebSocket (`puerto 8081`). Muestra marcas de tiempo en microsegundos, canal, tipo de evento, nota, velocidad y destino.
- **Compatibilidad de hardware:** Reconoce interfaces USB-MIDI estándar de clase complaciente y puertos DIN sin configuraciones propietarias.

---

## Flujo de datos

```text
 Controladores y fuentes
 ├── iPad / Tablet (cable USB o red Wi-Fi local)
 ├── Teclados web (Hexgrid, Wilson microtonal)
 └── Controladores físicos MIDI In
          │
          │ WebSockets (8081) / MIDI In
          ▼
 midiControl (Node.js)
 ├── StreamProcessor: normalización de eventos y control de estado
 ├── MidiRouter: salida MIDI 1.0 (canales 1 a 16)
 └── OSCRouter: codificación binaria de datagramas OSC 1.0
          │
          ├──► Salida física: Interfaz USB/DIN -> Sintetizadores / Eurorack
          ├──► Salida red: UDP 127.0.0.1:57120 -> SuperCollider / Max/MSP
          └──► Telemetría: WebSocket -> Monitor web (http://localhost:3000)
```

---

## Requisitos y dependencias

- **Node.js:** Versión 18 o superior (probado en Node.js v20 y v24 en Windows y macOS).
- **Interfaz MIDI:** Cualquier interfaz USB-MIDI o convertidor USB a DIN reconocido por el sistema operativo.
- **Red:** Puerto UDP 57120 libre para SuperCollider (configurable en `src/osc.js`) y puerto TCP 8081 para el servidor de WebSockets.

---

## Instalación

```bash
git clone https://github.com/Totopo27/midiControl.git
cd midiControl
npm install
```

---

## Uso

### Verificación previa (batería de pruebas)

El proyecto incluye pruebas automatizadas que miden detección de puertos, formato de bytes, concurrencia, respuesta del monitor y estrés:

```bash
npm test
```

### Ejecución del puente

```bash
npm start
```

Al arrancar:
1. Detecta y abre la primera interfaz MIDI física de salida disponible (por ejemplo, `USB2.0-MIDI` o la interfaz predeterminada del sistema).
2. Inicia el servidor HTTP del monitor en `http://localhost:3000`.
3. Abre el socket WebSocket en el puerto `8081` para recibir eventos desde el teclado web o cliente en la tablet.
4. Queda listo para emitir paquetes OSC a `127.0.0.1:57120`.

---

## Pruebas de validación

| Fase | Alcance | Verificación | Resultado |
| :--- | :--- | :--- | :--- |
| Fase 0 | Auditoría de entorno | Enumeración de interfaces MIDI físicas y comprobación de socket UDP. | PASS |
| Fase 1 | Emisión MIDI estándar | Note-On y Note-Off byte a byte con canal seleccionable (1-16). | PASS |
| Fase 2 | Concurrencia MIDI + OSC | 200 eventos simultáneos hacia hardware y red con latencia media de 142 µs. | PASS |
| Fase 3 | Monitor e inspección | Transmisión de telemetría al dashboard y comando All Notes Off. | PASS |
| Fase 4 | Prueba de estrés | Ráfaga de 1000 eventos (500 notas en 5 octavas) con 0% pérdida y 0 notas colgadas. | PASS |

---

## Licencia

ISC.
