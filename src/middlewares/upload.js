const multer = require('multer');

// Default storage configuration
const storage = multer.memoryStorage(); 
const upload = multer({ storage });

// Specialized multer configuration for Financial Statement Review
// Only accepts PDF files with max size of 50MB
const fsReviewStorage = multer.memoryStorage();

const fsReviewUpload = multer({
  storage: fsReviewStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only one file allowed
  },
  fileFilter: (req, file, cb) => {
    // Validate file type - only PDF files allowed
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for financial statement review'), false);
    }
  }
});

module.exports = upload;
module.exports.fsReviewUpload = fsReviewUpload;
