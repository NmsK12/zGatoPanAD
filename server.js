const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const moment = require('moment');

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

// Configuración de las APIs
const API_SERVERS = {
    'dni-basico': {
        name: 'DNI Básico',
        url: process.env.DNI_BASICO_URL || 'https://zgatoo1.up.railway.app',
        color: '#3498db'
    },
    'dni-detallado': {
        name: 'DNI Detallado', 
        url: process.env.DNI_DETALLADO_URL || 'https://zgatoo2.up.railway.app',
        color: '#e74c3c'
    },
    'certificados': {
        name: 'Certificados',
        url: process.env.CERTIFICADOS_URL || 'https://zgatoo3.up.railway.app',
        color: '#f39c12'
    },
    'arbol-genealogico': {
        name: 'Árbol Genealógico',
        url: process.env.ARBOL_URL || 'https://zgatoo4.up.railway.app',
        color: '#27ae60'
    }
};

// Inicializar base de datos
const db = new sqlite3.Database('admin.db');

db.serialize(() => {
    // Tabla de usuarios admin
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Tabla de API Keys
    db.run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server TEXT NOT NULL,
        key TEXT UNIQUE NOT NULL,
        description TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        last_used DATETIME
    )`);
});

// Crear usuario admin por defecto
const defaultPassword = bcrypt.hashSync('MiguelAngelMP1.', 10);
db.run(`INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)`, 
    ['zGatoO', defaultPassword]);

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

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.render('login', { error: 'Error del servidor' });
        }
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/dashboard');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
    // Obtener estadísticas de API Keys
    db.all(`SELECT server, COUNT(*) as total, 
            SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN expires_at <= datetime('now') THEN 1 ELSE 0 END) as expired
            FROM api_keys GROUP BY server`, (err, stats) => {
        if (err) {
            console.error(err);
            stats = [];
        }
        
        res.render('dashboard', { 
            user: req.session.username,
            servers: API_SERVERS,
            stats: stats
        });
    });
});

app.get('/api-keys/:server', requireAuth, (req, res) => {
    const server = req.params.server;
    
    if (!API_SERVERS[server]) {
        return res.status(404).send('Servidor no encontrado');
    }
    
    db.all(`SELECT * FROM api_keys WHERE server = ? ORDER BY created_at DESC`, 
        [server], (err, keys) => {
        if (err) {
            return res.status(500).send('Error obteniendo API Keys');
        }
        
        res.render('api-keys', { 
            user: req.session.username,
            server: server,
            serverInfo: API_SERVERS[server],
            keys: keys.map(key => ({
                ...key,
                is_expired: new Date(key.expires_at) < new Date(),
                expires_at_formatted: moment(key.expires_at).format('DD/MM/YYYY HH:mm'),
                created_at_formatted: moment(key.created_at).format('DD/MM/YYYY HH:mm'),
                last_used_formatted: key.last_used ? moment(key.last_used).format('DD/MM/YYYY HH:mm') : 'Nunca'
            }))
        });
    });
});

app.post('/api-keys/:server/generate', requireAuth, (req, res) => {
    const server = req.params.server;
    const { minutes, description } = req.body;
    
    if (!API_SERVERS[server]) {
        return res.status(404).json({ error: 'Servidor no encontrado' });
    }
    
    // Generar API Key
    const apiKey = require('crypto').randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + (minutes * 60 * 1000));
    
    db.run(`INSERT INTO api_keys (server, key, description, expires_at, created_by) 
            VALUES (?, ?, ?, ?, ?)`,
        [server, apiKey, description, expiresAt.toISOString(), req.session.username],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error creando API Key' });
            }
            
            res.json({ 
                success: true, 
                key: apiKey,
                expires_at: expiresAt.toISOString()
            });
        });
});

app.delete('/api-keys/:server/:keyId', requireAuth, (req, res) => {
    const { server, keyId } = req.params;
    
    db.run(`DELETE FROM api_keys WHERE id = ? AND server = ?`, 
        [keyId, server], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error eliminando API Key' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'API Key no encontrada' });
        }
        
        res.json({ success: true });
    });
});

app.get('/users', requireAuth, (req, res) => {
    db.all(`SELECT id, username, created_at FROM admins ORDER BY created_at DESC`, 
        (err, users) => {
        if (err) {
            return res.status(500).send('Error obteniendo usuarios');
        }
        
        res.render('users', { 
            user: req.session.username,
            users: users.map(user => ({
                ...user,
                created_at_formatted: moment(user.created_at).format('DD/MM/YYYY HH:mm')
            }))
        });
    });
});

app.post('/users', requireAuth, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO admins (username, password) VALUES (?, ?)`,
        [username, hashedPassword], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({ error: 'El usuario ya existe' });
            }
            return res.status(500).json({ error: 'Error creando usuario' });
        }
        
        res.json({ success: true });
    });
});

app.delete('/users/:userId', requireAuth, (req, res) => {
    const userId = req.params.userId;
    
    // No permitir eliminar el usuario actual
    if (parseInt(userId) === req.session.userId) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    
    db.run(`DELETE FROM admins WHERE id = ?`, [userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error eliminando usuario' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Panel de administración corriendo en puerto ${PORT}`);
    console.log(`📊 Acceso: http://localhost:${PORT}`);
});
