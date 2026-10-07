---
name: midi-stream-processor
description: "Trigger: midi pipeline, ruteo matricial, traduccion osc midi, microtonal scale mapping, zero latency pipeline. Procesa, filtra, mapea y bifurca eventos MIDI y OSC en tiempo real."
license: Apache-2.0
metadata:
  author: "project-architect"
  version: "2.0"
---

# Skill: midi-stream-processor

## Activation Contract
Activa esta skill cuando se trabaje con:
- La tubería central de despacho y bifurcación paralela (OSC + MIDI).
- Mapeo de escalas y grados musicales hacia notas MIDI (0-127) compatibles con cuantizadores microtonales (ej. Tubbutec µTune, módulos Eurorack, sintes MPE o sintetizadores analógicos).
- Matriz de ruteo y filtrado (canal 1-16, rangos de velocidad, descarte de reloj no solicitado).
- Conversión y traducción bidireccional entre mensajes OSC y eventos MIDI.

## Hard Rules
- **Bifurcación paralela determinista:** Cuando entra una nota desde un controlador (iPad, footswitch, webapp), el envío a la rama MIDI física y a la rama OSC debe ocurrir en paralelo sin que ninguna de las dos frene a la otra.
- **Integridad de ciclo Note-On / Note-Off:** Toda nota encendida debe registrarse en una tabla interna de notas activas (`activeNotesMap`); el Note-Off correspondiente debe garantizarse para prevenir notas pegadas (*stuck notes*) en sintetizadores externos.
- **Aislamiento de la lógica musical:** La traducción de grados, octavas o temperamentos debe resolverse antes del despacho en bytes crudos de MIDI (`0x90`, `0x80`).

## Execution Steps
1. Consumir el evento entrante desde la capa de ingesta (WebSocket, MIDI In o socket OSC).
2. Procesar mapeo de canal (1-16) y cálculo de nota/velocidad.
3. Despachar simultáneamente hacia los endpoints de salida configurados (puerto MIDI físico y socket OSC).
4. Notificar al canal de monitoreo para actualización visual inmediata.

## Output Contract
- Motor de procesamiento con métricas de tiempo de ciclo (<2 ms) y cero notas colgadas en pruebas de estrés.
