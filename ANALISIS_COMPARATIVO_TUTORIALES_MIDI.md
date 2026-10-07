# Comparativa Técnica y Transcripciones de los Tutoriales MIDI

Este documento consolida la extracción de subtítulos oficiales de YouTube junto a la transcripción generada localmente con **Whisper (modelo `medium.en` / Faster-Whisper int8)** para los tres tutoriales solicitados:

1. **Video 1 (qrF0dlei5Pg):** MidiShift Tutorial! Double your MIDI devices
2. **Video 2 (J5rELr1MsK8):** How to connect multiple apps to one Midi device!! (MIDI Split)
3. **Video 3 (4EUFJPWb7Ys):** MidiView tutorial. Free MidiMonitor software!

---

## 1. Video 1: MidiShift Tutorial! Double your MIDI devices (`qrF0dlei5Pg`)

### Ficha Técnica del Software
- **Herramienta:** **MidiShift**
- **Hardware mostrado:** Akai APC40 MK2.
- **Software anfitrión/receptor:** Resolume Arena.
- **Objetivo principal:** Duplicar la funcionalidad de cualquier controlador MIDI físico asignando un único botón físico como botón **"Shift"**, dividiendo el flujo hacia dos puertos virtuales (`MidiShift 1` y `MidiShift 2`).

### Funcionalidades Clave Identificadas
1. **Creación de Puertos Virtuales Transparentes:** MidiShift crea dos puertos virtuales bidireccionales en el sistema operativo.
2. **Asignación Dinámica de Tecla Shift (MIDI Learn):** Permite presionar un botón del controlador para configurarlo como tecla modificadora (detecta canal, tipo y nota, ej. `D6 en canal 1`).
3. **Modos de Operación del Shift:**
   - **Flash (Momentary):** El shift se activa únicamente mientras mantienes presionado el botón.
   - **Toggle (Latch):** Cada pulsación conmuta entre la Capa 1 y la Capa 2.
4. **Filtro de Rango / Custom List (Selective Shifting):**
   - **Todo excepto el shift:** Conmuta todos los controles.
   - **Lista Personalizada:** Permite mapear mediante *Learn* únicamente un subconjunto de pads o perillas para que sean alteradas por el Shift, dejando el resto globales.
5. **Estado y Feedback Bidireccional (Cache de LEDs / Colores):** 
   - **Aspecto Crítico:** El software almacena en memoria el último estado de mensajes recibidos desde el DAW/software visual (colores de pads, feedback LED).
   - Al alternar entre Capa 1 y Capa 2, **refresca y reenvía inmediatamente al hardware físico todos los colores y estados de los botones correspondientes a esa capa**.
6. **Casos de Uso Arquitectónicos:**
   - Multiplicar bancos/páginas de control dentro de una misma app (ej. Resolume: Capa normal = selección de clips; Capa Shift = controles de efectos/parámetros).
   - Controlar dos programas distintos desde el mismo controlador físico (ej. Capa 1 a Resolume, Capa 2 a Ableton Live).

---

### Comparativa: YouTube Auto-Subtítulos vs. Faster-Whisper (Medium.en)

| Marca de Tiempo | Subtítulos YouTube (ASR estándar) | Transcripción Faster-Whisper Medium (Puntuación & Precisión) |
|---|---|---|
| **00:00 - 00:30** | `hey welcome to this tutorial about midi shift today i'm going to show you how the application works so midi shift is a cool little program that instantly doubles the amount of midi devices you have so we're just giving up one button on your device um we're able to make like two virtual devices um and switch the output of your device between those virtual outputs...` | `Hey, welcome to this tutorial about midi shift. Today I'm going to show you how the application works. So midi shift is a cool little program that instantly doubles the amount of midi devices you have. So we're just giving up one button on your device, we're able to make like two virtual devices and switch the output of your device between those virtual outputs.` |
| **00:31 - 01:00** | `i'm at this little scheme so you can see how it works so your midi device in this case i have an apc 4d setup uh it's gonna connect with uh midi shift and midi shift is gonna create two virtual ports um and by toggling the shift button um i'm choosing which output i wanna use...` | `I made this little scheme so you can see how it works. So your midi device, in this case I have an APC40 setup, it's going to connect with midi shift and midi shift is going to create two virtual ports and by toggling the shift button I'm choosing which output I want to use.` *(Whisper detecta correctamente "I made this little scheme" en lugar del erróneo "i'm at this little scheme" de YT, y escribe "APC40" correctamente).* |
| **01:40 - 02:20** | `so in this case i'm going to pick let's do this one so here now it found the key so it's a d6 on channel one and you see that it's already shifting the next button i'm having here is to change the mode so i can either set it to flash so in flash mode i have to hold the button to raise the shift or toggle and in toggle mode it's just a press and every press toggles the shift mode...` | `So in this case I'm going to pick, let's do this one, so here now it found the key, so it's a D6 on channel 1 and you see that it's already shifting. The next button I'm having here is to change the mode, so I can either set it to flash, so in flash mode I have to hold the button to raise the shift or toggle and in toggle mode it's just a press and every press toggles the shift mode.` |
| **04:00 - 04:30** | `and on the other hand um i made the shift and as you can see that's kind of cool it's the software stores the messages it gets so as soon as you press shift you will see like the other colors it's updating everything to the console itself...` | `And on the other hand, I made the shift, and as you can see that's kind of cool, it's the software stores the messages it gets. So as soon as you press shift, you will see like the other colors, it's updating everything to the console itself.` |

