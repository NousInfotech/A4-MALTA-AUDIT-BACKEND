const {supabase} = require("../config/supabase");

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


module.exports = { requireAuth, requireRole };