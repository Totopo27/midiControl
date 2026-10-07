# Recursos y referencias técnicas para el puente MIDI y OSC

Documento de consulta con especificaciones de protocolos, controladores, herramientas de inspección, utilidades microtonales y librerías de soporte.

---

## 1. Monitores y herramientas de inspección

### 1.1. [gbevin/ShowMIDI](https://github.com/gbevin/ShowMIDI)
- **Descripción:** Monitor gráfico de actividad MIDI multiplataforma (Windows, macOS, Linux, iOS) escrito en C++/JUCE.
- **Utilidad:** Referencia para visualización de notas en vivo, velocidad, actividad multicanal (1-16), barras de CC y mensajes RPN/NRPN.

### 1.2. [MidiView (Haute Technique)](https://hautetechnique.com/midi/midiview/)
- **Descripción:** Monitor de eventos MIDI ligero para Windows y macOS.
- **Utilidad:** Referencia para el registro de eventos en columnas: marcas de tiempo de alta precisión, puerto de origen/destino, canal, tipo de comando (NoteOn, NoteOff, CC, PitchBend, SysEx), decodificación legible y volcado hexadecimal.

### 1.3. [arashsm79/elemidiviewer](https://github.com/arashsm79/elemidiviewer)
- **Descripción:** Analizador y visor de eventos MIDI en C con GTK.
- **Utilidad:** Referencia para la detección y visualización de mensajes malformados o fuera del estándar MIDI 1.0.

### 1.4. [pushpop/Acordes](https://github.com/pushpop/Acordes) y [mackrus/tuiano](https://github.com/mackrus/tuiano)
- **Descripción:** Aplicaciones de consola con interfaz de monitoreo y control en Python (`Textual`) y Rust (`Ratatui`).
- **Utilidad:** Referencia para interfaces de terminal con refresco no bloqueante y bajo consumo de recursos.

---

## 2. Transporte y conectividad con dispositivos móviles (iPad y red local)

### 2.1. Apple IDAM (Inter-Device Audio and MIDI)
- **Descripción:** Función nativa de macOS integrada en la utilidad *Configuración de Audio MIDI*.
- **Utilidad:** Túnel digital para audio y MIDI por cable USB estándar entre iPad y Mac sin controladores adicionales y con latencia mínima.

### 2.2. [rtpMIDI (Tobias Erichsen)](https://www.tobias-erichsen.de/software/rtpmidi.html)
- **Descripción:** Controlador Network MIDI para Windows, compatible con la implementación Apple Network MIDI de iOS y macOS.
- **Utilidad:** Creación de sesiones de red para comunicación por cable o Wi-Fi con el iPad en Windows, exponiendo puertos MIDI virtuales reconocidos por el sistema.

### 2.3. WebSockets (RFC 6455) y Open Sound Control (OSC 1.0)
- **Descripción:** Protocolos de transporte dúplex sobre TCP (WebSockets, para interfaces en navegadores y tablets) y datagramas UDP (OSC, estándar en software de audio como SuperCollider y Max/MSP).
- **Utilidad:** Transporte de eventos desde clientes táctiles hacia el servidor sin restricciones de seguridad de navegador sobre puertos locales.

---

## 3. Síntesis, mapeo microtonal y hardware receptor

### 3.1. [Tubbutec µTune Eurorack Module](https://tubbutec.de/%C2%B5tune)
- **Descripción:** Módulo de interfaz MIDI a CV/Gate, ruteador y cuantizador microtonal para sintetizadores modulares con soporte para archivos Scala (`.scl`) y asignaciones de teclado (`.kbm`).
- **Utilidad:** Receptor de referencia para la salida física MIDI DIN Out, donde las notas recibidas se convierten en voltajes analógicos cuantizados microtonalmente.

### 3.2. [Scala y MTS (MIDI Tuning Standard)](https://www.huygens-fokker.org/scala/)
- **Descripción:** Formato para definición de escalas microtonales y estándar MIDI SysEx para retuning en tiempo real.
- **Utilidad:** Compatibilidad con sintetizadores e interfaces capaces de interpretar afinaciones no temperadas o tablas de mapeo KBM.

### 3.3. SuperCollider y Max/MSP
- **Descripción:** Entornos de programación de audio, síntesis digital y procesamiento algorítmico.
- **Utilidad:** Consumo de eventos en tiempo real mediante datagramas UDP OSC (puerto predeterminado 57120 en SuperCollider y 8000 en Max/MSP).

---

## 4. Librerías de soporte técnico

### 4.1. Entorno Node.js y JavaScript
- **[JZZ](https://www.npmjs.com/package/jzz):** Librería MIDI para Node.js y navegadores. Funciona en Windows, macOS y Linux accediendo a las APIs nativas del sistema operativo sin compilar módulos nativos de C++ manualmente.
- **[ws](https://www.npmjs.com/package/ws):** Servidor y cliente WebSocket para recepción de datos desde clientes en navegadores o tablets.
- **`dgram` (módulo nativo de Node.js):** Sockets UDP para envío directo de datagramas binarios OSC.

### 4.2. Entorno Python (herramientas auxiliares y terminal)
- **[mido](https://github.com/mido/mido) y [python-rtmidi](https://spotlightkid.github.io/python-rtmidi/):** Enlace con WinMM (Windows) y CoreMIDI (macOS).
- **[python-osc](https://github.com/attwad/python-osc):** Manejo asíncrono de paquetes OSC sobre UDP.
- **[Textual](https://github.com/Textualize/textual):** Framework para interfaces interactivas en terminal.
