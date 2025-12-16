// extractETBData.js

const parseClassification = (classification = "") => {
  const parts = classification.split(" > ");
  return {
    grouping1: parts[0],
    grouping2: parts[1],
    grouping3: parts[2],
  };
};

// -------------------------
// NORMALIZE ETB (CORRECT)
// -------------------------
// Rule:
// - Flip sign FIRST for Equity & Liabilities
// - Then compute finalBalance
// - Never flip again later
const normalizeETB = (rows) => {
  const round = (v) => (typeof v === "number" ? Math.round(v) : 0);

  return rows.map((row) => {
    const { grouping1 } = parseClassification(row.classification);

    const sign = grouping1 === "Equity" || grouping1 === "Liabilities" ? -1 : 1;

    const currentYear = round(row.currentYear) * sign;
    const priorYear = round(row.priorYear) * sign;

    // IMPORTANT: adjustments & reclassification are NUMBERS
    const adjustments = round(row.adjustments) * sign;
    const reclassification = round(row.reclassification) * sign;

    const finalBalance = currentYear + adjustments + reclassification;

    return {
      ...row,
      currentYear,
      priorYear,
      adjustments,
      reclassification,
      finalBalance,
    };
  });
};

// -------------------------
// LEAD SHEET INDEX
// -------------------------
const buildLeadSheetIndex = (tree) => {
  const index = {};

  for (const g1 of tree) {
    for (const g2 of g1.children) {
      for (const g3 of g2.children) {
        index[g3.group] = g3.id;
      }
    }
  }

  return index;
};

// -------------------------
// LEAD SHEETS
// -------------------------
const buildLeadSheetTree = (rows) => {
  const tree = [];
  let idCounter = 1;

  const getOrCreate = (arr, key, factory) => {
    let node = arr.find((n) => n.group === key);
    if (!node) {
      node = factory();
      arr.push(node);
    }
    return node;
  };

  for (const row of rows) {
    const { grouping1, grouping2, grouping3 } = parseClassification(
      row.classification
    );

    if (!grouping1 || !grouping2 || !grouping3) continue;

    const g1 = getOrCreate(tree, grouping1, () => ({
      level: "grouping1",
      group: grouping1,
      children: [],
    }));

    const g2 = getOrCreate(g1.children, grouping2, () => ({
      level: "grouping2",
      group: grouping2,
      children: [],
    }));

    const g3 = getOrCreate(g2.children, grouping3, () => ({
      level: "grouping3",
      id: `LS_${idCounter++}`,
      group: grouping3,
      totals: {
        currentYear: 0,
        priorYear: 0,
        adjustments: 0,
        reclassification: 0,
        finalBalance: 0,
      },
      rows: [],
    }));

    g3.totals.currentYear += row.currentYear || 0;
    g3.totals.priorYear += row.priorYear || 0;
    g3.totals.adjustments += row.adjustments || 0;
    g3.totals.reclassification += row.reclassification || 0;
    g3.totals.finalBalance += row.finalBalance || 0;
    g3.rows.push(row.rowId);
  }

  return tree;
};

// -------------------------
// INCOME STATEMENT
// -------------------------
const deriveIncomeStatement = (tree, currentYear) => {
  const priorYear = currentYear - 1;
  const leadIndex = buildLeadSheetIndex(tree);
  const equity = tree.find((n) => n.group === "Equity");
  const pl = equity?.children.find(
    (n) => n.group === "Current Year Profits & Losses"
  );

  const empty = (year) => ({
    year,
    net_result: 0,
    resultType: "net_profit",
    breakdowns: {},
  });

  if (!pl) {
    return {
      prior_year: empty(priorYear),
      current_year: empty(currentYear),
    };
  }

  const collect = (field) => {
    const totals = {};
    for (const g3 of pl.children) {
      totals[g3.group] = g3.totals[field] || 0;
    }
    return totals;
  };

  const calculate = (totals) => {
    const grossProfit =
      (totals["Revenue"] || 0) + (totals["Cost of sales"] || 0);

    const operatingProfit =
      grossProfit +
      (totals["Sales and marketing expenses"] || 0) +
      (totals["Administrative expenses"] || 0) +
      (totals["Other operating income"] || 0);

    const netProfitBeforeTax =
      operatingProfit +
      (totals["Investment income"] || 0) +
      (totals["Investment losses"] || 0) +
      (totals["Finance costs"] || 0) +
      (totals["Share of profit of subsidiary"] || 0) +
      (totals["PBT Expenses"] || 0);

    const net = netProfitBeforeTax + (totals["Income tax expense"] || 0);

    return {
      net_result: net,
      resultType: net >= 0 ? "net_profit" : "net_loss",
      breakdowns: Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [
          k,
          {
            value: Math.abs(v),
            accounts: leadIndex[k] ? [leadIndex[k]] : [],
          },
        ])
      ),
    };
  };

  return {
    prior_year: {
      year: priorYear,
      ...calculate(collect("priorYear")),
    },
    current_year: {
      year: currentYear,
      ...calculate(collect("finalBalance")),
    },
  };
};

