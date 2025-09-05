const {supabase} = require("../config/supabase");
const saltEdgeService = require("../services/saltedge.service");

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Missing or malformed Authorization header' });
    }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const user = data.user;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profErr || !profile) {
      return res.status(403).json({ message: 'No profile found for user' });
    }

    req.user = { id: user.id, role: profile.role };
    next();

  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Internal auth error' });
  }
}

function requireRole(requiredRole) {
  return (req, res, next) => {  
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

async function saltedgeAuth(req, res, next) {
  try {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userId = req.user.id;

    // Get user profile with bankconnectionid
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('bankconnectionid')
      .eq('user_id', userId)
      .single();

    if (profErr || !profile) {
      return res.status(403).json({ message: 'No profile found for user' });
    }

    let bankconnectionid = profile.bankconnectionid;

    // If bankconnectionid is empty or null, create a new customer
    if (!bankconnectionid || bankconnectionid.trim() === '') {
      try {
        const customer = await saltEdgeService.createCustomer(userId);
        bankconnectionid = customer.id;

        // Update the user's profile with the new bankconnectionid
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ bankconnectionid: bankconnectionid })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating user bankconnectionid:', updateError);
          return res.status(500).json({ message: 'Failed to update user profile' });
        }
      } catch (error) {
        console.error('Error creating SaltEdge customer:', error);
        return res.status(500).json({ message: 'Failed to create bank connection' });
      }
    }

    // Add bankconnectionid to request object
    req.bankconnectionid = bankconnectionid;
    next();

  } catch (err) {
    console.error('SaltEdge auth middleware error:', err);
    res.status(500).json({ message: 'Internal SaltEdge auth error' });
  }
}

module.exports = { requireAuth, requireRole, saltedgeAuth };