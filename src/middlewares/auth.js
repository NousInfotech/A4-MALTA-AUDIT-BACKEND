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
      .select('role, name')
      .eq('user_id', user.id)
      .single();

    if (profErr || !profile) {
      return res.status(403).json({ message: 'No profile found for user' });
    }

    req.user = { 
      id: user.id, 
      email: user.email, 
      role: profile.role,
      name: profile.name
    };
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
    
    // Handle both single role and array of roles
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

async function saltedgeAuth(req, res, next) {
  try {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user.id;

    // Get user profile with bankconnectionid
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("bankconnectionid")
      .eq("user_id", userId)
      .single();

    if (profErr || !profile) {
      return res.status(403).json({ message: "No profile found for user" });
    }

    let bankconnectionid = profile.bankconnectionid;

    // If bankconnectionid is empty or null, create or fetch customer
    if (!bankconnectionid || bankconnectionid.trim() === "") {
      try {
        const customer = await saltEdgeService.createCustomer(userId);
        bankconnectionid = customer.id;

        // Save to profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ bankconnectionid })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Error updating user bankconnectionid:", updateError);
          return res
            .status(500)
            .json({ message: "Failed to update user profile" });
        }
      } catch (error) {
        if (error.response?.status === 409) {
          // Already exists → fetch customer by identifier
          console.log("SaltEdge customer already exists, fetching...");
          const existing = await saltEdgeService.getCustomerByIdentifier(userId);
          bankconnectionid = existing.id;

          // Save to profile
          await supabase
            .from("profiles")
            .update({ bankconnectionid })
            .eq("user_id", userId);
        } else {
          console.error("Error creating SaltEdge customer:", error);
          return res
            .status(500)
            .json({ message: "Failed to create bank connection" });
        }
      }
    }

    // Attach to request for later use
    req.bankconnectionid = bankconnectionid;
    next();
  } catch (err) {
    console.error("SaltEdge auth middleware error:", err);
    res.status(500).json({ message: "Internal SaltEdge auth error" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super-admin') {
    return res.status(403).json({ 
      message: 'Access denied. Super admin role required.' 
    });
  }
  next();
}

// Middleware to automatically scope queries by organizationId
function organizationScope(req, res, next) {
  // Skip for super-admin
  if (req.user && req.user.role === 'super-admin') {
    return next();
  }
  
  // For other users, ensure they have organizationId
  if (!req.user || !req.user.organizationId) {
    return res.status(403).json({ 
      message: 'No organization assigned to user' 
    });
  }
  
  // Attach organizationId to query params for easy filtering
  req.organizationId = req.user.organizationId;
  next();
}

module.exports = { 
  requireAuth, 
  requireRole, 
  saltedgeAuth, 
  requireSuperAdmin, 
  organizationScope 
};