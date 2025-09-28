const ClassificationReview = require("../models/ClassificationReview");
const ClassificationSection = require("../models/ClassificationSection");
const { supabase } = require("../config/supabase");

// Get user profile from Supabase
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      throw new Error('Profile not found');
    }
    
    return profile;
  } catch (error) {
    throw new Error('Failed to fetch user profile');
  }
}

// Create a new classification review
exports.createReview = async (req, res) => {
  try {
    const { engagementId, classificationId, comment, location, ipAddress, sessionId, systemVersion, isDone } = req.body;
    const userId = req.user.id;

    // Get user profile details
    const userProfile = await getUserProfile(userId);

    const review = new ClassificationReview({
      engagementId,
      classificationId,
      reviewedBy: {
        userId: userId,
        name: userProfile.name,
        email: req.user.email || 'unknown@example.com',
        role: userProfile.role,
      },
      comment,
      location,
      ipAddress,
      sessionId,
      systemVersion,
      status: "pending",
      isDone: isDone || false,
    });

    await review.save();

    res.status(201).json({
      message: "Review created successfully",
      review: review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({
      error: error.message || "Failed to create review",
    });
  }
};

// Get all reviews for a classification
exports.getReviewsByClassification = async (req, res) => {
  try {
    const { classificationId } = req.params;

    const reviews = await ClassificationReview.find({ classificationId })
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Reviews retrieved successfully",
      reviews: reviews,
    });
  } catch (error) {
    console.error("Error getting reviews:", error);
    res.status(500).json({
      error: error.message || "Failed to get reviews",
    });
  }
};

// Update review status
exports.updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ["pending", "in-review", "signed-off"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be one of: pending, in-review, signed-off",
      });
    }

    const review = await ClassificationReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        error: "Review not found",
      });
    }

    review.status = status;
    review.reviewedOn = new Date();
    await review.save();

    res.status(200).json({
      message: "Review status updated successfully",
      review: review,
    });
  } catch (error) {
    console.error("Error updating review status:", error);
    res.status(500).json({
      error: error.message || "Failed to update review status",
    });
  }
};

// Update review done status
exports.updateReviewDone = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { isDone } = req.body;
    const userId = req.user.id;

    // Validate isDone parameter
    if (typeof isDone !== 'boolean') {
      return res.status(400).json({
        error: "Invalid isDone parameter. Must be a boolean value",
      });
    }

    const review = await ClassificationReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        error: "Review not found",
      });
    }

    // Verify the user is the owner of the review
    if (review.reviewedBy.userId !== userId) {
      return res.status(403).json({
        error: "You can only update your own reviews",
      });
    }

    review.isDone = isDone;
    await review.save();

    res.status(200).json({
      message: "Review done status updated successfully",
      review: review,
    });
  } catch (error) {
    console.error("Error updating review done status:", error);
    res.status(500).json({
      error: error.message || "Failed to update review done status",
    });
  }
};

// Get all reviews
exports.getAllReviews = async (req, res) => {
  try {
    const { engagementId, status } = req.query;
    
    let filter = {};
    if (engagementId) filter.engagementId = engagementId;
    if (status) filter.status = status;

    const reviews = await ClassificationReview.find(filter)
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Reviews retrieved successfully",
      reviews: reviews,
    });
  } catch (error) {
    console.error("Error getting all reviews:", error);
    res.status(500).json({
      error: error.message || "Failed to get reviews",
    });
  }
};

// Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ClassificationReview.findByIdAndDelete(reviewId);
    if (!review) {
      return res.status(404).json({
        error: "Review not found",
      });
    }

    res.status(200).json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      error: error.message || "Failed to delete review",
    });
  }
};
