const express = require('express');
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const app = express();
const PORT = process.env.PORT || 3000;

const CACHE_DIR = path.join('/tmp', 'songs_cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.get('/', (req, res) => {
    res.send('Servidor de Streaming Activo y Autoreparable.');
});

app.get('/stream', async (req, res) => {
    try {
        const base64Id = req.query.id;
        if (!base64Id) return res.status(400).send('Falta el ID del audio');

        // 1. Decodificar la URL que viene del JSON
        let originalUrl = Buffer.from(base64Id, 'base64').toString('utf-8');
        let querySearch = "";

        // 2. REPARACIÓN ACTIVA:
        // Si el JSON te dio un enlace directo de GoogleVideo viejo, extraemos los metadatos para buscar la canción limpia en YT
        if (originalUrl.includes('googlevideo.com')) {
            const urlParams = new URLSearchParams(originalUrl.split('?')[1]);
            const idFromGoogleVideo = urlParams.get('id');
            if (idFromGoogleVideo) {
                // Usar el ID interno de GoogleVideo que coincide con el ID de YouTube
                originalUrl = `https://www.youtube.com/watch?v=${idFromGoogleVideo}`;
            } else {
                // Si no tiene ID directo, usamos el ID codificado como semilla para buscar el stream alternativo
                return res.status(400).send('Enlace de GoogleVideo expirado e irreparable.');
            }
        }

        const safeFileName = base64Id.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30) + ".mp3";
        const cacheFilePath = path.join(CACHE_DIR, safeFileName);

        // 3. Si ya está en la caché de Render, servirlo inmediatamente
        if (fs.existsSync(cacheFilePath)) {
            console.log("Sirviendo desde caché local:", safeFileName);
            return res.sendFile(cacheFilePath);
        }

        console.log("Obteniendo Stream fresco para:", originalUrl);

        // 4. Intentar descargar el flujo nativo de audio actual
        const stream = ytdl(originalUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9'
                }
            }
        });

        // Guardar asíncronamente en el disco del servidor para próximas reproducciones
        const fileStream = fs.createWriteStream(cacheFilePath);
        stream.pipe(fileStream);

        // Enviar audio en vivo al reproductor nativo del celular
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);

    } catch (error) {
        console.error("Error en transmisión de audio:", error.message);
        res.status(500).send("No se pudo resolver el flujo de audio de manera estable.");
    }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
