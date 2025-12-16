const round = (v) => (typeof v === "number" ? Math.round(v) : 0);

const buildJournalMap = (journals) => {
  const map = new Map();

  for (const j of journals || []) {
    if (j.status && j.status !== "posted") continue;

    for (const e of j.entries || []) {
      const rowId = e.etbRowId;
      if (!rowId) continue;

      const dr = round(e.dr || 0);
      const cr = round(e.cr || 0);
      const net = dr - cr;

      if (!map.has(rowId)) {
        map.set(rowId, {
          rowId,
          dr: 0,
          cr: 0,
          value: 0,
          refs: new Set(),
        });
      }

      const bucket = map.get(rowId);
      bucket.dr += dr;
      bucket.cr += cr;
      bucket.value += net;
      bucket.refs.add(j._id.toString());
    }
  }

  return map;
};

const sanitizeJournalSummary = (map) =>
  Array.from(map.values()).map((v) => ({
    rowId: v.rowId,
    dr: v.dr,
    cr: v.cr,
    value: v.value,
    refs: Array.from(v.refs),
  }));

exports.applyAdjustmentsAndReclassifications = ({
  etbRows,
  adjustments,
  reclassifications,
}) => {
  const adjMap = buildJournalMap(adjustments);
  const recMap = buildJournalMap(reclassifications);

  const appliedETB = etbRows.map((row) => {
    const adj = adjMap.get(row._id?.toString());
    const rec = recMap.get(row._id?.toString());

    return {
      rowId: row._id,
      code: row.code,
      accountName: row.accountName,

      currentYear: round(row.currentYear),
      priorYear: round(row.priorYear),

      adjustments: round(row.adjustments || 0),
      reclassifications: round(row.reclassification || 0),

      finalBalance: round(row.finalBalance),

      classification: row.classification,
    };
  });

  return {
    etb: appliedETB,
    adjustments: sanitizeJournalSummary(adjMap),
    reclassifications: sanitizeJournalSummary(recMap),
  };
};
