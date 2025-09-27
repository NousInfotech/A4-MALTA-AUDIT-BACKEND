
const axios = require("axios");

const BASE_URL = "https://www.saltedge.com/api/v6";

const saltEdgeClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "App-id": process.env.SALT_EDGE_APP_ID,
    "Secret": process.env.SALT_EDGE_APP_SECRET,
    "Content-Type": "application/json",
    "Accept": "application/json",   // ✅ Required by Salt Edge
  },
});

module.exports = saltEdgeClient;
