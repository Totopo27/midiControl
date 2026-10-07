const JZZ = require('jzz');
const dgram = require('dgram');

async function runDiagnosis() {
    console.log('==============================================');
    console.log('   DIAGNÓSTICO DE ENTORNO MIDI & OSC (FASE 0) ');
    console.log('==============================================\n');

    let midiSuccess = false;
    let oscSuccess = false;

    // 1. Diagnóstico de interfaces MIDI
    try {
        const midi = await JZZ();
        const info = midi.info();
        
        console.log('[MIDI ENGINE] Motor inicializado con éxito.');
        console.log(`[MIDI ENGINE] Backend: ${info.engine || 'Nativo del SO'}`);
        
        console.log('\n--- PUERTOS MIDI DE ENTRADA (IN) ---');
        if (info.inputs && info.inputs.length > 0) {
            info.inputs.forEach((inp, idx) => {
                console.log(`  [${idx}] ${inp.name} (Fabricante: ${inp.manufacturer || 'Desconocido'})`);
            });
        } else {
            console.log('  (Ningún puerto MIDI de entrada detectado en este momento)');
        }

        console.log('\n--- PUERTOS MIDI DE SALIDA (OUT) ---');
        if (info.outputs && info.outputs.length > 0) {
            info.outputs.forEach((out, idx) => {
                console.log(`  [${idx}] ${out.name} (Fabricante: ${out.manufacturer || 'Desconocido'})`);
            });
        } else {
            console.log('  (Ningún puerto MIDI de salida detectado en este momento)');
        }

        midiSuccess = true;
    } catch (err) {
        console.error('[ERROR MIDI]', err.message);
    }

    // 2. Diagnóstico de Sockets UDP para OSC
    try {
        console.log('\n--- PRUEBA DE SOCKET UDP (OSC) ---');
        const socket = dgram.createSocket('udp4');
        
        await new Promise((resolve, reject) => {
            socket.on('error', (err) => {
                socket.close();
                reject(err);
            });

            // Enlazamos en un puerto efímero o estándar para verificar disponibilidad
            socket.bind(0, '127.0.0.1', () => {
                const address = socket.address();
                console.log(`[UDP/OSC] Socket UDP inicializado y enlazado en ${address.address}:${address.port}`);
                socket.close(() => resolve());
            });
        });

        oscSuccess = true;
    } catch (err) {
        console.error('[ERROR UDP/OSC]', err.message);
    }

    // Veredicto del Gate 0
    console.log('\n==============================================');
    if (midiSuccess && oscSuccess) {
        console.log('>> RESULTADO GATE 0: APROBADO (PASS)');
        console.log('   Entorno MIDI funcional y sockets UDP operativos.');
    } else {
        console.log('>> RESULTADO GATE 0: FALLIDO (FAIL)');
    }
    console.log('==============================================');

    process.exit(midiSuccess && oscSuccess ? 0 : 1);
}

runDiagnosis();
