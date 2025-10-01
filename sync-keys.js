const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Configuración de servidores
const SERVERS = {
    'dni-basico': 'https://zgatoo1.up.railway.app',
    'dni-detallado': 'https://zgatoo2.up.railway.app', 
    'certificados': 'https://zgatoo3.up.railway.app',
    'arbol-genealogico': 'https://zgatoo4.up.railway.app'
};

const db = new sqlite3.Database('admin.db');

async function syncKeysToServer(serverKey, serverUrl) {
    console.log(`Sincronizando keys para ${serverKey}...`);
    
    // Obtener keys activas del panel
    const keys = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM api_keys WHERE server = ? AND expires_at > datetime('now')`, 
            [serverKey], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
    });
    
    console.log(`Encontradas ${keys.length} keys activas para ${serverKey}`);
    
    // Sincronizar cada key con el servidor
    for (const key of keys) {
        try {
            // Aquí podrías hacer una llamada HTTP al servidor para sincronizar
            // Por ahora solo mostramos la información
            console.log(`Key: ${key.key} - Expira: ${key.expires_at}`);
        } catch (error) {
            console.error(`Error sincronizando key ${key.key}:`, error.message);
        }
    }
}

async function main() {
    console.log('🔄 Iniciando sincronización de API Keys...');
    
    for (const [serverKey, serverUrl] of Object.entries(SERVERS)) {
        try {
            await syncKeysToServer(serverKey, serverUrl);
        } catch (error) {
            console.error(`Error sincronizando ${serverKey}:`, error.message);
        }
    }
    
    console.log('✅ Sincronización completada');
    db.close();
}

if (require.main === module) {
    main();
}

module.exports = { syncKeysToServer, SERVERS };
