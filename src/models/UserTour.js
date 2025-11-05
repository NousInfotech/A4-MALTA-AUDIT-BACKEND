const mongoose = require('mongoose');

const userTourSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  completed_tours: {
    type: [String],
    default: []
  },
  skipped_tours: {
    type: [String],
    default: []
  },
  last_tour_date: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserTour', userTourSchema);

