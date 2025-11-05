const UserTour = require('../models/UserTour');

/**
 * Get user's tour progress
 */
exports.getTourProgress = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({
        user_id: userId,
        completed_tours: [],
        skipped_tours: []
      });
    }

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in getTourProgress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark a tour as completed
 */
exports.completeTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({ user_id: userId });
    }

    // Add to completed tours if not already there
    if (!tourProgress.completed_tours.includes(tourName)) {
      tourProgress.completed_tours.push(tourName);
    }

    // Remove from skipped tours if it was there
    tourProgress.skipped_tours = tourProgress.skipped_tours.filter(
      tour => tour !== tourName
    );

    tourProgress.last_tour_date = new Date();
    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in completeTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Skip a tour
 */
exports.skipTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({ user_id: userId });
    }

    // Add to skipped tours if not already there
    if (!tourProgress.skipped_tours.includes(tourName)) {
      tourProgress.skipped_tours.push(tourName);
    }

    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in skipTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reset a specific tour (allow user to see it again)
 */
exports.resetTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      return res.json({ message: 'No tour progress found' });
    }

    // Remove from both completed and skipped
    tourProgress.completed_tours = tourProgress.completed_tours.filter(
      tour => tour !== tourName
    );
    tourProgress.skipped_tours = tourProgress.skipped_tours.filter(
      tour => tour !== tourName
    );

    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in resetTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


/**
 * Get user's tour progress
 */
exports.getTourProgress = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({
        user_id: userId,
        completed_tours: [],
        skipped_tours: []
      });
    }

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in getTourProgress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark a tour as completed
 */
exports.completeTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({ user_id: userId });
    }

    // Add to completed tours if not already there
    if (!tourProgress.completed_tours.includes(tourName)) {
      tourProgress.completed_tours.push(tourName);
    }

    // Remove from skipped tours if it was there
    tourProgress.skipped_tours = tourProgress.skipped_tours.filter(
      tour => tour !== tourName
    );

    tourProgress.last_tour_date = new Date();
    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in completeTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Skip a tour
 */
exports.skipTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      tourProgress = await UserTour.create({ user_id: userId });
    }

    // Add to skipped tours if not already there
    if (!tourProgress.skipped_tours.includes(tourName)) {
      tourProgress.skipped_tours.push(tourName);
    }

    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in skipTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reset a specific tour (allow user to see it again)
 */
exports.resetTour = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tourName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!tourName) {
      return res.status(400).json({ error: 'Tour name is required' });
    }

    let tourProgress = await UserTour.findOne({ user_id: userId });
    
    if (!tourProgress) {
      return res.json({ message: 'No tour progress found' });
    }

    // Remove from both completed and skipped
    tourProgress.completed_tours = tourProgress.completed_tours.filter(
      tour => tour !== tourName
    );
    tourProgress.skipped_tours = tourProgress.skipped_tours.filter(
      tour => tour !== tourName
    );

    await tourProgress.save();

    res.json(tourProgress);
  } catch (error) {
    console.error('Error in resetTour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

