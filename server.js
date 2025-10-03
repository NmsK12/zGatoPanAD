const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const moment = require('moment');

// Configuración de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configurar sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'wolfdata-admin-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:LrfDsLXjIFJgcdwpWHKYATXNjXHmnpCX@nozomi.proxy.rlwy.net:46397/railway',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// URLs de PostgreSQL para cada servidor
const DATABASE_URLS = {
    'dni-basico': 'postgresql://postgres:obhVnLxfoSFQDRtwtSBPayWfuFxGUGFx@yamabiko.proxy.rlwy.net:25975/railway',
    'dni-detallado': 'postgresql://postgres:KtvWiXujOvJYKfgJPMHxGntBaDYHPAXg@yamabiko.proxy.rlwy.net:27118/railway',
    'busqueda-nombres': 'postgresql://postgres:yrgxHVIPjGFTNBQXTLiDltHAzFkaNCUr@gondola.proxy.rlwy.net:49761/railway',
    'certificados': 'postgresql://postgres:HwTdcvNsmJyRlcExdwNbjInngGAAnJPA@ballast.proxy.rlwy.net:28072/railway',
    'arbol-genealogico': 'postgresql://postgres:qzvXzemtXvpyZsqIMZaQJrMdmqvrgckT@crossover.proxy.rlwy.net:57036/railway'
};

// Configuración de servidores API
const API_SERVERS = {
    'dni': {
        name: '/dni',
        description: 'DNI Básico',
        url: 'https://zgatoodni.up.railway.app',
        color: '#3498db',
        dbName: 'dni-basico'
    },
    'dnit': {
        name: '/dnit',
        description: 'DNI Detallado',
        url: 'https://zgatoodnit.up.railway.app',
        color: '#e74c3c',
        dbName: 'dni-detallado'
    },
    'nombres': {
        name: '/nombres',
        description: 'Búsqueda por Nombres',
        url: 'https://zgatoonm.up.railway.app',
        color: '#9b59b6',
        dbName: 'busqueda-nombres'
    },
    'certificados': {
        name: '/certificados',
        description: 'Certificados',
        url: 'https://zgatoocert.up.railway.app',
        color: '#f39c12',
        dbName: 'certificados'
    },
    'arbol': {
        name: '/arbol',
        description: 'Árbol Genealógico',
        url: 'https://zgatooarg.up.railway.app',
        color: '#9b59b6',
        dbName: 'arbol-genealogico'
    }
};

