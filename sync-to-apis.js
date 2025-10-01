const { Pool } = require('pg');
const axios = require('axios');

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:LrfDsLXjIFJgcdwpWHKYATXNjXHmnpCX@nozomi.proxy.rlwy.net:46397/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

// Configuración de las APIs
const API_SERVERS = {
    'dni-basico': 'https://zgatoodni.up.railway.app',
    'dni-detallado': 'https://zgatoodnit.up.railway.app',
    'certificados': 'https://zgatoocert.up.railway.app',
    'arbol-genealogico': 'https://zgatooarg.up.railway.app'
};

async function syncKeyToAPI(serverKey, apiUrl, apiKey, description, expiresAt) {
    try {
        console.log(`Sincronizando key ${apiKey} a ${serverKey}...`);
        
        // Hacer POST a la API para registrar la key
        const response = await axios.post(`${apiUrl}/register-key`, {
            key: apiKey,
            description: description,
            expires_at: expiresAt
        }, {
            timeout: 10000
        });
        
        if (response.data.success) {
            console.log(`✅ Key sincronizada en ${serverKey}`);
        } else {
            console.log(`❌ Error sincronizando ${serverKey}: ${response.data.error}`);
        }
        
    } catch (error) {
        console.log(`❌ Error conectando a ${serverKey}: ${error.message}`);
    }
}

async function syncAllKeys() {
    console.log('🔄 Iniciando sincronización de API Keys a las APIs...');
    
    try {
        const client = await pool.connect();
        
        // Obtener todas las keys activas
        const result = await client.query(`
            SELECT server, key, description, expires_at
            FROM api_keys 
            WHERE expires_at > NOW()
            ORDER BY created_at DESC
        `);
        
        client.release();
        
        console.log(`Encontradas ${result.rows.length} API Keys activas`);
        
        // Sincronizar cada key con su API correspondiente
        for (const key of result.rows) {
            const apiUrl = API_SERVERS[key.server];
            if (apiUrl) {
                await syncKeyToAPI(key.server, apiUrl, key.key, key.description, key.expires_at);
            }
        }
        
        console.log('✅ Sincronización completada');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    syncAllKeys().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = { syncAllKeys, syncKeyToAPI };
