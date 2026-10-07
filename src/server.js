/**
 * Unified Server Bridge (HTTP + WebSocket Ingest + Physical MIDI + UDP OSC)
 * Servidor no bloqueante de latencia ultra baja para actuaciones en vivo.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const dgram = require('dgram');
const MidiRouter = require('./router');

const HTTP_PORT = 3000;
const WS_PORT = 8081;
const DEFAULT_OSC_PORT = 57120; // SuperCollider por defecto
const DEFAULT_OSC_HOST = '127.0.0.1';

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

class BridgeServer {
    constructor() {
        this.router = new MidiRouter();
        this.udpClient = dgram.createSocket('udp4');
        this.httpServer = null;
        this.wss = null;
        this.selectedChannel = 0; // 0-15 (Canal 1 por defecto)
        this.eventListeners = [];
    }

    async start(targetMidiOutput = null) {
        await this.router.init();
        
        const outputs = this.router.listOutputs();
        console.log('\n--- PUERTOS MIDI DE SALIDA DETECTADOS ---');
        outputs.forEach(o => console.log(`  [${o.index}] ${o.name}`));

        // Si no se especifica, intentar abrir USB2.0-MIDI o el primer puerto disponible
        let portToOpen = targetMidiOutput;
        if (!portToOpen) {
            const usbPort = outputs.find(o => o.name.includes('USB2.0-MIDI'));
            portToOpen = usbPort ? usbPort.name : (outputs[0] ? outputs[0].name : null);
        }

        if (portToOpen) {
            const res = await this.router.openOutput(portToOpen);
            console.log(`[MIDI] Conectado a salida física: "${res.name}"`);
        } else {
            console.warn('[MIDI] Advertencia: No hay puertos MIDI OUT disponibles.');
        }

        // 1. Servidor HTTP para servir interfaces web (ej. iPad / tablets)
        this.httpServer = http.createServer((req, res) => {
            let filePath = '.' + req.url;
            if (filePath === './') filePath = './index.html';

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
            console.log(`[HTTP] Servidor listo: http://${LOCAL_IP}:${HTTP_PORT}`);
        });

        // 2. Servidor WebSocket para ingesta en tiempo real
        this.wss = new WebSocket.Server({ port: WS_PORT });
        console.log(`[WS]   Socket de ingesta: ws://${LOCAL_IP}:${WS_PORT}`);

        this.wss.on('connection', (ws) => {
            console.log('[CLIENTE CONECTADO] Controlador vinculado vía WebSocket.');

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    this.handleMessage(msg);
                } catch (e) {
                    console.error('[PARSE ERROR]', e.message);
                }
            });

            ws.on('close', () => {
                console.log('[CLIENTE DESCONECTADO]');
                this.router.panic();
            });
        });

        return { localIP: LOCAL_IP, httpPort: HTTP_PORT, wsPort: WS_PORT };
    }

    handleMessage(msg) {
        // 1. Despacho MIDI
        if (msg.type === 'midi') {
            const ch = msg.channel !== undefined ? (msg.channel - 1) : this.selectedChannel;
            if (msg.event === 'noteon') {
                this.router.sendNoteOn(ch, msg.note, msg.velocity || 127);
            } else if (msg.event === 'noteoff') {
                this.router.sendNoteOff(ch, msg.note);
            } else if (msg.event === 'panic') {
                this.router.panic();
            }
        }

        // 2. Despacho OSC paralelo
        if (msg.type === 'osc' && msg.message) {
            const buffer = Buffer.from(msg.message);
            const targetPort = msg.port || DEFAULT_OSC_PORT;
            const targetHost = msg.ip || DEFAULT_OSC_HOST;
            
            this.udpClient.send(buffer, 0, buffer.length, targetPort, targetHost, (err) => {
                if (err) console.error('[UDP/OSC ERROR]', err.message);
            });
        }
    }

    setChannel(channelNumber) {
        this.selectedChannel = Math.max(0, Math.min(15, channelNumber - 1));
        console.log(`[CANAL MIDI] Canal activo fijado a: ${this.selectedChannel + 1}`);
    }

    stop() {
        if (this.router) this.router.close();
        if (this.httpServer) this.httpServer.close();
        if (this.wss) this.wss.close();
        if (this.udpClient) this.udpClient.close();
    }
}

module.exports = BridgeServer;
