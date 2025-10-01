const { Pool } = require('pg');

// URLs de PostgreSQL para cada servidor
const DATABASES = {
    'dni-basico': 'postgresql://postgres:obhVnLxfoSFQDRtwtSBPayWfuFxGUGFx@yamabiko.proxy.rlwy.net:25975/railway',
    'dni-detallado': 'postgresql://postgres:KtvWiXujOvJYKfgJPMHxGntBaDYHPAXg@yamabiko.proxy.rlwy.net:27118/railway',
    'certificados': 'postgresql://postgres:HwTdcvNsmJyRlcExdwNbjInngGAAnJPA@ballast.proxy.rlwy.net:28072/railway',
    'arbol-genealogico': 'postgresql://postgres:qzvXzemtXvpyZsqIMZaQJrMdmqvrgckT@crossover.proxy.rlwy.net:57036/railway'
};

// API Keys específicas
const API_KEYS = {
    'dni-basico': '77592ecb0f359a9707ac28de9e94a626',
    'dni-detallado': '87e26a59134cfe6176a711f69b0521be',
    'certificados': 'c84548abddf77fee538a3d18e890fc5e',
    'arbol-genealogico': '022fb44acbffc7aedc37c1658af3a4db'
};

async function insertKeyDirectly(serverName, databaseUrl, apiKey) {
    try {
        console.log(`🔄 Insertando en ${serverName}...`);
        
        const pool = new Pool({
            connectionString: databaseUrl
        });
        
        const client = await pool.connect();
        
        // Calcular fecha de expiración (30 días desde ahora)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const timeRemaining = 30 * 24 * 60 * 60; // 30 días en segundos
        
        // Insertar la API Key
        const result = await client.query(`
            INSERT INTO api_keys (key, expires_at, description, created_by, time_remaining)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (key) DO UPDATE SET
                expires_at = EXCLUDED.expires_at,
                description = EXCLUDED.description,
                created_by = EXCLUDED.created_by,
                time_remaining = EXCLUDED.time_remaining
        `, [
            apiKey,
            expiresAt.toISOString(),
            `API Key generada desde panel - ${serverName}`,
            'zGatoO',
            timeRemaining
        ]);
        
        client.release();
        await pool.end();
        
        console.log(`✅ ${serverName}: API Key insertada correctamente`);
        console.log(`   Key: ${apiKey.substring(0, 8)}...`);
        console.log(`   Expira: ${expiresAt.toLocaleString()}`);
        return true;
        
    } catch (error) {
        console.log(`❌ ${serverName}: Error - ${error.message}`);
        return false;
    }
}

async function insertAllKeys() {
    console.log('🚀 Insertando API Keys directamente en PostgreSQL...\n');
    
    let successCount = 0;
    const totalServers = Object.keys(API_KEYS).length;
    
    for (const [serverName, apiKey] of Object.entries(API_KEYS)) {
        const databaseUrl = DATABASES[serverName];
        if (databaseUrl) {
            const success = await insertKeyDirectly(serverName, databaseUrl, apiKey);
            if (success) successCount++;
            console.log(''); // Línea en blanco
        } else {
            console.log(`❌ ${serverName}: URL de base de datos no encontrada`);
        }
    }
    
    console.log(`📊 Resultado final: ${successCount}/${totalServers} servidores actualizados`);
    
    if (successCount === totalServers) {
        console.log('🎉 ¡Todas las API Keys insertadas exitosamente!');
    } else {
        console.log('⚠️  Algunos servidores fallaron. Revisa los errores arriba.');
    }
}

// Ejecutar inserción
insertAllKeys();
