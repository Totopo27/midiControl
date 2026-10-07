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
            await this.processor.midiRouter.openOutput(portToOpen);
        }

        // Suscribir el monitor de consola
        this.processor.subscribe((event) => {
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
            let filePath = '.' + req.url;
            if (filePath === './' || filePath === '.') filePath = './midi_monitor.html';

            const extname = String(path.extname(filePath)).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json'
            };

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(err.code === 'ENOENT' ? 404 : 500);
                    res.end(`Error: ${err.code}`);
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
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

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    if (msg.type === 'midi') {
                        const ch = msg.channel !== undefined ? (msg.channel - 1) : this.selectedChannel;
                        if (msg.event === 'noteon') {
                            this.processor.dispatchNoteOn(ch, msg.note, msg.velocity || 127, msg);
                        } else if (msg.event === 'noteoff') {
                            this.processor.dispatchNoteOff(ch, msg.note, msg);
                        } else if (msg.event === 'panic') {
                            this.processor.panic();
                        }
                    } else if (msg.type === 'panic') {
                        this.processor.panic();
                    }
                } catch (e) {
                    console.error('[WS ERROR]', e.message);
                }
            });

            ws.on('close', () => {
                this.webClients.delete(ws);
            });
        });

        return { localIP: LOCAL_IP, httpPort: HTTP_PORT, wsPort: WS_PORT };
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
