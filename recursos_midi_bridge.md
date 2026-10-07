# Recursos y Referencias Técnicas: Ecosistema MIDI & OSC Universal Bridge

> Documento base con especificaciones del estándar, drivers multiplataforma, herramientas de monitoreo, utilidades microtonales y librerías para la construcción de una estación universal de interconexión y monitoreo en vivo.

---

## 1. Herramientas de Referencia y Benchmarking (Monitores de Actividad)

### 1.1. [gbevin/ShowMIDI](https://github.com/gbevin/ShowMIDI)
* **Descripción:** Monitor gráfico de actividad MIDI multiplataforma (Windows, macOS, Linux, iOS) escrito en C++/JUCE.
* **Uso principal:** Estándar de referencia para visualización de notas en vivo, feedback de velocidad, actividad multicanal (1-16), barras de CC de alta resolución y detección de mensajes RPN/NRPN.

### 1.2. [MidiView (Haute Technique)](https://hautetechnique.com/midi/midiview/)
* **Descripción:** Monitor de eventos MIDI ligero y directo para Windows y macOS.
* **Uso principal:** Referencia para el log de eventos estructurado en columnas: timestamp de alta precisión, puerto de origen/destino, canal, tipo de comando (NoteOn, NoteOff, CC, PitchBend, SysEx), decodificación legible y volcado hexadecimal.

### 1.3. [arashsm79/elemidiviewer](https://github.com/arashsm79/elemidiviewer)
* **Descripción:** Parser y visor de eventos MIDI en C con GTK.
* **Uso principal:** Referencia para la detección, captura y alerta visual de mensajes malformados o fuera del estándar MIDI 1.0.

### 1.4. [pushpop/Acordes](https://github.com/pushpop/Acordes) & [mackrus/tuiano](https://github.com/mackrus/tuiano)
* **Descripción:** Aplicaciones TUI en terminal con interfaz de monitoreo y control construidas en Python (`Textual`) y Rust (`Ratatui`).
* **Uso principal:** Referencia para la interfaz de consola interactiva con refresco no bloqueante y bajo consumo de CPU.

---

## 2. Protocolos de Transporte y Conectividad con Dispositivos Móviles (iPad / Red)

### 2.1. Apple IDAM (Inter-Device Audio and MIDI)
* **Descripción:** Tecnología nativa en macOS a través de *Audio MIDI Setup*.
* **Uso principal:** Crear un túnel digital de transporte de audio y MIDI por cable USB estándar entre iPad y Mac sin drivers adicionales y con latencia cercana a 0 ms.

### 2.2. [rtpMIDI (Tobias Erichsen)](https://www.tobias-erichsen.de/software/rtpmidi.html)
* **Descripción:** Driver Network MIDI para Windows, totalmente compatible con la pila de Apple Network MIDI de iOS y macOS.
* **Uso principal:** Habilitar sesiones de red para comunicación por cable o Wi-Fi con el iPad en entornos Windows, creando puertos MIDI reconocibles por el sistema operativo.

### 2.3. WebSockets (RFC 6455) & Open Sound Control (OSC 1.0)
* **Descripción:** Protocolos de transporte dúplex sobre TCP (WebSockets, para interfaces web en navegadores/tablets) y datagramas UDP (OSC, estándar en software de audio como SuperCollider y Max MSP).
* **Uso principal:** Transporte agnóstico de eventos desde cualquier cliente (iPad, TouchOSC, interfaces web) hacia el host sin restricciones de seguridad de navegador.

---

## 3. Entornos de Síntesis, Mapeo Microtonal y Hardware Receptor

### 3.1. [Tubbutec µTune Eurorack Module](https://tubbutec.de/%C2%B5tune)
* **Descripción:** Interfaz MIDI a CV/Gate, ruteador y cuantizador microtonal para sintetizadores modulares con soporte para archivos Scala (`.scl`) y Keyboard Mapping (`.kbm`).
* **Uso principal:** Caso de uso de referencia para recepción por puerto físico MIDI DIN Out donde las notas MIDI se traducen a voltajes analógicos afinados microtonalmente.

### 3.2. [Scala & MTS (MIDI Tuning Standard)](https://www.huygens-fokker.org/scala/)
* **Descripción:** El formato universal para descripción de afinaciones microtonales y el estándar MIDI SysEx para retuning en tiempo real.
* **Uso principal:** Modelado de compatibilidad para sintetizadores con soporte microtonal nativo o mapeos mediante tablas KBM.

### 3.3. SuperCollider & Max/MSP
* **Descripción:** Entornos líderes de programación de audio y síntesis algorítmica.
* **Uso principal:** Consumidores de eventos en tiempo real mediante sockets OSC UDP (puerto estándar 57120 en SC) y puertos MIDI virtuales.

---

## 4. Librerías de Ingesta, Ruteo y Monitoreo Multiplataforma

### 4.1. Ecosistema Node.js / TypeScript
* **[JZZ](https://www.npmjs.com/package/jzz):** Librería MIDI universal para Node.js y navegadores. Funciona en Windows, macOS y Linux sin requerir herramientas pesadas de compilación en C++, permitiendo abrir puertos físicos IN/OUT y crear nodos virtuales.
* **[ws](https://www.npmjs.com/package/ws):** Servidor y cliente WebSocket de alto rendimiento para recepción de paquetes desde navegadores/iPad.
* **`dgram` (Nativo Node.js):** Sockets UDP para despacho y recepción de paquetes binarios OSC.

### 4.2. Ecosistema Python (Para prototipos y monitor TUI)
* **[mido](https://github.com/mido/mido) + [python-rtmidi](https://spotlightkid.github.io/python-rtmidi/):** Backend C++ nativo para acceso a WinMM/WASAPI (Windows) y CoreMIDI (macOS).
* **[python-osc](https://github.com/attwad/python-osc):** Cliente y servidor asíncrono UDP OSC.
* **[Textual](https://github.com/Textualize/textual):** Framework asíncrono para construir la TUI de terminal con scroll de eventos y medidores de actividad.
