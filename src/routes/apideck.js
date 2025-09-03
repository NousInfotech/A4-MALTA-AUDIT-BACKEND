const router = require("express").Router();
const apideckController = require("../controllers/apideckController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Vault session management
router.post("/vault/sessions", requireAuth, apideckController.createVaultSession);

// Consumer services
router.get("/consumers/:consumerId/services", requireAuth, apideckController.getServicesByConsumerId);

// Journal entries and general ledger
router.get("/consumers/:consumerId/connections/:connectionId/journal-entries", requireAuth, apideckController.getJournalEntries);
router.get("/consumers/:consumerId/connections/:connectionId/ledger-accounts", requireAuth, apideckController.getLedgerAccounts);

// Financial reports
router.get("/consumers/:consumerId/connections/:connectionId/profit-and-loss", requireAuth, apideckController.getProfitAndLoss);
router.get("/consumers/:consumerId/connections/:connectionId/balance-sheet", requireAuth, apideckController.getBalanceSheet);
router.get("/consumers/:consumerId/connections/:connectionId/aged-receivables", requireAuth, apideckController.getAgedReceivables);
router.get("/consumers/:consumerId/connections/:connectionId/aged-payables", requireAuth, apideckController.getAgedPayables);

// Customers and suppliers
router.get("/consumers/:consumerId/connections/:connectionId/customers", requireAuth, apideckController.getCustomers);
router.get("/consumers/:consumerId/connections/:connectionId/suppliers", requireAuth, apideckController.getSuppliers);

// Bills and payments
router.get("/consumers/:consumerId/connections/:connectionId/bills", requireAuth, apideckController.getBills);
router.get("/consumers/:consumerId/connections/:connectionId/bill-payments", requireAuth, apideckController.getBillPayments);
router.get("/consumers/:consumerId/connections/:connectionId/payments", requireAuth, apideckController.getPayments);

// Expenses
router.get("/consumers/:consumerId/connections/:connectionId/expenses", requireAuth, apideckController.getExpenses);

// Bank feed
router.get("/consumers/:consumerId/connections/:connectionId/bank-feed", requireAuth, apideckController.getBankFeed);
router.get("/consumers/:consumerId/connections/:connectionId/bank-feed-statements", requireAuth, apideckController.getBankFeedStatements);

module.exports = router;
