const axios = require('axios');

// API Key que quieres sincronizar
const API_KEY = '871e17ede0c3222ddcfe8aedee6cefce';
const DESCRIPTION = 'API Key generada desde panel';
const CREATED_BY = 'zGatoO';

// Calcular fecha de expiración (30 días desde ahora)
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

async function registerKeyInServer(serverName, serverUrl) {
    try {
        console.log(`🔄 Registrando en ${serverName}...`);
        
        const response = await axios.post(`${serverUrl}/register-key`, {
            key: API_KEY,
            description: DESCRIPTION,
            expires_at: expiresAt.toISOString(),
            created_by: CREATED_BY
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`✅ API Key registrada en ${serverName}`);
            return true;
        } else {
            console.log(`❌ Error en ${serverName}: ${response.data.error}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Error conectando con ${serverName}: ${error.message}`);
        return false;
    }
}

async function registerInAllServers() {
    const servers = [
        { name: 'DNI Básico', url: 'https://zgatoodni.up.railway.app' },
        { name: 'DNI Detallado', url: 'https://zgatoodnit.up.railway.app' },
        { name: 'Certificados', url: 'https://zgatoocert.up.railway.app' },
        { name: 'Árbol Genealógico', url: 'https://zgatooarg.up.railway.app' },
        { name: 'Búsqueda por Nombres', url: 'https://zgatoonm.up.railway.app' }
    ];

    console.log(`🔑 Registrando API Key: ${API_KEY.substring(0, 8)}...`);
    console.log(`📅 Expira: ${expiresAt.toLocaleString()}`);
    console.log(`👤 Creada por: ${CREATED_BY}\n`);

    let successCount = 0;
    for (const server of servers) {
        const success = await registerKeyInServer(server.name, server.url);
        if (success) successCount++;
    }

    console.log(`\n📊 Resultado: ${successCount}/${servers.length} servidores actualizados`);
}

// Ejecutar registro
registerInAllServers();
