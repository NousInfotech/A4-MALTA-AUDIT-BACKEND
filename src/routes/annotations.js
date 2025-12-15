const express = require('express');
const router = express.Router();
const annotationController = require('../controllers/annotationController');
const { requireAuth } = require('../middlewares/auth'); // Check if this path is correct

// All routes require authentication
router.use(requireAuth);

router.get('/', annotationController.getAnnotations);
router.post('/', annotationController.saveAnnotation);
router.put('/:id', annotationController.updateAnnotation);
router.delete('/:id', annotationController.deleteAnnotation);

// Specific endpoint to get review points status for the library
router.get('/summary', annotationController.getReviewPointsSummary);
router.post('/status', annotationController.getFilesReviewStatus);

module.exports = router;
