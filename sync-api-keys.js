const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuración de servidores
const SERVERS = {
    'dni-basico': {
        name: 'DNI Básico',
        url: 'https://zgatoodni.up.railway.app',
        localPath: '../dni-server'
    },
    'dni-detallado': {
        name: 'DNI Detallado', 
        url: 'https://zgatoodnit.up.railway.app',
        localPath: '../dnit-server'
    },
    'certificados': {
        name: 'Certificados',
        url: 'https://zgatoocert.up.railway.app',
        localPath: '../certificados-server'
    },
    'arbol-genealogico': {
        name: 'Árbol Genealógico',
        url: 'https://zgatooarg.up.railway.app',
        localPath: '../arbol-server'
    }
};

// Base de datos del panel
const panelDb = new sqlite3.Database('admin.db');

async function syncKeyToServer(serverKey, serverInfo, apiKey, description, expiresAt, createdBy) {
    console.log(`Sincronizando key para ${serverInfo.name}...`);
    
    try {
        // Crear base de datos local del servidor
        const serverDbPath = path.join(serverInfo.localPath, 'api_keys.db');
        const serverDb = new sqlite3.Database(serverDbPath);
        
        // Crear tabla si no existe
        serverDb.run(`
            CREATE TABLE IF NOT EXISTS api_keys (
                key TEXT PRIMARY KEY,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT DEFAULT '',
                last_used TIMESTAMP NULL,
                usage_count INTEGER DEFAULT 0
            )
        `);
        
        // Insertar la API Key
        serverDb.run(`
            INSERT OR REPLACE INTO api_keys (key, expires_at, description, created_at)
            VALUES (?, ?, ?, ?)
        `, [apiKey, expiresAt, description, new Date().toISOString()], function(err) {
            if (err) {
                console.error(`Error insertando key en ${serverInfo.name}:`, err);
            } else {
                console.log(`✅ Key sincronizada en ${serverInfo.name}`);
            }
        });
        
        serverDb.close();
        
    } catch (error) {
        console.error(`Error sincronizando ${serverInfo.name}:`, error.message);
    }
}

async function syncAllKeys() {
    console.log('🔄 Iniciando sincronización de API Keys...');
    
    try {
        // Obtener todas las keys del panel
        const keys = await new Promise((resolve, reject) => {
            panelDb.all(`SELECT * FROM api_keys ORDER BY created_at DESC`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`Encontradas ${keys.length} API Keys en el panel`);
        
        // Sincronizar cada key con todos los servidores
        for (const key of keys) {
            console.log(`\nSincronizando key: ${key.key}`);
            console.log(`Descripción: ${key.description}`);
            console.log(`Expira: ${key.expires_at}`);
            
            for (const [serverKey, serverInfo] of Object.entries(SERVERS)) {
                if (key.server === serverKey) {
                    await syncKeyToServer(serverKey, serverInfo, key.key, key.description, key.expires_at, key.created_by);
                }
            }
        }
        
        console.log('\n✅ Sincronización completada');
        
    } catch (error) {
        console.error('Error en sincronización:', error);
    } finally {
        panelDb.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    syncAllKeys();
}

module.exports = { syncAllKeys, syncKeyToServer };
