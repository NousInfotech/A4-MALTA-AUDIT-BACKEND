const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { supabase } = require("../../config/supabase");

const accountingPortalMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    let token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token && req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie);
      token = cookies.token;
    }

    if (!token) {
      return res.status(404).json({ error: "token not found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { userId }; // Always attach user to request

    // Try to get Intuit account info (optional)
    const { data: account, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("accounting_portal_id", userId)
      .single();

    if (error || !account) {
      return next();
    }

    req.clientId = account.id;

    next();
  } catch (err) {
    console.error("[AuthMiddleware Error]", err.message);
    return res.status(401).json({ error: "Unauthorized or token invalid" });
  }
};

module.exports = accountingPortalMiddleware;
