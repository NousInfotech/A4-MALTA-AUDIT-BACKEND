const router = require("express").Router();
const saltedgeController = require("../controllers/saltedgeController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Customer management
router.post("/customers", requireAuth, saltedgeController.createCustomer);
router.get("/customers/:customerId", requireAuth, saltedgeController.getCustomer);
router.delete("/customers/:customerId", requireAuth, requireRole("admin"), saltedgeController.deleteCustomer);

// Session management
router.post("/sessions", requireAuth, saltedgeController.createSession);

// Connection management
router.post("/connections", requireAuth, saltedgeController.createConnection);
router.put("/connections/:connectionId/refresh", requireAuth, saltedgeController.refreshConnection);
router.get("/connections/:connectionId/status", requireAuth, saltedgeController.checkConnectionStatus);
router.get("/customers/:customerId/connections", requireAuth, saltedgeController.getConnectionsByCustomerId);

// Account and transaction data
router.get("/connections/:connectionId/accounts", requireAuth, saltedgeController.getAccounts);
router.get("/connections/:connectionId/accounts/:accountId/transactions", requireAuth, saltedgeController.getTransactions);

module.exports = router;
