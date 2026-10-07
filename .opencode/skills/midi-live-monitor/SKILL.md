---
name: midi-live-monitor
description: "Trigger: midi monitor, monitor eventos vivo, inspeccion midi osc, logs tiempo real, panel actividad. Construye la herramienta de monitorizacion en vivo de trafico MIDI y OSC."
license: Apache-2.0
metadata:
  author: "project-architect"
  version: "2.0"
---

# Skill: midi-live-monitor

## Activation Contract
Activa esta skill cuando se trabaje con:
- Monitorización e inspección en vivo de eventos MIDI y OSC (entradas y salidas).
- Interfaz ligera de visualización de eventos (tabla de log en terminal TUI o panel web con scroll).
- Medición de actividad en tiempo real: timestamp, canal (1-16), nota/CC, velocidad, bytes hexadecimales y puerto físico de destino.
- Diagnóstico de rendimiento: latencia entre recepción y despacho, tasa de mensajes/segundo y detección de notas huérfanas.

## Hard Rules
- **No bloquear el loop de despacho:** El monitor es un observador asíncrono; si la pantalla o el renderizado se congelan, el motor de ruteo físico MIDI/OSC debe seguir disparando eventos con latencia ininterrumpida.
- **Formato claro para directo:** En situaciones de concierto en vivo, la información debe ser de alto contraste, legible de un vistazo y con botón o atajo de pánico (*All Notes Off*) accesible.
- **Captura de anomalías:** Resaltar visualmente eventos corruptos, notas duplicadas o ráfagas fuera de rango.

## Execution Steps
1. Suscribir el monitor a la cola o bus de eventos del procesador central.
2. Renderizar tabla con columnas: Timestamp | Tipo | Canal | Nota/CC | Valor | Puerto Destino.
3. Proveer medidor de estado y opción de filtrado rápido por canal o tipo de mensaje.

## Output Contract
- Módulo de monitoreo en tiempo real con latencia de renderizado transparente y controles de pausa/limpieza de log.
