/**
 * Master Live Server with Built-in Telemetry & Live Monitor Web Dashboard
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const StreamProcessor = require('./processor');
const TerminalMonitor = require('./monitor');

const HTTP_PORT = 3000;
const WS_PORT = 8081;

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIP();

class LiveSentinelApp {
    constructor() {
        this.processor = new StreamProcessor();
        this.terminalMonitor = new TerminalMonitor();
        this.httpServer = null;
        this.wss = null;
        this.webClients = new Set();
        this.selectedChannel = 0; // Canal 1 por defecto
        this.isBypass = false; // Modo Rendimiento / Zero-Overhead (desacopla telemetría de UI)
    }

    setBypass(enable) {
        this.isBypass = !!enable;
        this.terminalMonitor.setBypass(this.isBypass);
        this.broadcastBypassStatus();
        console.log(`[RENDIMIENTO] Modo Bypass / Zero-Overhead: ${this.isBypass ? 'ACTIVADO (UI silenciada)' : 'DESACTIVADO (Telemetría activa)'}`);
        return this.isBypass;
    }

    broadcastBypassStatus() {
        const payload = JSON.stringify({ type: 'bypass_status', enabled: this.isBypass });
        for (const ws of this.webClients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }

    broadcastRoutingMatrix() {
        const payload = JSON.stringify({
            type: 'routing_matrix',
            matrix: this.processor.midiRouter.getRoutingMatrix()
        });
        for (const ws of this.webClients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }

    async start(targetMidi = null, targetOscPort = 57120) {
        await this.processor.init();
        this.processor.addOscTarget('127.0.0.1', targetOscPort);

        const outputs = this.processor.midiRouter.listOutputs();
        let portToOpen = targetMidi;
        if (!portToOpen) {
            const usbPort = outputs.find(o => o.name.includes('USB2.0-MIDI'));
            portToOpen = usbPort ? usbPort.name : (outputs[0] ? outputs[0].name : null);
        }

        if (portToOpen) {
            try {
                await this.processor.midiRouter.openOutput(portToOpen);
            } catch (err) {
                console.warn(`[MIDI] No se pudo abrir salida por defecto "${portToOpen}": ${err.message}. Podrás seleccionarla manualmente desde la consola.`);
            }
        }

        // Suscribir el monitor de consola
        this.processor.subscribe((event) => {
            // Si el modo Bypass está activo, no alimentar terminal ni serializar hacia WebSockets
            if (this.isBypass) return;

            this.terminalMonitor.logEvent(event);
            
            // Reenviar a clientes web que tengan el monitor abierto
            const payload = JSON.stringify({ type: 'telemetry', data: event });
            for (const ws of this.webClients) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            }
        });

        // 1. Servidor HTTP
        this.httpServer = http.createServer((req, res) => {
            // Protección contra Path Traversal: Sanitizar ruta y restringir a archivos públicos permitidos
            const safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
            let fileName = safePath === '/' || safePath === '\\' ? 'midi_monitor.html' : safePath.replace(/^[\/\\]+/, '');
            
            // Lista blanca de archivos públicos permitidos
            const allowedFiles = ['midi_monitor.html', 'favicon.ico'];
            if (!allowedFiles.includes(fileName)) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                return res.end('Acceso denegado: solo archivos públicos autorizados.');
            }

            const filePath = path.join(__dirname, '..', fileName);
            const extname = String(path.extname(filePath)).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.ico': 'image/x-icon'
            };

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(err.code === 'ENOENT' ? 404 : 500);
                    res.end(`Error: ${err.code}`);
                } else {
                    res.writeHead(200, { 
                        'Content-Type': contentType,
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY'
                    });
                    res.end(content, 'utf-8');
                }
            });
        });

        this.httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
            console.log(`[HTTP] Monitor Web disponible: http://${LOCAL_IP}:${HTTP_PORT}`);
        });

        // 2. Servidor WebSocket
        this.wss = new WebSocket.Server({ port: WS_PORT });
        console.log(`[WS]   Ingesta y Telemetría: ws://${LOCAL_IP}:${WS_PORT}`);

        this.wss.on('connection', (ws) => {
            this.webClients.add(ws);

            // Enviar inventario de dispositivos conectados al recién conectado
            this.sendDeviceInventory(ws);

            ws.on('message', async (data) => {
                try {
                    // Limitar tamaño de mensaje para prevenir DoS por memoria
                    if (data.length > 4096) return;

                    const msg = JSON.parse(data);

                    // COMANDOS DE CONTROL DE DISPOSITIVOS Y MODOS
                    if (msg.type === 'get_devices') {
                        this.sendDeviceInventory(ws);
                        ws.send(JSON.stringify({ type: 'bypass_status', enabled: this.isBypass }));
                        ws.send(JSON.stringify({ type: 'routing_matrix', matrix: this.processor.midiRouter.getRoutingMatrix() }));
                        return;
                    }

                    if (msg.type === 'set_routing') {
                        // msg: { target: 'app_b', direction: 'out', allowed: false }
                        if (msg.target && msg.direction !== undefined && msg.allowed !== undefined) {
                            this.processor.midiRouter.setRoutePermission(msg.target, msg.direction, msg.allowed);
                            this.broadcastRoutingMatrix();
                        }
                        return;
                    }

                    if (msg.type === 'set_bypass') {
                        this.setBypass(!!msg.enabled);
                        return;
                    }

                    if (msg.type === 'set_midi_output') {
                        try {
                            if (msg.device === 'none') {
                                if (this.processor.midiRouter.activeOutput) {
                                    this.processor.midiRouter.activeOutput.close();
                                    this.processor.midiRouter.activeOutput = null;
                                    this.processor.midiRouter.activeOutputName = null;
                                }
                            } else {
                                await this.processor.midiRouter.openOutput(msg.device);
                            }
                            this.broadcastDeviceInventory();
                        } catch (e) {
                            ws.send(JSON.stringify({ type: 'error', message: e.message }));
                        }
                        return;
                    }

                    if (msg.type === 'set_midi_input') {
                        try {
                            await this.processor.midiRouter.openInput(msg.device);
                            this.broadcastDeviceInventory();
                        } catch (e) {
                            ws.send(JSON.stringify({ type: 'error', message: e.message }));
                        }
                        return;
                    }

                    if (msg.type === 'midi') {
                        const rawCh = parseInt(msg.channel, 10);
                        const ch = (!isNaN(rawCh) && rawCh >= 1 && rawCh <= 16) ? (rawCh - 1) : this.selectedChannel;

                        const rawNote = parseInt(msg.note, 10);
                        const rawVel = msg.velocity !== undefined ? parseInt(msg.velocity, 10) : 127;

                        // Validar rango MIDI 1.0 (0-127)
                        if (isNaN(rawNote) || rawNote < 0 || rawNote > 127) return;
                        const vel = isNaN(rawVel) ? 127 : Math.max(0, Math.min(127, rawVel));

                        if (msg.event === 'noteon') {
                            this.processor.dispatchNoteOn(ch, rawNote, vel, msg);
                        } else if (msg.event === 'noteoff') {
                            this.processor.dispatchNoteOff(ch, rawNote, msg);
                        } else if (msg.event === 'panic') {
                            this.processor.panic();
                        }
                    } else if (msg.type === 'panic') {
                        this.processor.panic();
                    }
                } catch (e) {
                    // Ignorar silenciosamente mensajes malformados sin tumbar el WebSocket
                }
            });

            ws.on('close', () => {
                this.webClients.delete(ws);
            });
        });

        return { localIP: LOCAL_IP, httpPort: HTTP_PORT, wsPort: WS_PORT };
    }

    sendDeviceInventory(ws) {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
            const outputs = this.processor.midiRouter.listOutputs();
            const inputs = this.processor.midiRouter.listInputs();
            const payload = JSON.stringify({
                type: 'device_inventory',
                outputs,
                inputs,
                activeOutput: this.processor.midiRouter.activeOutputName,
                activeInput: this.processor.midiRouter.activeInputName
            });
            ws.send(payload);
        } catch (e) {}
    }

    broadcastDeviceInventory() {
        for (const ws of this.webClients) {
            this.sendDeviceInventory(ws);
        }
    }

    panic() {
        this.processor.panic();
    }

    close() {
        this.processor.close();
        if (this.httpServer) this.httpServer.close();
        if (this.wss) this.wss.close();
    }
}

module.exports = LiveSentinelApp;
