const { Pool } = require('pg');
const crypto = require('crypto');

// URL de PostgreSQL para DNI
const DNI_DATABASE_URL = 'postgresql://postgres:obhVnLxfoSFQDRtwtSBPayWfuFxGUGFx@yamabiko.proxy.rlwy.net:25975/railway';

// URL de PostgreSQL para Admin Panel
const ADMIN_DATABASE_URL = 'postgresql://postgres:LrfDsLXjIFJgcdwpWHKYATXNjXHmnpCX@nozomi.proxy.rlwy.net:46397/railway';

async function createDNIKey() {
    const pool = new Pool({
        connectionString: DNI_DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔗 Conectando a la base de datos de DNI...');
        
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL DNI');

        // Generar API Key
        const apiKey = crypto.randomBytes(16).toString('hex');
        console.log('🔑 API Key generada:', apiKey);

        // Calcular fecha de expiración (2 horas desde ahora)
        const expiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 horas
        console.log('⏰ Expira en:', expiresAt.toISOString());

        // Insertar en la base de datos DNI (con time_remaining)
        const timeRemaining = 2 * 60 * 60; // 2 horas en segundos
        const result = await client.query(`
            INSERT INTO api_keys (key, expires_at, description, last_used, usage_count, created_by, time_remaining) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            apiKey,        // key
            expiresAt.toISOString(),  // expires_at
            'API Key de prueba - 2 horas',  // description
            null,          // last_used
            0,             // usage_count
            'zGatoO',      // created_by
            timeRemaining  // time_remaining
        ]);

        client.release();
        
        console.log('✅ API Key creada exitosamente!');
        console.log('📋 Detalles:');
        console.log('   - Key:', apiKey);
        console.log('   - Servidor: DNI Básico');
        console.log('   - Descripción: API Key de prueba - 2 horas');
        console.log('   - Creada por: zGatoO');
        console.log('   - Expira:', expiresAt.toLocaleString());
        
        console.log('\n🌐 URL de prueba:');
        console.log(`https://zgatoodni.up.railway.app/dniresult?dni=12345678&key=${apiKey}`);
        
        // También insertar en el panel de administración
        console.log('\n🔄 Insertando en panel de administración...');
        await insertInAdminPanel(apiKey, expiresAt);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

async function insertInAdminPanel(apiKey, expiresAt) {
    const adminPool = new Pool({
        connectionString: ADMIN_DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        const client = await adminPool.connect();
        
        const result = await client.query(`
            INSERT INTO api_keys (server, key, description, expires_at, created_by, usage_count, last_used) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            'dni-basico',  // server
            apiKey,        // key
            'API Key de prueba - 2 horas',  // description
            expiresAt.toISOString(),  // expires_at
            'zGatoO',      // created_by
            0,             // usage_count
            null           // last_used
        ]);

        client.release();
        console.log('✅ También insertada en panel de administración');
        
    } catch (error) {
        console.error('⚠️ Error insertando en panel admin:', error.message);
    } finally {
        await adminPool.end();
    }
}

// Ejecutar
createDNIKey();
