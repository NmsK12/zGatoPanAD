const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const moment = require('moment');

// Función para sincronizar API Key con la API correspondiente
async function syncKeyToAPI(serverKey, apiKey, description, expiresAt) {
    try {
        const apiUrl = API_SERVERS[serverKey].url;
        console.log(`🔄 Sincronizando key ${apiKey} con ${serverKey}...`);
        
        const response = await axios.post(`${apiUrl}/register-key`, {
            key: apiKey,
            description: description,
            expires_at: expiresAt
        }, {
            timeout: 10000
        });
        
        if (response.data.success) {
            console.log(`✅ Key sincronizada exitosamente con ${serverKey}`);
        } else {
            console.log(`❌ Error sincronizando ${serverKey}: ${response.data.error}`);
        }
        
    } catch (error) {
        console.log(`❌ Error conectando a ${serverKey}: ${error.message}`);
    }
}

// Función para sincronizar eliminación de API Key con la API correspondiente
async function syncKeyDeletionToAPI(serverKey, apiKey) {
    try {
        const apiUrl = API_SERVERS[serverKey].url;
        console.log(`🗑️ Eliminando key ${apiKey} de ${serverKey}...`);
        
        const response = await axios.post(`${apiUrl}/delete-key`, {
            key: apiKey
        }, {
            timeout: 10000
        });
        
        if (response.data.success) {
            console.log(`✅ Key eliminada exitosamente de ${serverKey}`);
        } else {
            console.log(`❌ Error eliminando de ${serverKey}: ${response.data.error}`);
        }
        
    } catch (error) {
        console.log(`❌ Error conectando a ${serverKey} para eliminación: ${error.message}`);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'zGatoO_admin_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:LrfDsLXjIFJgcdwpWHKYATXNjXHmnpCX@nozomi.proxy.rlwy.net:46397/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

// Configuración de las APIs
const API_SERVERS = {
    'dni-basico': {
        name: 'DNI Básico',
        url: 'https://zgatoodni.up.railway.app',
        color: '#3498db'
    },
    'dni-detallado': {
        name: 'DNI Detallado', 
        url: 'https://zgatoodnit.up.railway.app',
        color: '#e74c3c'
    },
    'certificados': {
        name: 'Certificados',
        url: 'https://zgatoocert.up.railway.app',
        color: '#f39c12'
    },
    'arbol-genealogico': {
        name: 'Árbol Genealógico',
        url: 'https://zgatooarg.up.railway.app',
        color: '#27ae60'
    }
};

// Inicializar base de datos
async function initDatabase() {
    try {
        const client = await pool.connect();
        
        // Crear tabla de usuarios admin
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Crear tabla de API Keys
        await client.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                server VARCHAR(50) NOT NULL,
                key VARCHAR(32) UNIQUE NOT NULL,
                description TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(50) NOT NULL,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP
            )
        `);
        
        // Crear índices
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_api_keys_server ON api_keys(server)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at)
        `);
        
        // Migrar datos de admins a users si existe la tabla admins
        try {
            const checkAdmins = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'admins'
                )
            `);
            
            if (checkAdmins.rows[0].exists) {
                console.log('🔄 Migrando datos de tabla admins a users...');
                
                // Migrar usuarios de admins a users
                await client.query(`
                    INSERT INTO users (username, password, created_at)
                    SELECT username, password, created_at 
                    FROM admins 
                    WHERE NOT EXISTS (
                        SELECT 1 FROM users WHERE users.username = admins.username
                    )
                `);
                
                console.log('✅ Migración completada');
            }
        } catch (migrationError) {
            console.log('ℹ️ No hay tabla admins para migrar');
        }
        
        // Crear usuario admin por defecto si no existe
        const defaultPassword = bcrypt.hashSync('MiguelAngelMP1.', 10);
        await client.query(`
            INSERT INTO users (username, password) 
            VALUES ($1, $2) 
            ON CONFLICT (username) DO NOTHING
        `, ['zGatoO', defaultPassword]);
        
        client.release();
        console.log('✅ Base de datos PostgreSQL inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
    }
}

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

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
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        client.release();
        
        if (result.rows.length === 0 || !bcrypt.compareSync(password, result.rows[0].password)) {
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
        req.session.userId = result.rows[0].id;
        req.session.username = result.rows[0].username;
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Error en login:', error);
        res.render('login', { error: 'Error del servidor' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT server, COUNT(*) as total, 
                   SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END) as active,
                   SUM(CASE WHEN expires_at <= NOW() THEN 1 ELSE 0 END) as expired
            FROM api_keys GROUP BY server
        `);
        client.release();
        
        res.render('dashboard', { 
            user: req.session.username,
            servers: API_SERVERS,
            stats: result.rows
        });
        
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.render('dashboard', { 
            user: req.session.username,
            servers: API_SERVERS,
            stats: []
        });
    }
});

