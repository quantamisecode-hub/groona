/* routes/upload.js - LOCAL SERVER STORAGE VERSION */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Define Upload Directory
// FIX: Changed from '../public/uploads' to '../uploads' to match server.js static serving path
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configure Multer for Disk Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename: timestamp-random-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'); // Remove special chars
        cb(null, uniqueSuffix + '-' + cleanName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
}).single('file');

// 3. Handle OPTIONS for CORS
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

// 4. POST Upload Handler
router.post('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');

    upload(req, res, function (err) {
        if (err) {
            console.error("❌ [Upload] Error:", err.message);
            return res.status(400).json({ msg: `Upload error: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        // Construct the Public URL
        // It uses the server's host to build a full URL: http://your-site.com/uploads/filename.jpg
        const protocol = req.protocol;
        const host = req.get('host');
        
        // This URL structure matches app.use('/uploads', ...) in server.js
        const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        console.log(`✅ [Upload] Saved locally: ${req.file.filename}`);

        // Return format expected by your frontend
        res.json({ 
            url: fileUrl, 
            filename: req.file.filename,
            fileId: req.file.filename // Using filename as ID for local files
        });
    });
});

module.exports = router;