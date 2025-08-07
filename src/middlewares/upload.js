// middlewares/upload.js
const multer = require('multer');
const storage = multer.memoryStorage(); // we’ll upload directly from memory
const upload = multer({ storage });

module.exports = upload;
