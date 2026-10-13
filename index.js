const express = require('express');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const app = express();
const PORT = process.env.PORT || 3000;

// Carpeta temporal en el servidor para almacenar la caché
const CACHE_DIR = path.join('/tmp', 'songs_cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.get('/', (req, res) => {
    res.send('El servidor proxy de streaming está activo y listo.');
});

app.get('/stream', async (req, res) => {
    try {
        const base64Id = req.query.id;
        if (!base64Id) {
            return res.status(400).send('ID de audio faltante.');
        }

        // Decodificar la URL que viene enmascarada desde el JSON de Gist
        const originalUrl = Buffer.from(base64Id, 'base64').toString('utf-8');
        
        // Crear un nombre de caché seguro limpiando caracteres extraños
        const safeFileName = base64Id.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30) + ".mp3";
        const cacheFilePath = path.join(CACHE_DIR, safeFileName);

        // CASO 1: Si la canción ya fue descargada antes, reproducirla instantáneamente
        if (fs.existsSync(cacheFilePath)) {
            console.log("Sirviendo desde caché de disco:", safeFileName);
            return res.sendFile(cacheFilePath);
        }

        // CASO 2: Si no existe, descargarla desde YouTube de forma interna y hacer streaming
        console.log("Descargando de origen:", originalUrl);
        
        const stream = ytdl(originalUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25 // Buffer de 32MB para evitar cortes de conexión
        });

        // Guardar el flujo de datos en el disco duro del servidor para futuras peticiones
        const fileStream = fs.createWriteStream(cacheFilePath);
        stream.pipe(fileStream);

        // Configurar cabeceras de streaming nativas
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');

        // Enviar el flujo de datos en tiempo real al teléfono del usuario
        stream.pipe(res);

    } catch (error) {
        console.error("Error procesando stream:", error);
        res.status(500).send("Error interno en la transmisión de audio");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
