const { Pool } = require('pg');
const axios = require('axios');

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
    connectionString: 'postgresql://postgres:password@postgres.railway.internal:5432/railway'
});

// URLs de los servidores
const API_SERVERS = {
    'dni-basico': 'https://zgatoodni.up.railway.app',
    'dni-detallado': 'https://zgatoodnit.up.railway.app',
    'certificados': 'https://zgatoocert.up.railway.app',
    'arbol-genealogico': 'https://zgatooarg.up.railway.app',
    'busqueda-nombres': 'https://zgatoonm.up.railway.app'
};

async function syncKeyToAPI(server, apiKey, description, expiresAt, createdBy) {
    try {
        const serverUrl = API_SERVERS[server];
        if (!serverUrl) {
            console.log(`❌ Servidor ${server} no encontrado`);
            return false;
        }

        const response = await axios.post(`${serverUrl}/register-key`, {
            key: apiKey,
            description: description,
            expires_at: expiresAt,
            created_by: createdBy
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`✅ API Key sincronizada en ${server}`);
            return true;
        } else {
            console.log(`❌ Error sincronizando en ${server}: ${response.data.error}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Error conectando con ${server}: ${error.message}`);
        return false;
    }
}

async function syncAllKeys() {
    try {
        console.log('🔄 Sincronizando todas las API Keys...');
        
        const client = await pool.connect();
        
        // Obtener todas las API Keys
        const result = await client.query('SELECT * FROM api_keys ORDER BY created_at DESC');
        const keys = result.rows;
        
        console.log(`📋 Encontradas ${keys.length} API Keys`);
        
        for (const key of keys) {
            console.log(`\n🔑 Sincronizando: ${key.key.substring(0, 8)}...`);
            
            // Sincronizar con todos los servidores
            const servers = Object.keys(API_SERVERS);
            for (const server of servers) {
                await syncKeyToAPI(
                    server,
                    key.key,
                    key.description,
                    key.expires_at,
                    key.created_by
                );
            }
        }
        
        client.release();
        console.log('\n✅ Sincronización completada');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
    } finally {
        await pool.end();
    }
}

// Ejecutar sincronización
syncAllKeys();
