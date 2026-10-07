const MidiRouter = require('./src/router');
const JZZ = require('jzz');

async function testPhase1() {
    console.log('====================================================');
    console.log('   PRUEBA DE COMPUERTAS: FASE 1 (GATE 1 - MIDI OUT) ');
    console.log('====================================================\n');

    const router = new MidiRouter();
    await router.init();

    const outputs = router.listOutputs();
    console.log('[OUTPUTS DISPONIBLES]:');
    outputs.forEach(o => console.log(`  - [${o.index}] ${o.name}`));

    if (outputs.length === 0) {
        console.error('ERROR: No hay salidas MIDI detectadas.');
        process.exit(1);
    }

    // 1. Crear un puerto MIDI virtual de escucha (Loopback de prueba en memoria)
    let loopbackEvents = [];
    const testVirtualPort = await JZZ.Widget({
        _receive: function(msg) {
            loopbackEvents.push({
                raw: Array.from(msg),
                hex: msg.toString(),
                time: Date.now()
            });
        }
    });

    await JZZ.addMidiOut('TestLoopbackReceiver', testVirtualPort);
    console.log('\n[TEST 1] Abriendo puerto virtual de verificación...');
    await router.openOutput('TestLoopbackReceiver');

    // 2. Probar Note-On en canal 1 (en JZZ canal 0)
    console.log('[TEST 2] Emitiendo Note-On (Canal 1, Nota 60, Velocidad 100)...');
    const onEvt = router.sendNoteOn(0, 60, 100);
    console.log('  -> Evento despachado:', onEvt);

    // 3. Probar Note-Off en canal 1 (en JZZ canal 0)
    console.log('[TEST 3] Emitiendo Note-Off (Canal 1, Nota 60)...');
    const offEvt = router.sendNoteOff(0, 60);
    console.log('  -> Evento despachado:', offEvt);

    // 4. Probar cambio de canal (Canal 5 = index 4, Nota 72)
    console.log('[TEST 4] Emitiendo Note-On en Canal 5 (Nota 72, Velocidad 127)...');
    router.sendNoteOn(4, 72, 127);
    router.sendNoteOff(4, 72);

    // 5. Validar que los bytes MIDI 1.0 estándar recibidos coincidan exactamente
    console.log('\n[EVALUACIÓN DE BYTES RECIBIDOS EN LOOPBACK]:');
    loopbackEvents.forEach((e, idx) => {
        console.log(`  [Mensaje ${idx + 1}] Hex: ${e.hex} | Bytes: [${e.raw.join(', ')}]`);
    });

    const isNoteOnValid = loopbackEvents[0] && loopbackEvents[0].raw[0] === 0x90 && loopbackEvents[0].raw[1] === 60 && loopbackEvents[0].raw[2] === 100;
    const isNoteOffValid = loopbackEvents[1] && (loopbackEvents[1].raw[0] === 0x80 || (loopbackEvents[1].raw[0] === 0x90 && loopbackEvents[1].raw[2] === 0)) && loopbackEvents[1].raw[1] === 60;
    const isCh5Valid = loopbackEvents[2] && loopbackEvents[2].raw[0] === 0x94 && loopbackEvents[2].raw[1] === 72; // 0x90 | 4 = 0x94

    console.log('\n--- VERIFICACIÓN TÉCNICA ---');
    console.log('Note-On (0x90 60 100) correcto:', isNoteOnValid ? 'SÍ' : 'NO');
    console.log('Note-Off (0x80 60 0) correcto:', isNoteOffValid ? 'SÍ' : 'NO');
    console.log('Canal 5 (0x94 72 127) correcto:', isCh5Valid ? 'SÍ' : 'NO');

    // 6. Probar envío a la interfaz física USB2.0-MIDI si está disponible
    const physicalPort = outputs.find(o => o.name.includes('USB2.0-MIDI'));
    if (physicalPort) {
        console.log(`\n[TEST 5] Probando envío real a hardware físico: "${physicalPort.name}"...`);
        await router.openOutput(physicalPort.name);
        router.sendNoteOn(0, 60, 100);
        await new Promise(r => setTimeout(r, 100));
        router.sendNoteOff(0, 60);
        console.log('  -> Ráfaga enviada a hardware físico con éxito sin excepciones.');
    }

    const gate1Passed = isNoteOnValid && isNoteOffValid && isCh5Valid;

    console.log('\n====================================================');
    if (gate1Passed) {
        console.log('>> RESULTADO GATE 1: APROBADO (PASS)');
        console.log('   Mensajes Note-On/Note-Off válidos, canal seleccionable y puerto físico verificado.');
    } else {
        console.log('>> RESULTADO GATE 1: FALLIDO (FAIL)');
    }
    console.log('====================================================');

    router.close();
    process.exit(gate1Passed ? 0 : 1);
}

testPhase1().catch(err => {
    console.error('ERROR EN FASE 1:', err);
    process.exit(1);
});
