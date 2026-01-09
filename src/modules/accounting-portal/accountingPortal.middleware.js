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
    
    // Try to get Intuit account info (optional)
    const { data: account, error } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("accounting_portal_id", userId)
      .single();

    console.log(error);

    console.log("Account", account);

    if (error || !account) {
      return next();
    }

    req.clientId = account.user_id;
    console.log("UserId" + account.user_id);
    console.log("Request User Id" + req.clientId);
    next();
  } catch (err) {
    console.error("[AuthMiddleware Error]", err.message);
    return res.status(401).json({ error: "Unauthorized or token invalid" });
  }
};

module.exports = accountingPortalMiddleware;
