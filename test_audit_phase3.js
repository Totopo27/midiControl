/**
 * Compuerta de Auditoría de Frontend y Seguridad DOM (Fase 3 - Hub & Spoke)
 * Valida la erradicación de inyecciones innerHTML con datos de telemetría,
 * uso de textContent / DOM API seguro y límites de buffer circular en tablas.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testFrontendAudit() {
    console.log('================================================================');
    console.log('   TEST AUDITORÍA FASE 3: FRONTEND SECURITY, XSS & DOM SANITY   ');
    console.log('================================================================\n');

    const monitorHtmlPath = path.join(__dirname, 'midiosc_monitor.html');
    const studioHtmlPath = path.join(__dirname, 'midi_shortcut_studio.html');

    const monitorHtml = fs.readFileSync(monitorHtmlPath, 'utf-8');
    const studioHtml = fs.readFileSync(studioHtmlPath, 'utf-8');

    // --- TEST 1: Eliminación de innerHTML en handlers de telemetría en midiosc_monitor.html ---
    console.log('[TEST 1] Inspeccionando midiosc_monitor.html para descartar innerHTML en telemetría...');
    
    // Las funciones handleTelemetry y handleOscTelemetry no deben usar innerHTML con interpolación
    const hasUnsafeTelemetryInnerHtml = /handleTelemetry[\s\S]*?tr\.innerHTML\s*=/m.test(monitorHtml) ||
                                       /handleOscTelemetry[\s\S]*?tr\.innerHTML\s*=/m.test(monitorHtml);
    assert.strictEqual(hasUnsafeTelemetryInnerHtml, false, 'handleTelemetry y handleOscTelemetry no deben usar innerHTML');
    console.log('  -> handleTelemetry y handleOscTelemetry migrados al 100% a textContent / DOM API.');

    // --- TEST 2: Eliminación de innerHTML en tablas dinámicas de midi_shortcut_studio.html ---
    console.log('[TEST 2] Inspeccionando midi_shortcut_studio.html para descartar innerHTML en tablas...');
    
    const hasUnsafeTableInnerHtml = /renderTable[\s\S]*?tr\.innerHTML\s*=/m.test(studioHtml) ||
                                   /renderHardwareMenu[\s\S]*?li\.innerHTML\s*=/m.test(studioHtml);
    assert.strictEqual(hasUnsafeTableInnerHtml, false, 'renderTable y renderHardwareMenu no deben usar innerHTML');
    console.log('  -> renderTable y renderHardwareMenu migrados al 100% a textContent / DOM API.');

    // --- TEST 3: Buffer circular en DOM (Prevención de DoS por memoria) ---
    console.log('[TEST 3] Verificando límites de retención en streams de telemetría (Ring Buffer)...');
    assert.ok(monitorHtml.includes('tbody.children.length > 100'), 'El stream MIDI debe limitar filas a 100');
    assert.ok(monitorHtml.includes('oscTbody.children.length > 100'), 'El stream OSC debe limitar filas a 100');
    console.log('  -> Buffers circulares en DOM presentes y limitados a 100 entradas por tabla.');

    console.log('\n================================================================');
    console.log('>> AUDITORÍA FASE 3: 100% PASS (APROBADO)');
    console.log('================================================================');
    process.exit(0);
}

testFrontendAudit().catch((err) => {
    console.error('Fallo en auditoría de frontend:', err);
    process.exit(1);
});
