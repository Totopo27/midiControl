---
name: midi-terminal-ui
description: "Trigger: midi tui, monitor terminal, interfaz consola, textual midi, rich log midi. Construye y gestiona la interfaz interactiva de terminal (TUI) para monitoreo y control MIDI."
license: Apache-2.0
metadata:
  author: "project-architect"
  version: "1.0"
---

# Skill: midi-terminal-ui

## Activation Contract
Activa esta skill cuando se trabaje con:
- Desarrollo de la interfaz de consola interactiva (TUI) con `Textual` o `Rich`.
- Tabla de eventos en vivo con scroll automático, filtrado y colores según tipo de mensaje.
- Medidores de barras (vu-meters / sliders) para valores CC en tiempo real en la terminal.
- Teclado virtual o indicador de notas activas por canal (1 al 16).

## Hard Rules
- **Tasa de refresco asíncrona:** La interfaz visual nunca debe ejecutarse en el mismo hilo del procesamiento de audio/MIDI; actualizar la UI vía colas asíncronas para garantizar que la pantalla no frene los paquetes entrantes.
- **Formato legible y hexadecimal:** Todo mensaje en el log debe mostrar timestamp relativo, canal, tipo, valores decodificados y sus bytes hexadecimales crudos (estilo MidiView).
- **Atajos de teclado rápidos:** Permitir pausar el scroll (`Espacio`), limpiar la pantalla (`c`) y filtrar canales (`1-9`, `0`).

## Execution Steps
1. Configurar la estructura de widgets en `Textual` (Header, Panel de Estado, Log de Eventos, Panel de CCs).
2. Conectar el consumidor asíncrono con la cola del procesador de eventos.
3. Renderizar cada evento con resaltado de sintaxis y estado visual sin parpadeos (*flickering*).

## Output Contract
- Aplicación de terminal ejecutable e interactiva con navegación fluida por teclado.