// -------------------------
// RETAINED EARNINGS
// -------------------------
const deriveRetainedEarnings = (tree, incomeStatement, currentYear) => {
  const priorYear = currentYear - 1;

  const equity = tree.find((n) => n.group === "Equity");
  const eqBlock = equity?.children.find((n) => n.group === "Equity");
  const re = eqBlock?.children.find((n) => n.group === "Retained earnings");

  const priorValue = re?.totals?.priorYear || 0;
  const net = incomeStatement.current_year.net_result;

  return {
    prior_year: { year: priorYear, value: priorValue },
    current_year: {
      year: currentYear,
      value: priorValue + net,
    },
  };
};

// -------------------------
// COLLECT GROUP ACCOUNTS
// -------------------------

const collectGroupAccounts = (tree, groupName, skip = {}) => {
  const node = tree.find((n) => n.group === groupName);
  if (!node) return [];

  const ids = [];

  for (const g2 of node.children) {
    if (skip.grouping2?.includes(g2.group)) continue;

    for (const g3 of g2.children) {
      if (skip.grouping3?.includes(g3.group)) continue;
      ids.push(g3.id);
    }
  }

  return ids;
};

// -------------------------
// BALANCE SHEET
// -------------------------
const deriveBalanceSheet = (tree, retainedEarnings, currentYear) => {
  const priorYear = currentYear - 1;

  const sum = (group, field, skip = {}) => {
    const node = tree.find((n) => n.group === group);
    if (!node) return 0;

    let total = 0;
    for (const g2 of node.children) {
      if (skip.grouping2?.includes(g2.group)) continue;

      for (const g3 of g2.children) {
        if (skip.grouping3?.includes(g3.group)) continue;
        total += g3.totals[field] || 0;
      }
    }
    return total;
  };

  const assetsCY = sum("Assets", "finalBalance");
  const liabilitiesCY = sum("Liabilities", "finalBalance");
  const equityCY =
    sum("Equity", "finalBalance", {
      grouping2: ["Current Year Profits & Losses"],
      grouping3: ["Retained earnings"],
    }) + retainedEarnings.current_year.value;

  const assetsPY = sum("Assets", "priorYear");
  const liabilitiesPY = sum("Liabilities", "priorYear");
  const equityPY =
    sum("Equity", "priorYear", {
      grouping2: ["Current Year Profits & Losses"],
      grouping3: ["Retained earnings"],
    }) + retainedEarnings.prior_year.value;

  // Calculate totals for balance sheet
  const totalAssetsCY = assetsCY;
  const totalEquityAndLiabilitiesCY = equityCY + liabilitiesCY;
  
  const totalAssetsPY = assetsPY;
  const totalEquityAndLiabilitiesPY = equityPY + liabilitiesPY;

  return {
    prior_year: {
      year: priorYear,
      totals: {
        assets: {
          value: assetsPY,
          accounts: collectGroupAccounts(tree, "Assets"),
        },
        liabilities: {
          value: liabilitiesPY,
          accounts: collectGroupAccounts(tree, "Liabilities"),
        },
        equity: {
          value: equityPY,
          accounts: collectGroupAccounts(tree, "Equity", {
            grouping2: ["Current Year Profits & Losses"],
            grouping3: ["Retained earnings"],
          }),
        },
        total_assets: {
          value: totalAssetsPY,
          accounts: collectGroupAccounts(tree, "Assets"),
        },
        total_equity_and_liabilities: {
          value: totalEquityAndLiabilitiesPY,
          accounts: [
            ...collectGroupAccounts(tree, "Equity", {
              grouping2: ["Current Year Profits & Losses"],
              grouping3: ["Retained earnings"],
            }),
            ...collectGroupAccounts(tree, "Liabilities"),
          ],
        },
      },
      balanced: Math.abs(assetsPY - (liabilitiesPY + equityPY)) < 1,
    },

    current_year: {
      year: currentYear,
      totals: {
        assets: {
          value: assetsCY,
          accounts: collectGroupAccounts(tree, "Assets"),
        },
        liabilities: {
          value: liabilitiesCY,
          accounts: collectGroupAccounts(tree, "Liabilities"),
        },
        equity: {
          value: equityCY,
          accounts: collectGroupAccounts(tree, "Equity", {
            grouping2: ["Current Year Profits & Losses"],
            grouping3: ["Retained earnings"],
          }),
        },
        total_assets: {
          value: totalAssetsCY,
          accounts: collectGroupAccounts(tree, "Assets"),
        },
        total_equity_and_liabilities: {
          value: totalEquityAndLiabilitiesCY,
          accounts: [
            ...collectGroupAccounts(tree, "Equity", {
              grouping2: ["Current Year Profits & Losses"],
              grouping3: ["Retained earnings"],
            }),
            ...collectGroupAccounts(tree, "Liabilities"),
          ],
        },
      },
      balanced: Math.abs(assetsCY - (liabilitiesCY + equityCY)) < 1,
    },
  };
};

// -------------------------
// EXPORT
// -------------------------
exports.extractETBData = (etbRows, year) => {
  const normalized = normalizeETB(etbRows);
  const leadSheets = buildLeadSheetTree(normalized);
  const incomeStatement = deriveIncomeStatement(leadSheets, year);
  const retainedEarnings = deriveRetainedEarnings(
    leadSheets,
    incomeStatement,
    year
  );
  const balanceSheet = deriveBalanceSheet(leadSheets, retainedEarnings, year);

  return {
    lead_sheets: leadSheets,
    income_statement: incomeStatement,
    balance_sheet: balanceSheet,
  };
};
