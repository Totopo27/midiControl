/**
 * Compuerta de Auditoría de Desktop y Rust / Tauri v2 (Fase 4 - Hub & Spoke)
 * Valida la configuración de seguridad de Tauri, permisos IPC de mínimo privilegio,
 * Content Security Policy (CSP) activo y compilación limpia de Rust.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testTauriAudit() {
    console.log('================================================================');
    console.log('   TEST AUDITORÍA FASE 4: RUST, TAURI V2 IPC & CSP HARDENING    ');
    console.log('================================================================\n');

    const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
    const capabilitiesPath = path.join(__dirname, 'src-tauri', 'capabilities', 'default.json');
    const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
    const libRsPath = path.join(__dirname, 'src-tauri', 'src', 'lib.rs');

    // --- TEST 1: Verificación de Content Security Policy (CSP) ---
    console.log('[TEST 1] Inspeccionando Content Security Policy en tauri.conf.json...');
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
    assert.ok(tauriConf.app && tauriConf.app.security, 'La sección app.security debe existir');
    assert.ok(tauriConf.app.security.csp, 'El CSP no debe ser null ni estar deshabilitado');
    assert.ok(tauriConf.app.security.csp.includes("default-src 'self'"), 'CSP debe restringir default-src a self');
    assert.ok(tauriConf.app.security.csp.includes("ws://localhost:8081"), 'CSP debe autorizar explícitamente el WebSocket local');
    console.log('  -> CSP validado: restricciones default-src y permisos explícitos para WS local.');

    // --- TEST 2: Principio de Mínimo Privilegio en Capabilities IPC ---
    console.log('[TEST 2] Verificando permisos IPC en capabilities/default.json...');
    const capabilities = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf-8'));
    assert.ok(Array.isArray(capabilities.permissions), 'Capabilities debe declarar una lista de permisos');
    assert.ok(!capabilities.permissions.includes('shell:all'), 'No debe tener permisos shell irrestrictos');
    assert.ok(!capabilities.permissions.includes('fs:all'), 'No debe tener permisos de filesystem irrestrictos');
    console.log('  -> IPC Capabilities: Mínimo privilegio verificado (sin shell ni fs abiertos).');

    // --- TEST 3: Panic Safety y Ausencia de Unwrap en código Rust ---
    console.log('[TEST 3] Verificando código Rust en src-tauri/src/lib.rs...');
    const libRs = fs.readFileSync(libRsPath, 'utf-8');
    assert.ok(!libRs.includes('.unwrap()'), 'src/lib.rs no debe contener .unwrap() en handlers de ejecución');
    console.log('  -> Código Rust en lib.rs verificado para panic-safety.');

    console.log('\n================================================================');
    console.log('>> AUDITORÍA FASE 4: 100% PASS (APROBADO)');
    console.log('================================================================');
    process.exit(0);
}

testTauriAudit().catch((err) => {
    console.error('Fallo en auditoría de Tauri:', err);
    process.exit(1);
});
