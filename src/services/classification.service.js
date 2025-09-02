// src/services/classification.service.js (CommonJS)
const receivables = require("../data/classifications/receivables.js");
const payables = require("../data/classifications/payables.js");
const ppe = require("../data/classifications/ppe.js");
const invProp = require("../data/classifications/investment_property.js");
const otherInv = require("../data/classifications/investments.js");
const intangibles = require("../data/classifications/intangible_assets.js");
const pnl = require("../data/classifications/profit_and_loss.js");
const inventory = require("../data/classifications/inventory.js");

const MOD = {
  RECEIVABLES: (fw) => receivables.getManualFields(fw),
  PAYABLES: (fw) => payables.getManualFields(fw),
  PPE: (fw) => ppe.getManualFields(fw),
  INVESTMENT_PROPERTY: (fw) => invProp.getManualFields(fw),
  INVESTMENTS: (fw) => otherInv.getManualFields(fw),
  INTANGIBLES: (fw) => intangibles.getManualFields(fw),
  PNL: (fw) => pnl.getManualFields(fw),
  INVENTORY: (fw) => inventory.getManualFields(fw),
};

const ASSET_LIAB_MAP = {
  // Assets (current)
  "Cash & Cash Equivalents": "RECEIVABLES", // you can create a separate cash pack later
  "Trade Receivables": "RECEIVABLES",
  "Other Receivables": "RECEIVABLES",
  "Prepayments": "RECEIVABLES",
  "Inventory": "INVENTORY",
  "Recoverable VAT/Tax": "RECEIVABLES",
  // Assets (non-current)
  "Property, Plant & Equipment": "PPE",
  "Intangible Assets": "INTANGIBLES",
  "Investments": "INVESTMENTS",
  "Deferred Tax Asset": "PNL", // or a dedicated TAX pack if preferred
  "Long-term Receivables/Deposits": "RECEIVABLES",
  // Liabilities (current)
  "Trade Payables": "PAYABLES",
  "Accruals": "PAYABLES",
  "Taxes Payable": "PAYABLES", // or TAX pack
  "Short-term Borrowings/Overdraft": "PAYABLES",
  "Other Payables": "PAYABLES",
  // Liabilities (non-current)
  "Borrowings (Long-term)": "PAYABLES",
  "Provisions": "PAYABLES",
  "Deferred Tax Liability": "PAYABLES", // or TAX pack
  "Lease Liabilities": "PAYABLES",
};

function isTopLine(category) {
  return ["Equity", "Income", "Expenses"].includes(category);
}
function isAssetOrLiability(category) {
  return ["Assets", "Liabilities"].includes(category);
}
function lastSegment(path) {
  const parts = path.split(">").map(s => s.trim());
  return parts[parts.length - 1];
}
function topSegment(path) {
  return path.split(">")[0].trim();
}

function normalizeSelectionToModules(selections = []) {
  const normalized = new Set();
  for (const s of selections) {
    const top = topSegment(s);
    if (isTopLine(top)) {
      normalized.add("PNL");
      continue;
    }
    if (isAssetOrLiability(top)) {
      const leaf = lastSegment(s);
      const mod = ASSET_LIAB_MAP[leaf];
      if (mod) normalized.add(mod);
    }
  }
  return Array.from(normalized);
}

function buildManualPacks(framework, selections) {
  const modules = normalizeSelectionToModules(selections);
  return modules.map(m => MOD[m](framework));
}

function buildOneShotExamples(framework, selections) {
  const packs = buildManualPacks(framework, selections);
  return packs.map(p => {
    const sample = p.fields.find(f => f.type === "procedure") || p.fields[0];
    return { classificationTitle: p.title, sectionId: p.sectionId, sample };
  });
}

module.exports = {
  normalizeSelectionToModules,
  buildManualPacks,
  buildOneShotExamples
};
