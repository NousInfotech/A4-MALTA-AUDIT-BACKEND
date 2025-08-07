// controllers/documentRequestController.js
const DocumentRequest    = require('../models/DocumentRequest');
const EngagementLibrary  = require('../models/EngagementLibrary');
const { supabase }       = require('../config/supabase');

exports.uploadDocuments = async (req, res, next) => {
  try {
    // 1) find and authorize
    const dr = await DocumentRequest.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: 'Request not found' });
    if (dr.clientId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const bucket = 'engagement-documents';
    // sanitize or normalize dr.category as needed
    const categoryFolder = `${dr.category}/`;

    // 2) for each uploaded file
    for (const file of req.files) {
      const ext      = file.originalname.split('.').pop();
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2,5)}.${ext}`;
      const path     = `${dr.engagement.toString()}/${categoryFolder}${filename}`;

      // upload to Supabase
      const { data: up, error: uploadError } = await supabase
        .storage
        .from(bucket)
        .upload(path, file.buffer, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      // get public URL
      const { data: urlData } = supabase
        .storage
        .from(bucket)
        .getPublicUrl(up.path);

      // 3a) push into DocumentRequest
      dr.documents.push({
        name:       file.originalname,
        url:        urlData.publicUrl,
        uploadedAt: new Date()
      });

      // 3b) also record in the EngagementLibrary
      await EngagementLibrary.create({
        engagement: dr.engagement,   // reference the same engagement ID
        category:   dr.category,     // use the request’s category
        url:        urlData.publicUrl
      });
    }

    // 4) optionally mark the request completed
    if (req.body.markCompleted === 'true') {
      dr.status      = 'completed';
      dr.completedAt = new Date();
    }

    // 5) save and return
    await dr.save();
    return res.json(dr);

  } catch (err) {
    next(err);
  }
};



exports.createRequest = async (req, res, next) => {
  try {
    const { engagementId, category, description } = req.body
    const dr = await DocumentRequest.create({
      engagement: engagementId,
      clientId: req.body.clientId || req.user.id,
      category,
      description
    });
    return res.status(201).json(dr);
  } catch (err) {
    next(err);
  }
};

exports.getRequestsByEngagement = async (req, res, next) => {
  try {
    const reqs = await DocumentRequest.find({
      engagement: req.params.engagementId
    });
    return res.json(reqs);
  } catch (err) {
    next(err);
  }
};

exports.updateRequest = async (req, res, next) => {
  try {
    const updates = req.body;
    const dr = await DocumentRequest.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!dr) return res.status(404).json({ message: 'Not found' });

    if (updates.status === 'completed') {
      dr.completedAt = new Date();
      await dr.save();
    }

    return res.json(dr);
  } catch (err) {
    next(err);
  }
};
