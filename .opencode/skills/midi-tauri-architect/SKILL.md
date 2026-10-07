---
name: midi-tauri-architect
description: "Trigger: midi tauri, app escritorio midi, rust midir, frontend gui midi, empaquetar binario. Disena y construye la aplicacion de escritorio final en Tauri (Rust + Web)."
license: Apache-2.0
metadata:
  author: "project-architect"
  version: "1.0"
---

# Skill: midi-tauri-architect

## Activation Contract
Activa esta skill cuando se trabaje con:
- Portar el núcleo validado en Python a una aplicación de escritorio nativa de alto rendimiento con **Tauri**.
- Implementación del backend en Rust usando `midir` (MIDI multiplataforma) y `rosc` (OSC sobre UDP).
- Desarrollo del frontend web (HTML/JS/Canvas, React o Svelte) para un monitor visual fluido a 60 FPS similar a ShowMIDI.
- Compilación de instaladores y binarios ligeros para Windows (`.exe`) y macOS (`.app` / `.dmg`).

## Hard Rules
- **Backend Rust en hilo de tiempo real:** Los callbacks de `midir` deben correr en un hilo nativo del sistema operativo y comunicar eventos al frontend web a través de eventos asíncronos de Tauri (`emit_all`), sin bloquear el renderizado.
- **Consumo mínimo de memoria:** La aplicación empaquetada no debe superar los 50 MB de consumo de RAM en reposo (ventaja clave de Tauri sobre Electron).
- **Consistencia estética:** Implementar diseño de alto contraste con soporte para dark mode, paneles colapsables y teclado interactivo.

## Execution Steps
1. Inicializar el proyecto con `tauri-cli` configurando permisos de red para sockets UDP OSC.
2. Implementar los comandos en Rust (`invoke_handler`) para listar y seleccionar puertos MIDI físicos y virtuales.
3. Conectar el pipeline de eventos Rust hacia la interfaz web usando Tauri Events.
4. Diseñar la interfaz gráfica con visualizador de actividad, tabla de log y matriz de ruteo visual.

## Output Contract
- Proyecto Tauri funcional listo para compilar con `cargo tauri build` produciendo binarios ejecutables para Windows y macOS.
