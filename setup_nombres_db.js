const { Pool } = require('pg');

// URL de PostgreSQL para nombres
const NOMBRES_DB_URL = 'postgresql://postgres:yrgxHVIPjGFTNBQXTLiDltHAzFkaNCUr@gondola.proxy.rlwy.net:49761/railway';

async function setupNombresDatabase() {
    console.log('🔍 Verificando base de datos de nombres...');
    
    try {
        const pool = new Pool({
            connectionString: NOMBRES_DB_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await pool.connect();
        console.log('✅ Conectado a la base de datos de nombres');
        
        // Verificar si existe la tabla api_keys
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'api_keys'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('📝 Creando tabla api_keys en nombres...');
            
            // Crear tabla api_keys
            await client.query(`
                CREATE TABLE api_keys (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(50) NOT NULL,
                    usage_count INTEGER DEFAULT 0,
                    last_used TIMESTAMP,
                    time_remaining INTEGER DEFAULT 0
                );
            `);
            
            console.log('✅ Tabla api_keys creada en nombres');
        } else {
            console.log('✅ Tabla api_keys ya existe en nombres');
        }
        
        // Verificar estructura de la tabla
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'api_keys'
            ORDER BY ordinal_position;
        `);
        
        console.log('📋 Estructura de la tabla api_keys:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Probar inserción de una key de prueba
        const testKey = 'test_' + Date.now();
        console.log(`🧪 Probando inserción con key: ${testKey}`);
        
        await client.query(`
            INSERT INTO api_keys (key, description, expires_at, created_by, time_remaining)
            VALUES ($1, $2, $3, $4, $5)
        `, [testKey, 'Test key', new Date(Date.now() + 3600000), 'admin', 3600]);
        
        console.log('✅ Inserción de prueba exitosa');
        
        // Limpiar key de prueba
        await client.query('DELETE FROM api_keys WHERE key = $1', [testKey]);
        console.log('🧹 Key de prueba eliminada');
        
        client.release();
        await pool.end();
        
        console.log('🎉 Base de datos de nombres configurada correctamente');
        
    } catch (error) {
        console.error('❌ Error configurando base de datos de nombres:', error.message);
        console.error('Detalles:', error);
    }
}

setupNombresDatabase();
