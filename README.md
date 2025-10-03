# WolfData Admin Panel

Panel de administración para gestionar API Keys del sistema WolfData Dox.

## Características

- 🎨 **Tema Hacker**: Interfaz oscura con colores neón
- 🔐 **Autenticación**: Sistema de login seguro con bcrypt
- 🔑 **Gestión de API Keys**: Crear, eliminar y monitorear API Keys
- 📊 **Dashboard**: Estadísticas en tiempo real
- 👥 **Gestión de Usuarios**: Administrar usuarios del sistema
- 🔄 **Sincronización**: Sincronización automática con bases de datos de servidores

## Servidores Soportados

- **DNI Básico** (`/dni`) - https://zgatoodni.up.railway.app
- **DNI Detallado** (`/dnit`) - https://zgatoodnit.up.railway.app
- **Búsqueda por Nombres** (`/nombres`) - https://zgatoonm.up.railway.app
- **Certificados** (`/certificados`) - https://zgatoocert.up.railway.app
- **Árbol Genealógico** (`/arbol`) - https://zgatooarg.up.railway.app

## Instalación

1. Clonar el repositorio
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno
4. Ejecutar: `npm start`

## Variables de Entorno

- `DATABASE_URL`: URL de PostgreSQL del admin panel
- `SESSION_SECRET`: Clave secreta para sesiones
- `PORT`: Puerto del servidor (por defecto 3000)

## Uso

1. Acceder a la URL del panel
2. Iniciar sesión con las credenciales
3. Gestionar API Keys desde el dashboard
4. Crear usuarios adicionales si es necesario

## Credenciales por Defecto

- **Usuario**: admin
- **Contraseña**: admin123

## Desarrollado por

- **@zGatoO** - Desarrollador principal
- **@choco_tete** - Soporte técnico
- **@WinniePoohOFC** - Soporte técnico
