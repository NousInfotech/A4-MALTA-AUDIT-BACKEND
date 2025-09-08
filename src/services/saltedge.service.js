const saltEdgeClient = require("../config/saltedge.js");
const { supabase } = require("../config/supabase");

class SaltEdgeServices {
  // 0. Create a new Salt Edge customer (map this to your userId)
  async createCustomer(userId) {
    const response = await saltEdgeClient.post(`/customers`, {
      data: {
        identifier: userId, // your internal userId
      },
    });
    return response.data.data; // { id, identifier, ... }
  }

  // 0.1. Retrieve customer (if you already created earlier)
  async getCustomer(customerId) {
    const response = await saltEdgeClient.get(`/customers/${customerId}`);
    return response.data.data;
  }

  async getCustomerByIdentifier(identifier) {
    const response = await saltEdgeClient.get(`/customers`);
    return response.data.data.find(c => c.identifier === identifier);
  }
  

  // 0.2. Delete customer (optional cleanup if user deletes account)
  async deleteCustomer(customerId) {
    const response = await saltEdgeClient.delete(`/customers/${customerId}`);
    return response.data.data;
  }

  // application/services/saltEdge.service.ts
  async createSession(customerId, returnTo) {
    const response = await saltEdgeClient.post(`/connect_sessions/create`, {
      data: {
        customer_id: customerId,
        consent: {
          scopes: ["account_details", "transactions_details"],
          from_date: "2023-01-01",
        },
        attempt: {
          return_to: returnTo,
        },
      },
    });
    return response.data.data; // contains { connect_url, expires_at, ... }
  }

  // 1. Create a new connection request (this gives you a connect_url for widget)
  async createConnection(customerId, providerCode) {
    const response = await saltEdgeClient.post(`/connections`, {
      data: {
        customer_id: customerId,
        provider_code: providerCode,
        consent: {
          scopes: ["account_details", "transactions_details"], // adjust scopes as needed
          from_date: "2023-01-01", // earliest transactions to fetch
        },
        attempt: {
          return_to: "https://your-app.com/callback", // where widget redirects after success
        },
      },
    });
    return response.data.data; // contains { id, connect_url, ... }
  }

  // 1.1. Refresh connection (like Plaid re-auth)
  async refreshConnection(connectionId) {
    const response = await saltEdgeClient.put(
      `/connections/${connectionId}/refresh`,
      {
        data: { attempt: { fetch_scopes: ["accounts", "transactions"] } },
      }
    );
    return response.data.data;
  }

  async checkConnectionStatus(connectionId) {
    try {
      const response = await saltEdgeClient.get(`/connections/${connectionId}`);
      return response.data.data;
    } catch (error) {
      console.error("Error checking connection status:", error);
      throw error;
    }
  }

  // 2. Get accounts for a connection
  async getAccounts(connectionId) {
    const response = await saltEdgeClient.get(`/accounts`, {
      params: { connection_id: connectionId },
    });
    return response.data.data;
    // Each account has fields like:
    // { id, name, nature, currency_code, balance, extra, ... }
  }

  // 3. Get transactions for an account
  async getTransactions(connectionId, accountId, fromDate = "2023-01-01") {
    const response = await saltEdgeClient.get(`/transactions`, {
      params: {
        account_id: accountId,
        from_date: fromDate,
        connection_id: connectionId,
      },
    });
    return response.data.data;
    // Each txn: { id, amount, currency_code, status, made_on, description, extra, ... }
  }

  async getConnectionsByCustomerId(customerId) {
    const response = await saltEdgeClient.get(`/connections`, {
      params: { customer_id: customerId },
    });
    return response.data.data;
  }

  // Get or create consumerId for a user
  async getUserConsumerId(user) {
    try {
      const userId = user.id;
      let bankconnectionid = user.bankconnectionid;

      // If bankconnectionid is provided and not empty, use it as consumerId
      if (bankconnectionid && bankconnectionid.trim() !== '') {
        return bankconnectionid;
      }

      // If bankconnectionid is empty or null, create a new customer
      const customer = await this.createCustomer(userId);
      bankconnectionid = customer.id;

      // Update the user's profile with the new bankconnectionid
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ bankconnectionid: bankconnectionid })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating user bankconnectionid:', updateError);
        throw new Error('Failed to update user profile');
      }

      return bankconnectionid;
    } catch (error) {
      console.error('Error getting user consumerId:', error);
      throw error;
    }
  }
}

const saltEdgeServiceInstance = new SaltEdgeServices();

module.exports = saltEdgeServiceInstance;