app.get('/api-keys/:server', requireAuth, async (req, res) => {
    const server = req.params.server;
    
    if (!API_SERVERS[server]) {
        return res.status(404).send('Servidor no encontrado');
    }
    
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT *, 
                   CASE WHEN expires_at > NOW() THEN false ELSE true END as is_expired,
                   TO_CHAR(expires_at, 'DD/MM/YYYY HH24:MI') as expires_at_formatted,
                   TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as created_at_formatted,
                   CASE WHEN last_used IS NOT NULL THEN TO_CHAR(last_used, 'DD/MM/YYYY HH24:MI') ELSE 'Nunca' END as last_used_formatted
            FROM api_keys 
            WHERE server = $1 
            ORDER BY created_at DESC
        `, [server]);
        client.release();
        
        res.render('api-keys', { 
            user: req.session.username,
            server: server,
            serverInfo: API_SERVERS[server],
            keys: result.rows
        });
        
    } catch (error) {
        console.error('Error obteniendo API Keys:', error);
        res.status(500).send('Error obteniendo API Keys');
    }
});

app.post('/api-keys/:server/generate', requireAuth, async (req, res) => {
    try {
        const server = req.params.server;
        const { minutes, description } = req.body;
        
        console.log(`Generando API Key para servidor: ${server}`);
        console.log(`Minutos: ${minutes}, Descripción: ${description}`);
        
        if (!API_SERVERS[server]) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
        }
        
        // Validar y establecer valores por defecto
        const minutesValue = parseInt(minutes) || 60;
        const descriptionValue = description || 'API Key generada desde panel';
        
        // Generar API Key
        const apiKey = require('crypto').randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + (minutesValue * 60 * 1000));
        
        // Insertar en PostgreSQL
        const client = await pool.connect();
        const result = await client.query(`
            INSERT INTO api_keys (server, key, description, expires_at, created_by) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [server, apiKey, descriptionValue, expiresAt.toISOString(), req.session.username]);
        client.release();
        
        // Generar URL de ejemplo según el servidor
        let exampleUrl;
        switch(server) {
            case 'dni-basico':
                exampleUrl = `${API_SERVERS[server].url}/dniresult?dni=12345678&key=${apiKey}`;
                break;
            case 'dni-detallado':
                exampleUrl = `${API_SERVERS[server].url}/dnit?dni=12345678&key=${apiKey}`;
                break;
            case 'certificados':
                exampleUrl = `${API_SERVERS[server].url}/antpen?dni=12345678&key=${apiKey}`;
                break;
            case 'arbol-genealogico':
                exampleUrl = `${API_SERVERS[server].url}/ag?dni=12345678&key=${apiKey}`;
                break;
            default:
                exampleUrl = `${API_SERVERS[server].url}/?dni=12345678&key=${apiKey}`;
        }
        
        console.log(`✅ API Key creada exitosamente: ${apiKey}`);
        
        // Sincronizar automáticamente con la API
        syncKeyToAPI(server, apiKey, descriptionValue, expiresAt.toISOString());
        
        res.json({ 
            success: true, 
            key: apiKey,
            expires_at: expiresAt.toISOString(),
            example_url: exampleUrl
        });
        
    } catch (error) {
        console.error('Error en generateKey:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

app.delete('/api-keys/:server/:keyId', requireAuth, async (req, res) => {
    const { server, keyId } = req.params;
    
    try {
        const client = await pool.connect();
        
        // Primero obtener la API Key antes de eliminarla
        const keyResult = await client.query(`
            SELECT key FROM api_keys 
            WHERE id = $1 AND server = $2
        `, [keyId, server]);
        
        if (keyResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'API Key no encontrada' });
        }
        
        const apiKey = keyResult.rows[0].key;
        
        // Eliminar de la base de datos del panel
        const result = await client.query(`
            DELETE FROM api_keys 
            WHERE id = $1 AND server = $2
        `, [keyId, server]);
        client.release();
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'API Key no encontrada' });
        }
        
        // Sincronizar eliminación con el servidor correspondiente
        syncKeyDeletionToAPI(server, apiKey);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error eliminando API Key:', error);
        res.status(500).json({ error: 'Error eliminando API Key' });
    }
});

app.get('/users', requireAuth, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT id, username, 
                   TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as created_at_formatted
            FROM admins 
            ORDER BY created_at DESC
        `);
        client.release();
        
        res.render('users', { 
            user: req.session.username,
            users: result.rows
        });
        
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).send('Error obteniendo usuarios');
    }
});

app.post('/users', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    console.log('Creando usuario:', { username, password: password ? '***' : 'undefined' });
    console.log('Body completo:', req.body);
    
    if (!username || !password) {
        console.log('Error: Usuario o contraseña faltantes');
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    
    if (username.length < 3) {
        console.log('Error: Usuario muy corto');
        return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }
    
    if (password.length < 6) {
        console.log('Error: Contraseña muy corta');
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const client = await pool.connect();
        const result = await client.query(`
            INSERT INTO admins (username, password) 
            VALUES ($1, $2)
        `, [username, hashedPassword]);
        client.release();
        
        console.log('Usuario creado exitosamente:', username);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        if (error.code === '23505') { // Unique violation
            res.status(400).json({ error: 'El usuario ya existe' });
        } else {
            res.status(500).json({ error: 'Error creando usuario: ' + error.message });
        }
    }
});

app.delete('/users/:userId', requireAuth, async (req, res) => {
    const userId = req.params.userId;
    
    if (parseInt(userId) === req.session.userId) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    
    try {
        const client = await pool.connect();
        const result = await client.query(`
            DELETE FROM admins WHERE id = $1
        `, [userId]);
        client.release();
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error eliminando usuario' });
    }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: err.message 
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicializar base de datos y arrancar servidor
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Panel de administración corriendo en puerto ${PORT}`);
        console.log(`📊 Acceso: http://localhost:${PORT}`);
        console.log(`🗄️ Base de datos: PostgreSQL`);
    });
}).catch(error => {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
});
