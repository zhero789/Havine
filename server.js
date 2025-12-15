/**
 * REAL BACKEND SERVER CODE
 * 
 * To deploy this app with a real backend:
 * 1. Install dependencies: `npm install express multer cors helmet`
 * 2. Run this file: `node server.js`
 * 3. Update the frontend fetch calls to point to this server URL.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(cors());
app.use(express.json());

// Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Accept common document and media types
        if (file.mimetype.match(/(image\/|application\/pdf|video\/|audio\/|text\/)/)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

// --- API ENDPOINTS ---

// 1. Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', timestamp: new Date() });
});

// 2. Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
    
    res.json({
        success: true,
        fileId: req.file.filename,
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
});

// 3. Serve File (with correct headers)
app.get('/files/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    
    if (fs.existsSync(filePath)) {
        // Explicitly set headers for browser viewing vs downloading
        const ext = path.extname(req.params.filename).toLowerCase();
        
        if (ext === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline'); // Forces browser to try opening it
        }
        
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`- Upload endpoint: POST http://localhost:${PORT}/api/upload`);
    console.log(`- File access: GET http://localhost:${PORT}/files/:filename`);
});