---

## 2. Video 2: How to connect multiple apps to one Midi device!! (`J5rELr1MsK8`)

### Ficha Técnica del Software
- **Herramienta:** **MIDI Split**
- **Duración:** 1 minuto (conciso y directo).
- **Objetivo principal:** Resolver el clásico problema de colisión en Windows/macOS donde un driver MIDI físico solo permite ser abierto por un único proceso de software exclusivo.

### Funcionalidades Clave Identificadas
1. **Creación Automática de Puertos Virtuales (Dispositivo A y Dispositivo B):** Al iniciar la app, crea automáticamente dos dispositivos MIDI virtuales gemelos (`Device A` y `Device B`).
2. **Selector de Dispositivo Físico:** Menú desplegable para elegir qué controlador de hardware se vinculará.
3. **Matriz de Enrutamiento Asimétrico (Control Bidireccional de Flujo):**
   - Cuenta con **4 botones de conmutación IN/OUT** que controlan el sentido del flujo de datos entre el dispositivo físico y los dispositivos virtuales A y B.
   - **Caso de uso de prevención de conflictos:** Permite que los mensajes del controlador físico se transmitan a ambos programas (A y B), pero que **únicamente el software A pueda enviar retroalimentación (LEDs/SysEx) de vuelta al hardware**. Esto evita parpadeos o conflictos de estado en los controles motorizados o luces LED.
4. **Cualquier combinación de ruteo:** Permite aislar o mezclar envíos/retornos según la configuración requerida.

---

### Comparativa: YouTube Auto-Subtítulos vs. Faster-Whisper (Medium.en)

| Marca de Tiempo | Subtítulos YouTube (ASR estándar) | Transcripción Faster-Whisper Medium |
|---|---|---|
| **00:00 - 00:25** | `welcome to this tutorial about midi split midi split allows you to easily connect a single midi device to different applications at the same time by simply starting the app two new virtual midi devices will be created device a and b select the physical device you want to connect to with the drop down device picker...` | `Welcome to this tutorial about MIDI Split. MIDI Split allows you to easily connect a single MIDI device to different applications at the same time. By simply starting the app, two new virtual MIDI devices will be created, device A and B. Select the physical device you want to connect to with the drop-down device picker.` |
| **00:25 - 00:46** | `right next to that you'll find the routing buttons these buttons control the data flow for instance in this situation all data from the device will be routed to a and b but only the data from the application connected to a will flow back to the device this will help you to prevent conflicting behavior with the four in and out buttons you can make any routing combination...` | `Right next to that, you'll find the routing buttons. These buttons control the data flow. For instance, in this situation, all data from the device will be routed to A and B, but only the data from the application connected to A will flow back to the device. This will help you to prevent conflicting behavior. With the four in and out buttons, you can make any routing combination.` |

---

## 3. Video 3: MidiView tutorial. Free MidiMonitor software! (`4EUFJPWb7Ys`)

### Ficha Técnica del Software
- **Herramienta:** **MidiView**
- **Hardware mostrado:** Akai APC40 MK2.
- **Software conectado:** Resolume Arena.
- **Objetivo principal:** Monitoreo, diagnóstico y depuración de tráfico MIDI en tiempo real mediante un puerto passthrough virtual intermediario.

### Funcionalidades Clave Identificadas
1. **Topología de Interceptación Man-in-the-Middle (Proxy MIDI):**
   - El hardware físico se conecta directamente a MidiView.
   - MidiView expone un puerto MIDI virtual (`MidiView Port`).
   - El DAW o software visual (Resolume) se conecta a `MidiView Port` en lugar de conectarse directamente al APC40.
2. **Inspección de Tráfico Bidireccional:**
   - Muestra mensajes entrantes del hardware (botones, faders, knobs, notas, CC).
   - Muestra mensajes salientes del DAW hacia el controlador (mensajes SysEx, comandos de iluminación de LEDs RGB, feedback de clips).
3. **Detección de Latencia y Bucle:** Permite descubrir saturación de mensajes MIDI, mensajes en bucle infinito o comandos que generan lag en vivo.
4. **Modo Bypass / Modo Deshabilitado de Alto Rendimiento:**
   - Posee un switch de **Enable / Disable**.
   - **Comportamiento clave:** Cuando está en **Disable**, el motor sigue enrutando los mensajes a través del cable virtual con latencia cero/mínima pero **suspende el renderizado en la interfaz gráfica y el procesamiento de logs**.
   - Esto permite dejar el software interconectado durante un show en vivo sin penalización de CPU o riesgo de cuelgue, habilitando el monitor solo si surge un comportamiento anómalo.

