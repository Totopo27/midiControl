---
name: midi-hardware-router
description: "Trigger: midi hardware, midi ports, rtpmidi, conexion ipad, puertos fisicos, osc socket. Gestiona la conexion de interfaces MIDI fisicas, virtuales, por red y sockets UDP OSC."
license: Apache-2.0
metadata:
  author: "project-architect"
  version: "2.0"
---

# Skill: midi-hardware-router

## Activation Contract
Activa esta skill cuando se trabaje con:
- Enumeración, detección y apertura de interfaces físicas MIDI (USB-MIDI, DIN-5, interfaces PCIe/Thunderbolt).
- Configuración de transporte desde iPad (cable USB via IDAM/red local o Wi-Fi rtpMIDI).
- Creación y manejo de puertos virtuales en el sistema operativo (virtualMIDI / IAC Driver).
- Configuración de sockets UDP para paquetes Open Sound Control (OSC).

## Hard Rules
- **Agnóstico al hardware receptor:** Nunca acoplar el código a un sintetizador o marca específica; la capa de hardware debe hablar MIDI 1.0 estándar y UDP transparente hacia cualquier dispositivo o software conectado.
- **Tolerancia a desconexiones en vivo:** Si un cable USB o interfaz se desconecta durante una sesión en vivo, el sistema debe registrar el evento, no colapsar el proceso principal y reintentar reconexión automática en segundo plano.
- **Acceso no bloqueante:** Toda ingesta y despacho físico debe operar en hilos o bucles de eventos desacoplados para garantizar latencias inferiores a 2 ms.

## Execution Steps
1. Enumerar puertos disponibles en el host reportando tipo (físico, virtual, red).
2. Abrir el puerto de salida MIDI seleccionado asegurando despacho inmediato del buffer.
3. Abrir socket UDP para reenvío y escucha de mensajes OSC en puertos configurables.
4. Proveer función de pánico (*All Notes Off* y *Reset All Controllers*) accesible en caso de emergencia.

## Output Contract
- Módulo de enrutamiento con métodos limpios: `list_ports()`, `open_output()`, `send_midi()`, `send_osc()`, `panic()`.
