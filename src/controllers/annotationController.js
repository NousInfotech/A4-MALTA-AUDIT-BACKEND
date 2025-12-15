const PDFAnnotation = require('../models/PDFAnnotation');

exports.getAnnotations = async (req, res) => {
    try {
        const { fileId, engagementId } = req.query;

        if (!fileId || !engagementId) {
            return res.status(400).json({ error: 'Missing fileId or engagementId' });
        }

        const annotations = await PDFAnnotation.find({ fileId, engagementId })
            .sort({ createdAt: 1 });

        res.json(annotations);
    } catch (err) {
        console.error('Error fetching annotations:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.saveAnnotation = async (req, res) => {
    try {
        const { engagementId, fileId, pageNumber, content, rect, author, fileType } = req.body;

        const newAnnotation = new PDFAnnotation({
            engagementId,
            fileId,
            fileType: fileType || 'engagement',
            pageNumber,
            content,
            rect,
            author: author || {
                id: req.user._id, // Assuming req.user is populated by auth middleware
                name: req.user.name,
                role: req.user.role
            }
        });

        await newAnnotation.save();
        res.status(201).json(newAnnotation);
    } catch (err) {
        console.error('Error saving annotation:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateAnnotation = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const annotation = await PDFAnnotation.findByIdAndUpdate(id, updates, { new: true });
        if (!annotation) {
            return res.status(404).json({ error: 'Annotation not found' });
        }
        res.json(annotation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteAnnotation = async (req, res) => {
    try {
        const { id } = req.params;
        await PDFAnnotation.findByIdAndDelete(id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Returns a summary of which files have open review points for an engagement
exports.getReviewPointsSummary = async (req, res) => {
    try {
        const { engagementId } = req.query;

        if (!engagementId) {
            return res.status(400).json({ error: 'Missing engagementId' });
        }

        // Find all unresolved annotations for this engagement
        const openAnnotations = await PDFAnnotation.find({
            engagementId,
            isResolved: false
        }).select('fileId type');

        // Group by fileId
        const filesWithIssues = new Set();
        openAnnotations.forEach(ann => {
            filesWithIssues.add(ann.fileId.toString());
        });

        res.json({
            fileIds: Array.from(filesWithIssues),
            count: filesWithIssues.size
        });
    } catch (err) {
        console.error('Error getting review summary:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Returns status of review points for a list of file IDs
exports.getFilesReviewStatus = async (req, res) => {
    try {
        const { fileIds } = req.body;



        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: 'Missing or invalid fileIds array' });
        }

        // Find all unresolved annotations for these files
        const openAnnotations = await PDFAnnotation.find({
            fileId: { $in: fileIds },
            isResolved: false
        }).select('fileId');

        const filesWithIssues = new Set();
        openAnnotations.forEach(ann => {
            filesWithIssues.add(ann.fileId.toString());
        });

        // Return a map or list
        // response: { "file_id_1": true, "file_id_2": false }
        const statusMap = {};
        fileIds.forEach(id => {
            statusMap[id] = filesWithIssues.has(String(id));
        });

        res.json(statusMap);
    } catch (err) {
        console.error('Error getting files review status:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