// Función para formatear tiempo restante
function formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Expirada';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Función para sincronizar API Key con la API correspondiente
async function syncKeyToAPI(serverKey, apiKey, description, expiresAt) {
    try {
        console.log(`🔄 Sincronizando key ${apiKey} con ${serverKey}...`);
        
        const databaseUrl = DATABASE_URLS[serverKey];
        if (!databaseUrl) {
            console.log(`❌ URL de base de datos no encontrada para ${serverKey}`);
            return;
        }
        
        // Insertar directamente en PostgreSQL
        const { Pool } = require('pg');
        const apiPool = new Pool({ 
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await apiPool.connect();
        
        // Insertar en la base de datos del servidor
        await client.query(`
            INSERT INTO api_keys (key, description, expires_at, created_by, time_remaining)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (key) DO UPDATE SET
                description = EXCLUDED.description,
                expires_at = EXCLUDED.expires_at,
                created_by = EXCLUDED.created_by,
                time_remaining = EXCLUDED.time_remaining
        `, [apiKey, description, expiresAt, 'admin', 0]);
        
        client.release();
        await apiPool.end();
        
        console.log(`✅ Key ${apiKey} sincronizada con ${serverKey}`);
    } catch (error) {
        console.error(`❌ Error sincronizando key con ${serverKey}:`, error.message);
    }
}

// Función para sincronizar eliminación de API Key
async function syncKeyDeletionToAPI(serverKey, apiKey) {
    try {
        console.log(`🗑️ Eliminando key ${apiKey} de ${serverKey}...`);
        
        const databaseUrl = DATABASE_URLS[serverKey];
        if (!databaseUrl) {
            console.log(`❌ URL de base de datos no encontrada para ${serverKey}`);
            return;
        }
        
        const { Pool } = require('pg');
        const apiPool = new Pool({ 
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await apiPool.connect();
        
        // Eliminar de la base de datos del servidor
        await client.query('DELETE FROM api_keys WHERE key = $1', [apiKey]);
        
        client.release();
        await apiPool.end();
        
        console.log(`✅ Key ${apiKey} eliminada de ${serverKey}`);
    } catch (error) {
        console.error(`❌ Error eliminando key de ${serverKey}:`, error.message);
    }
}

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        // Si es una petición AJAX, devolver error 401
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        // Si no es AJAX, redirigir al login
        res.redirect('/login');
    }
};

// Inicializar base de datos
async function initDatabase() {
    try {
        const client = await pool.connect();
        
        // Crear tabla de usuarios si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Crear tabla de API keys si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                server VARCHAR(50) NOT NULL,
                key VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(50) NOT NULL,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP
            )
        `);
        
        // Crear usuario admin por defecto si no existe
        const adminExists = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
        if (adminExists.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await client.query(
                'INSERT INTO users (username, password) VALUES ($1, $2)',
                ['admin', hashedPassword]
            );
            console.log('✅ Usuario admin creado con contraseña: admin123');
        }
        
        client.release();
        console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
    }
}

// Rutas
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT id, username, password FROM users WHERE username = $1',
            [username]
        );
        client.release();
        
        if (result.rows.length === 0) {
            return res.render('login', { error: 'Usuario no encontrado' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.render('login', { error: 'Contraseña incorrecta' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en login:', error);
        res.render('login', { error: 'Error interno del servidor' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const client = await pool.connect();
        
        // Obtener estadísticas de API keys por servidor
        const stats = {};
        for (const [serverKey, serverInfo] of Object.entries(API_SERVERS)) {
            const result = await client.query(
                'SELECT COUNT(*) as total FROM api_keys WHERE server = $1',
                [serverInfo.dbName]
            );
            stats[serverKey] = {
                total: parseInt(result.rows[0].total),
                ...serverInfo
            };
        }
        
        // Obtener total de usuarios
        const userResult = await client.query('SELECT COUNT(*) as total FROM users');
        const totalUsers = parseInt(userResult.rows[0].total);
        
        client.release();
        
        res.render('dashboard', {
            title: 'Dashboard',
            username: req.session.username,
            stats,
            totalUsers,
            servers: API_SERVERS
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/api-keys/:server', requireAuth, async (req, res) => {
    const { server } = req.params;
    
    if (!API_SERVERS[server]) {
        return res.status(404).send('Servidor no encontrado');
    }
    
    try {
        const client = await pool.connect();
        const dbServerName = API_SERVERS[server].dbName;
        
        const result = await client.query(`
            SELECT 
                id,
                key,
                description,
                expires_at,
                created_at,
                created_by,
                usage_count,
                last_used,
                EXTRACT(EPOCH FROM (expires_at - NOW()))::INTEGER as time_remaining_seconds
            FROM api_keys 
            WHERE server = $1 
            ORDER BY created_at DESC
        `, [dbServerName]);
        
        const keys = result.rows.map(key => ({
            ...key,
            time_remaining: formatTimeRemaining(key.time_remaining_seconds),
            can_delete: key.created_by === req.session.username || req.session.username === 'zGatoO'
        }));
        
        client.release();
        
        res.render('api-keys', {
            title: `API Keys - ${API_SERVERS[server].description}`,
            username: req.session.username,
            server: server,
            serverInfo: API_SERVERS[server],
            keys
        });
    } catch (error) {
        console.error('Error obteniendo API keys:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.post('/api-keys/:server/generate', requireAuth, async (req, res) => {
    const { server } = req.params;
    const { description, timeValue, timeUnit } = req.body;
    
    if (!API_SERVERS[server]) {
        return res.status(404).json({ error: 'Servidor no encontrado' });
    }
    
    try {
        // Generar API key
        const apiKey = require('crypto').randomBytes(32).toString('hex');
        
        // Calcular tiempo de expiración
        const timeValueNum = parseInt(timeValue);
        let expiresAt = new Date();
        
        switch (timeUnit) {
            case 'minutes':
                expiresAt.setMinutes(expiresAt.getMinutes() + timeValueNum);
                break;
            case 'hours':
                expiresAt.setHours(expiresAt.getHours() + timeValueNum);
                break;
            case 'days':
                expiresAt.setDate(expiresAt.getDate() + timeValueNum);
                break;
            case 'months':
                expiresAt.setMonth(expiresAt.getMonth() + timeValueNum);
                break;
            case 'years':
                expiresAt.setFullYear(expiresAt.getFullYear() + timeValueNum);
                break;
        }
        
        const client = await pool.connect();
        const dbServerName = API_SERVERS[server].dbName;
        
        // Insertar en la base de datos del panel
        await client.query(`
            INSERT INTO api_keys (server, key, description, expires_at, created_by)
            VALUES ($1, $2, $3, $4, $5)
        `, [dbServerName, apiKey, description, expiresAt, req.session.username]);
        
        client.release();
        
        // Sincronizar con la API correspondiente
        await syncKeyToAPI(dbServerName, apiKey, description, expiresAt);
        
        res.json({ success: true, apiKey });
    } catch (error) {
        console.error('Error generando API key:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/api-keys/:server/:keyId', requireAuth, async (req, res) => {
    const { server, keyId } = req.params;
    
    if (!API_SERVERS[server]) {
        return res.status(404).json({ error: 'Servidor no encontrado' });
    }
    
    try {
        const client = await pool.connect();
        const dbServerName = API_SERVERS[server].dbName;
        
        // Verificar que el usuario puede eliminar esta key
        const keyResult = await client.query(
            'SELECT key, created_by FROM api_keys WHERE id = $1 AND server = $2',
            [keyId, dbServerName]
        );
        
        if (keyResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'API key no encontrada' });
        }
        
        const key = keyResult.rows[0];
        if (key.created_by !== req.session.username && req.session.username !== 'zGatoO') {
            client.release();
            return res.status(403).json({ error: 'No tienes permisos para eliminar esta API key' });
        }
        
        // Eliminar de la base de datos del panel
        await client.query('DELETE FROM api_keys WHERE id = $1', [keyId]);
        
        client.release();
        
        // Sincronizar eliminación con la API correspondiente
        await syncKeyDeletionToAPI(dbServerName, key.key);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando API key:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/users', requireAuth, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
        );
        client.release();
        
        res.render('users', {
            title: 'Usuarios',
            username: req.session.username,
            users: result.rows
        });
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.post('/users', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await pool.connect();
        
        await client.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );
        
        client.release();
        res.json({ success: true });
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.delete('/users/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const client = await pool.connect();
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        client.release();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Inicializar base de datos y iniciar servidor
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Admin Panel iniciado en puerto ${PORT}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
});
