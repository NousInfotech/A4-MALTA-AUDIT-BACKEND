const getApideckInstance  = require("../config/apideck.js");

class ApideckService {
// valut api method
async createVaultSession(consumerId) {
  const apideck = getApideckInstance(consumerId);

  const response = await apideck.vault.sessions.create({
    session: {
      settings: {
        allowActions: ["delete", "disconnect", "reauthorize"], // Leave empty to hide all.
        hideResourceSettings: true, // Hide configurable resources for integrations
        unifiedApis: ["accounting"], // Only show these APIs (omit to show all)
        sessionLength: "1h", // Valid duration (max: 1 week)
      },
    },
  });

  return response.createSessionResponse?.data.sessionToken;
}

// Get journal entries
async getJournalEntries(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.journalEntries.list({ serviceId: connectionId });
}

async getServicesByConsumerId(consumerId) {
  const services = getApideckInstance(consumerId);
  return services.vault.consumers.get({
    consumerId: consumerId,
  });
}

// Get general ledger
async getLedgerAccounts(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.ledgerAccounts.list({ serviceId: connectionId });
}

// Get profit and loss report
async getProfitAndLoss(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.profitAndLoss.get({ serviceId: connectionId });
}

// Get balance sheet
async getBalanceSheet(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.balanceSheet.get({ serviceId: connectionId });
}

// Get aged receivables
async getAgedReceivables(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.agedDebtors.get({ serviceId: connectionId });
}

// Get aged payables
async getAgedPayables(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.agedCreditors.get({ serviceId: connectionId });
}

// Customers
async getCustomers(consumerId, connectionId) {
  const customers = getApideckInstance(consumerId).accounting;
  return customers.customers.list({ serviceId: connectionId });
}

// Suppliers
async getSuppliers(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.suppliers.list({ serviceId: connectionId });
}

// Bill Payments
async getBillPayments(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.billPayments.list({ serviceId: connectionId });
}

// Bills
async getBills(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.bills.list({ serviceId: connectionId });
}

// Expenses
async getExpenses(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.expenses.list({ serviceId: connectionId });
}

// Payments
async getPayments(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.payments.list({ serviceId: connectionId });
}

// Bank Feed & Bank Feed Statements
async getBankFeed(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.bankFeedAccounts.list({ serviceId: connectionId });
}

async getBankFeedStatements(
  consumerId,
  connectionId
) {
  const accounting = getApideckInstance(consumerId).accounting;
  return accounting.bankFeedStatements.list({ serviceId: connectionId });
}
}

const apideckInstance = new ApideckService();

module.exports = apideckInstance