const axios = require('axios');

// API Keys específicas para cada servidor
const API_KEYS = {
    'dni-basico': {
        key: '77592ecb0f359a9707ac28de9e94a626',
        url: 'https://zgatoodni.up.railway.app',
        name: 'DNI Básico'
    },
    'dni-detallado': {
        key: '87e26a59134cfe6176a711f69b0521be',
        url: 'https://zgatoodnit.up.railway.app',
        name: 'DNI Detallado'
    },
    'certificados': {
        key: 'c84548abddf77fee538a3d18e890fc5e',
        url: 'https://zgatoocert.up.railway.app',
        name: 'Certificados'
    },
    'arbol-genealogico': {
        key: '022fb44acbffc7aedc37c1658af3a4db',
        url: 'https://zgatooarg.up.railway.app',
        name: 'Árbol Genealógico'
    }
};

async function syncKeyToServer(serverKey, serverData) {
    try {
        console.log(`🔄 Sincronizando ${serverData.name}...`);
        
        // Calcular fecha de expiración (30 días desde ahora)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const response = await axios.post(`${serverData.url}/register-key`, {
            key: serverData.key,
            description: `API Key generada desde panel - ${serverData.name}`,
            expires_at: expiresAt.toISOString(),
            created_by: 'zGatoO'
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`✅ ${serverData.name}: API Key sincronizada correctamente`);
            console.log(`   Key: ${serverData.key.substring(0, 8)}...`);
            console.log(`   Expira: ${expiresAt.toLocaleString()}`);
            return true;
        } else {
            console.log(`❌ ${serverData.name}: Error - ${response.data.error}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${serverData.name}: Error de conexión - ${error.message}`);
        return false;
    }
}

async function syncAllKeys() {
    console.log('🚀 Iniciando sincronización manual de API Keys...\n');
    
    let successCount = 0;
    const totalServers = Object.keys(API_KEYS).length;
    
    for (const [serverKey, serverData] of Object.entries(API_KEYS)) {
        const success = await syncKeyToServer(serverKey, serverData);
        if (success) successCount++;
        console.log(''); // Línea en blanco para separar
    }
    
    console.log(`📊 Resultado final: ${successCount}/${totalServers} servidores sincronizados correctamente`);
    
    if (successCount === totalServers) {
        console.log('🎉 ¡Todas las API Keys sincronizadas exitosamente!');
    } else {
        console.log('⚠️  Algunos servidores fallaron. Revisa los errores arriba.');
    }
}

// Ejecutar sincronización
syncAllKeys();
