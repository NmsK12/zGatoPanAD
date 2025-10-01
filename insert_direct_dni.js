const { Pool } = require('pg');

// URL de PostgreSQL del servidor DNI
const DATABASE_URL = 'postgresql://postgres:obhVnLxfoSFQDRtwtSBPayWfuFxGUGFx@yamabiko.proxy.rlwy.net:25975/railway';

async function insertKeyDirectly() {
    try {
        console.log('🔄 Insertando API Key directamente en PostgreSQL del servidor DNI...');
        
        const pool = new Pool({
            connectionString: DATABASE_URL
        });
        
        const client = await pool.connect();
        
        // Calcular fecha de expiración (30 días desde ahora)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const timeRemaining = 30 * 24 * 60 * 60; // 30 días en segundos
        
        // API Key de prueba
        const apiKey = 'test-key-from-panel-123456789';
        
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
            'API Key de prueba desde panel',
            'zGatoO',
            timeRemaining
        ]);
        
        client.release();
        await pool.end();
        
        console.log('✅ API Key insertada correctamente en PostgreSQL del servidor DNI');
        console.log(`   Key: ${apiKey}`);
        console.log(`   Expira: ${expiresAt.toLocaleString()}`);
        
        // Ahora probar la API Key
        console.log('\n🔄 Probando la API Key...');
        const axios = require('axios');
        const response = await axios.get(`https://zgatoodni.up.railway.app/dniresult?dni=12345678&key=${apiKey}`);
        console.log('Respuesta de la API:', response.data);
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

insertKeyDirectly();
