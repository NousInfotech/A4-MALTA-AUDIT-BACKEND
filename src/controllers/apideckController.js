const apideckService = require("../services/apideck.service.js");

const ApideckController = {
    // Vault session management
    createVaultSession: async (req, res) => {
        try {
            const { consumerId } = req.body;
            const sessionToken = await apideckService.createVaultSession(consumerId);
            res.status(200).json({ sessionToken });
        } catch (error) {
            console.error('Error creating vault session:', error);
            res.status(500).json({ error: 'Failed to create vault session' });
        }
    },

    // Consumer services
    getServicesByConsumerId: async (req, res) => {
        try {
            const { consumerId } = req.params;
            const services = await apideckService.getServicesByConsumerId(consumerId);
            res.status(200).json(services);
        } catch (error) {
            console.error('Error getting services:', error);
            res.status(500).json({ error: 'Failed to get services' });
        }
    },

    // Journal entries
    getJournalEntries: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const journalEntries = await apideckService.getJournalEntries(consumerId, connectionId);
            res.status(200).json(journalEntries);
        } catch (error) {
            console.error('Error getting journal entries:', error);
            res.status(500).json({ error: 'Failed to get journal entries' });
        }
    },

    // General ledger
    getLedgerAccounts: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const ledgerAccounts = await apideckService.getLedgerAccounts(consumerId, connectionId);
            res.status(200).json(ledgerAccounts);
        } catch (error) {
            console.error('Error getting ledger accounts:', error);
            res.status(500).json({ error: 'Failed to get ledger accounts' });
        }
    },

    // Financial reports
    getProfitAndLoss: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const profitAndLoss = await apideckService.getProfitAndLoss(consumerId, connectionId);
            res.status(200).json(profitAndLoss);
        } catch (error) {
            console.error('Error getting profit and loss:', error);
            res.status(500).json({ error: 'Failed to get profit and loss report' });
        }
    },

    getBalanceSheet: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const balanceSheet = await apideckService.getBalanceSheet(consumerId, connectionId);
            res.status(200).json(balanceSheet);
        } catch (error) {
            console.error('Error getting balance sheet:', error);
            res.status(500).json({ error: 'Failed to get balance sheet' });
        }
    },

    getAgedReceivables: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const agedReceivables = await apideckService.getAgedReceivables(consumerId, connectionId);
            res.status(200).json(agedReceivables);
        } catch (error) {
            console.error('Error getting aged receivables:', error);
            res.status(500).json({ error: 'Failed to get aged receivables' });
        }
    },

    getAgedPayables: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const agedPayables = await apideckService.getAgedPayables(consumerId, connectionId);
            res.status(200).json(agedPayables);
        } catch (error) {
            console.error('Error getting aged payables:', error);
            res.status(500).json({ error: 'Failed to get aged payables' });
        }
    },

    // Customers and suppliers
    getCustomers: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const customers = await apideckService.getCustomers(consumerId, connectionId);
            res.status(200).json(customers);
        } catch (error) {
            console.error('Error getting customers:', error);
            res.status(500).json({ error: 'Failed to get customers' });
        }
    },

    getSuppliers: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const suppliers = await apideckService.getSuppliers(consumerId, connectionId);
            res.status(200).json(suppliers);
        } catch (error) {
            console.error('Error getting suppliers:', error);
            res.status(500).json({ error: 'Failed to get suppliers' });
        }
    },

    // Bills and payments
    getBills: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const bills = await apideckService.getBills(consumerId, connectionId);
            res.status(200).json(bills);
        } catch (error) {
            console.error('Error getting bills:', error);
            res.status(500).json({ error: 'Failed to get bills' });
        }
    },

    getBillPayments: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const billPayments = await apideckService.getBillPayments(consumerId, connectionId);
            res.status(200).json(billPayments);
        } catch (error) {
            console.error('Error getting bill payments:', error);
            res.status(500).json({ error: 'Failed to get bill payments' });
        }
    },

    getPayments: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const payments = await apideckService.getPayments(consumerId, connectionId);
            res.status(200).json(payments);
        } catch (error) {
            console.error('Error getting payments:', error);
            res.status(500).json({ error: 'Failed to get payments' });
        }
    },

    // Expenses
    getExpenses: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const expenses = await apideckService.getExpenses(consumerId, connectionId);
            res.status(200).json(expenses);
        } catch (error) {
            console.error('Error getting expenses:', error);
            res.status(500).json({ error: 'Failed to get expenses' });
        }
    },

    // Bank feed
    getBankFeed: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const bankFeed = await apideckService.getBankFeed(consumerId, connectionId);
            res.status(200).json(bankFeed);
        } catch (error) {
            console.error('Error getting bank feed:', error);
            res.status(500).json({ error: 'Failed to get bank feed' });
        }
    },

    getBankFeedStatements: async (req, res) => {
        try {
            const { consumerId, connectionId } = req.params;
            const bankFeedStatements = await apideckService.getBankFeedStatements(consumerId, connectionId);
            res.status(200).json(bankFeedStatements);
        } catch (error) {
            console.error('Error getting bank feed statements:', error);
            res.status(500).json({ error: 'Failed to get bank feed statements' });
        }
    }
};

module.exports = ApideckController;
