const router = require("express").Router();
const saltedgeController = require("../controllers/saltedgeController");
const { requireAuth, requireRole, saltedgeAuth } = require("../middlewares/auth");

// Customer management
router.post("/customers", requireAuth, saltedgeController.createCustomer);
router.get("/customers/:customerId", requireAuth, saltedgeAuth, saltedgeController.getCustomer);
router.delete("/customers/:customerId", requireAuth, requireRole("admin"), saltedgeAuth, saltedgeController.deleteCustomer);

// Session management
router.post("/sessions", requireAuth, saltedgeAuth, saltedgeController.createSession);

// Connection management
router.post("/connections", requireAuth, saltedgeAuth, saltedgeController.createConnection);
router.put("/connections/:connectionId/refresh", requireAuth, saltedgeController.refreshConnection);
router.get("/connections/:connectionId/status", requireAuth, saltedgeController.checkConnectionStatus);
router.get("/customers/:customerId/connections", requireAuth, saltedgeAuth, saltedgeController.getConnectionsByCustomerId);

// Account and transaction data
router.get("/connections/:connectionId/accounts", requireAuth, saltedgeController.getAccounts);
router.get("/connections/:connectionId/accounts/:accountId/transactions", requireAuth, saltedgeController.getTransactions);

module.exports = router;
