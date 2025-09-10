const saltEdgeService = require("../services/saltedge.service.js");

const SaltedgeController = {
    createCustomer: async (req, res) => {
        try {
            const { userId } = req.body;
            const customer = await saltEdgeService.createCustomer(userId);
            res.status(200).json(customer);
        } catch (error) {
            console.error('Error creating customer:', error);
            res.status(500).json({ error: 'Failed to create customer' });
        }
    },
    
    getCustomer: async (req, res) => {
        try {
            const consumerId = req.bankconnectionid;
            const customer = await saltEdgeService.getCustomer(consumerId);
            res.status(200).json(customer);
        } catch (error) {
            console.error('Error getting customer:', error);
            res.status(500).json({ error: 'Failed to get customer' });
        }
    },

    deleteCustomer: async (req, res) => {
        try {
            const consumerId = req.bankconnectionid;
            const result = await saltEdgeService.deleteCustomer(consumerId);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error deleting customer:', error);
            res.status(500).json({ error: 'Failed to delete customer' });
        }
    },

    createSession: async (req, res) => {
        try {
            const consumerId = req.bankconnectionid;
            const { returnTo } = req.body;
            const session = await saltEdgeService.createSession(consumerId, returnTo);
            res.status(200).json(session);
        } catch (error) {
            console.error('Error creating session:', error);
            res.status(500).json({ error: 'Failed to create session' });
        }
    },

    createConnection: async (req, res) => {
        try {
            const consumerId = req.bankconnectionid;
            const { providerCode } = req.body;
            const connection = await saltEdgeService.createConnection(consumerId, providerCode);
            res.status(200).json(connection);
        } catch (error) {
            console.error('Error creating connection:', error);
            res.status(500).json({ error: 'Failed to create connection' });
        }
    },

    refreshConnection: async (req, res) => {
        try {
            const { connectionId } = req.params;
            const connection = await saltEdgeService.refreshConnection(connectionId);
            res.status(200).json(connection);
        } catch (error) {
            console.error('Error refreshing connection:', error);
            res.status(500).json({ error: 'Failed to refresh connection' });
        }
    },

    checkConnectionStatus: async (req, res) => {
        try {
            const { connectionId } = req.params;
            const status = await saltEdgeService.checkConnectionStatus(connectionId);
            res.status(200).json(status);
        } catch (error) {
            console.error('Error checking connection status:', error);
            res.status(500).json({ error: 'Failed to check connection status' });
        }
    },

    getAccounts: async (req, res) => {
        try {
            const { connectionId } = req.params;
            const accounts = await saltEdgeService.getAccounts(connectionId);
            res.status(200).json(accounts);
        } catch (error) {
            console.error('Error getting accounts:', error);
            res.status(500).json({ error: 'Failed to get accounts' });
        }
    },

    getTransactions: async (req, res) => {
        try {
            const { connectionId, accountId } = req.params;
            const { fromDate } = req.query;
            const transactions = await saltEdgeService.getTransactions(connectionId, accountId, fromDate);
            res.status(200).json(transactions);
        } catch (error) {
            console.error('Error getting transactions:', error);
            res.status(500).json({ error: 'Failed to get transactions' });
        }
    },

    getConnectionsByCustomerId: async (req, res) => {
        try {
            const consumerId = req.bankconnectionid;
            const connections = await saltEdgeService.getConnectionsByCustomerId(consumerId);
            res.status(200).json(connections);
        } catch (error) {
            console.error('Error getting connections:', error);
            res.status(500).json({ error: 'Failed to get connections' });
        }
    }
};

module.exports = SaltedgeController;