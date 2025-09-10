// src/lib/apideckClient.js
const { Apideck } = require('@apideck/unify');

function getApideckInstance(consumerId) {
  const apideck = new Apideck({
    consumerId: consumerId,
    appId: process.env.APIDECK_APP_ID,
    apiKey: process.env.APIDECK_API_KEY
  });

  return apideck;
}

module.exports = getApideckInstance;
