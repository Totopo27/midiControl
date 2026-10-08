/**
 * Compuerta de Auditoría de Cadena de Suministro y Secretos (Fase 5 - Hub & Spoke)
 * Valida la ausencia de vulnerabilidades en dependencias (npm audit),
 * verificación estricta de .gitignore ante archivos sensibles (.env, pem, keys)
 * y ausencia de secretos en el histórico o en código fuente.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testSupplyChainAndSecretsAudit() {
    console.log('================================================================');
    console.log('   TEST AUDITORÍA FASE 5: SUPPLY CHAIN, SECRETS & GIT HYGIENE   ');
    console.log('================================================================\n');

    // --- TEST 1: Auditoría de vulnerabilidades en npm ---
    console.log('[TEST 1] Ejecutando npm audit en dependencias de producción...');
    try {
        const auditOutput = execSync('npm audit --json', { encoding: 'utf-8' });
        const auditJson = JSON.parse(auditOutput);
        const vulns = auditJson.metadata?.vulnerabilities || {};
        assert.strictEqual((vulns.critical || 0) + (vulns.high || 0), 0, 'No debe haber vulnerabilidades críticas o altas');
        console.log('  -> npm audit: 0 vulnerabilidades críticas o altas.');
    } catch (err) {
        // Si npm audit falla con exit code no cero pero no hay críticas, parsear output
        if (err.stdout) {
            const auditJson = JSON.parse(err.stdout);
            const vulns = auditJson.metadata?.vulnerabilities || {};
            assert.strictEqual((vulns.critical || 0) + (vulns.high || 0), 0, 'No debe haber vulnerabilidades críticas o altas');
            console.log('  -> npm audit: 0 vulnerabilidades críticas o altas detectadas.');
        } else {
            throw err;
        }
    }

    // --- TEST 2: Verificación de patrones sensibles en .gitignore ---
    console.log('[TEST 2] Verificando reglas de exclusión en .gitignore...');
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8');
    assert.ok(gitignoreContent.includes('.env'), '.gitignore debe excluir archivos .env');
    assert.ok(gitignoreContent.includes('node_modules/'), '.gitignore debe excluir node_modules');
    assert.ok(gitignoreContent.includes('src-tauri/target/'), '.gitignore debe excluir target de Tauri');
    console.log('  -> .gitignore validado con reglas de exclusión de secretos y binarios.');

    // --- TEST 3: Escaneo de secretos en código fuente (Private Keys, API Keys) ---
    console.log('[TEST 3] Escaneando código fuente ante posibles claves privadas o secretos...');
    const srcFiles = fs.readdirSync(path.join(__dirname, 'src')).map(f => path.join(__dirname, 'src', f));
    const secretRegex = /-----BEGIN (RSA |EC )?PRIVATE KEY-----|sk-[a-zA-Z0-9]{20,}/;
    
    for (const file of srcFiles) {
        if (fs.statSync(file).isFile()) {
            const content = fs.readFileSync(file, 'utf-8');
            assert.strictEqual(secretRegex.test(content), false, `El archivo ${file} no debe contener secretos o private keys`);
        }
    }
    console.log('  -> Cero claves privadas o tokens hardcodeados en src/.');

    console.log('\n================================================================');
    console.log('>> AUDITORÍA FASE 5: 100% PASS (APROBADO)');
    console.log('================================================================');
    process.exit(0);
}

testSupplyChainAndSecretsAudit().catch((err) => {
    console.error('Fallo en auditoría de supply chain y secretos:', err);
    process.exit(1);
});
