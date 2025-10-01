const axios = require('axios');

// API Key de prueba para DNI Básico
const testKey = 'test-key-123456789';
const dniServerUrl = 'https://zgatoodni.up.railway.app';

async function testSync() {
    try {
        console.log('🔄 Probando sincronización con servidor DNI...');
        
        // Calcular fecha de expiración (30 días desde ahora)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const response = await axios.post(`${dniServerUrl}/register-key`, {
            key: testKey,
            description: 'API Key de prueba desde panel',
            expires_at: expiresAt.toISOString(),
            created_by: 'zGatoO'
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Respuesta del servidor:', response.data);
        
        if (response.data.success) {
            console.log('✅ Sincronización exitosa');
        } else {
            console.log('❌ Error en sincronización:', response.data.error);
        }
        
    } catch (error) {
        console.log('❌ Error de conexión:', error.message);
        if (error.response) {
            console.log('Respuesta del servidor:', error.response.data);
        }
    }
}

testSync();