---

### Comparativa: YouTube Auto-Subtítulos vs. Faster-Whisper (Medium.en)

| Marca de Tiempo | Subtítulos YouTube (ASR estándar) | Transcripción Faster-Whisper Medium |
|---|---|---|
| **00:00 - 00:35** | `tutorial about midi view midi view is a cool handy program that you can use whenever you want to like debug your midi or see what's going on or stuff like that so the concept is that midi view connects to your midi device and your application connects to midi view so what we do is we create a virtual midi port where you can connect to and that way you can see both directions the messages in both directions...` | `Tutorial about MidiView. MidiView is a cool handy program that you can use whenever you want to like debug your MIDI or see what's going on or stuff like that. So the concept is that MidiView connects to your MIDI device and your application connects to MIDI view. So what we do is we create a virtual MIDI port where you can connect to and that way you can see both directions the messages in both directions.` |
| **01:18 - 01:45** | `so here's my apc40 but i don't want to connect to my apc40 i want to connect to my midi viewport so whenever i do that it's gonna act like it's gonna act like a loop so resolume thinks that it's an apc40 that is found on the midi viewport...` | `So here's my APC40 but I don't want to connect to my APC40, I want to connect to my MIDI view port. So whenever I do that it's gonna act like a loop. So Resolume thinks that it's an APC40 that is found on the MIDI view port.` |
| **02:50 - 03:30** | `so i said that i would come back to the enable disable function well if you disable midi view the midi is still sent through but we're not doing anything with it so if you're live on a show or whatever and you want to have midi view in between just as backup as suddenly you enter like a weird state or something then you can enable it afterwards so you can see what's going on but during whatever you're doing you can disable it so you have no lag or no problems from the software itself...` | `So I said that I would come back to the enable disable function. Well if you disable MIDI view the MIDI is still sent through but we're not doing anything with it. So if you're live on a show or whatever and you want to have MIDI view in between just as backup as suddenly you enter like a weird state or something then you can enable it afterwards so you can see what's going on but during whatever you're doing you can disable it so you have no lag or no problems from the software itself.` |

---

## 4. Evaluación Técnica para Nuestro Proyecto (`midiControl`)

Analizando la arquitectura de nuestro entorno y los tres programas (**MidiShift**, **MIDI Split**, **MidiView**), se extraen los siguientes componentes de alto valor para incorporar:

| Característica / Patrón | Proveniente de | Utilidad & Valor en `midiControl` | Recomendación Arquitectónica |
|---|---|---|---|
| **Capa Shift con Memoria de Estado (LED / Feedback Cache)** | MidiShift | **Crítica.** No basta con alternar el canal o destino MIDI; el controlador físico queda ciego si no se le refresca el estado de los LEDs al cambiar de capa. Mantener un buffer con el último estado de cada control por capa permite que los pads RGB reflejen la página activa al instante. | Implementar un `StateCache` por cada capa virtual que intercepte y almacene mensajes CC/NoteOn/SysEx de salida. |
| **Shift Momentary vs. Toggle y Rango Selectivo** | MidiShift | **Alta.** Permite configurar tanto botones de retención (para momentary punch-in FX) como alternancia por click, y definir si el Shift afecta a toda la superficie o solo a una sección (ej. solo pads, manteniendo perillas de volumen globales). | Configuración declarativa en JSON/UI: `mode: "toggle" | "flash"`, `scope: "all" | "whitelist"`. |
| **Aislamiento Asimétrico de Retorno (Feedback Split / Loop Prevention)** | MIDI Split | **Crítica.** Cuando conectamos un dispositivo a múltiples destinos (ej. DAW + Engine de luces/visuales), el retorno de feedback de múltiples fuentes destruye la iluminación o satura el bus. El enrutamiento con filtros direccionales independientes (A -> HW, B -> HW conmutables) es indispensable. | Incorporar matriz de ruteo matricial con flags booleanos: `In_A -> Out_B`, `In_B -> Out_A`, `Out_App -> Hardware_Return`. |
| **Modo Proxy Transparente (Virtual Loopback)** | MidiView & MIDI Split | **Alta.** En Windows, los drivers MIDI estándar no admiten apertura multi-cliente. Crear puertos virtuales intermediarios transparentes permite que las aplicaciones crean que están hablando directo con el hardware original. | Usar puertos virtuales (ej. `midir` virtual ports en macOS/Linux o integración con loopMIDI/teevid en Windows). |
| **Modo Bypass UI / Modo Performance (Zero-Overhead passthrough)** | MidiView | **Alta.** En sesiones en vivo, renderizar miles de eventos MIDI en el frontend causa jank y micro-latencias. Un switch que desacople la visualización en la UI mientras mantiene el hilo de procesamiento de audio en tiempo real garantiza estabilidad y cero lag. | Diseñar la TUI/GUI con una cola de eventos atómica de tamaño limitado o modo "Pause visualizer" que corte el dispatch hacia el frontend. |
