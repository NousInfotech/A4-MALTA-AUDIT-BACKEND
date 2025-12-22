const fs = require('fs');
const path = require('path');

/**
 * Analyze variance between two AI review result files
 */
function analyzeVariance() {
  // Read both files
  const variance23 = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../fs-variances-json/variance2.3.json'), 'utf8')
  );
  const variance24 = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../fs-variances-json/variance2.4.json'), 'utf8')
  );

  const data23 = variance23.data;
  const data24 = variance24.data;

  console.log('='.repeat(80));
  console.log('VARIANCE ANALYSIS: variance2.3.json vs variance2.4.json');
  console.log('='.repeat(80));
  console.log('');

  // Helper function to get test IDs from a section
  const getTestIds = (section) => {
    if (!section || !section.items) return new Set();
    return new Set(section.items.map(item => item.test_id));
  };

  // Analyze Section A (Confirmed Correct)
  const a23 = getTestIds(data23.A);
  const a24 = getTestIds(data24.A);
  const aOnly23 = [...a23].filter(id => !a24.has(id));
  const aOnly24 = [...a24].filter(id => !a23.has(id));
  const aCommon = [...a23].filter(id => a24.has(id));

  console.log('SECTION A - CONFIRMED CORRECT ITEMS:');
  console.log(`  variance2.3: ${a23.size} items`);
  console.log(`  variance2.4: ${a24.size} items`);
  console.log(`  Common: ${aCommon.length} items (${aCommon.join(', ')})`);
  if (aOnly23.length > 0) {
    console.log(`  Only in 2.3: ${aOnly23.join(', ')}`);
  }
  if (aOnly24.length > 0) {
    console.log(`  Only in 2.4: ${aOnly24.join(', ')}`);
  }
  const aVariance = ((aOnly23.length + aOnly24.length) / Math.max(a23.size, a24.size)) * 100;
  console.log(`  Variance: ${aVariance.toFixed(2)}%`);
  console.log('');

  // Analyze Section B (Critical Errors)
  const b23 = getTestIds(data23.B);
  const b24 = getTestIds(data24.B);
  const bOnly23 = [...b23].filter(id => !b24.has(id));
  const bOnly24 = [...b24].filter(id => !b23.has(id));
  const bCommon = [...b23].filter(id => b24.has(id));

  console.log('SECTION B - CRITICAL ERRORS:');
  console.log(`  variance2.3: ${b23.size} items`);
  console.log(`  variance2.4: ${b24.size} items`);
  if (bCommon.length > 0) {
    console.log(`  Common: ${bCommon.length} items (${bCommon.join(', ')})`);
  }
  if (bOnly23.length > 0) {
    console.log(`  Only in 2.3: ${bOnly23.join(', ')}`);
    bOnly23.forEach(testId => {
      const item = data23.B.items.find(i => i.test_id === testId);
      console.log(`    - ${testId}: ${item.type} - ${item.description.substring(0, 80)}...`);
    });
  }
  if (bOnly24.length > 0) {
    console.log(`  Only in 2.4: ${bOnly24.join(', ')}`);
    bOnly24.forEach(testId => {
      const item = data24.B.items.find(i => i.test_id === testId);
      console.log(`    - ${testId}: ${item.type} - ${item.description.substring(0, 80)}...`);
    });
  }
  const bVariance = b23.size === 0 && b24.size === 0 ? 0 : 
                    (b23.size === 0 || b24.size === 0) ? 100 :
                    ((bOnly23.length + bOnly24.length) / Math.max(b23.size, b24.size)) * 100;
  console.log(`  Variance: ${bVariance.toFixed(2)}%`);
  console.log('');

  // Analyze Section C (Disclosure & Regulatory Breaches)
  const c23 = getTestIds(data23.C);
  const c24 = getTestIds(data24.C);
  const cOnly23 = [...c23].filter(id => !c24.has(id));
  const cOnly24 = [...c24].filter(id => !c23.has(id));
  const cCommon = [...c23].filter(id => c24.has(id));

  console.log('SECTION C - DISCLOSURE & REGULATORY BREACHES:');
  console.log(`  variance2.3: ${c23.size} items`);
  console.log(`  variance2.4: ${c24.size} items`);
  console.log(`  Common: ${cCommon.length} items (${cCommon.join(', ')})`);
  if (cOnly23.length > 0) {
    console.log(`  Only in 2.3: ${cOnly23.join(', ')}`);
  }
  if (cOnly24.length > 0) {
    console.log(`  Only in 2.4: ${cOnly24.join(', ')}`);
  }
  const cVariance = ((cOnly23.length + cOnly24.length) / Math.max(c23.size, c24.size)) * 100;
  console.log(`  Variance: ${cVariance.toFixed(2)}%`);
  console.log('');

  // Overall test ID coverage
  const all23 = new Set([...a23, ...b23, ...c23]);
  const all24 = new Set([...a24, ...b24, ...c24]);
  const allOnly23 = [...all23].filter(id => !all24.has(id));
  const allOnly24 = [...all24].filter(id => !all23.has(id));
  const allCommon = [...all23].filter(id => all24.has(id));

  console.log('OVERALL TEST COVERAGE:');
  console.log(`  variance2.3: ${all23.size} unique tests`);
  console.log(`  variance2.4: ${all24.size} unique tests`);
  console.log(`  Common: ${allCommon.length} tests`);
  if (allOnly23.length > 0) {
    console.log(`  Only in 2.3: ${allOnly23.join(', ')}`);
  }
  if (allOnly24.length > 0) {
    console.log(`  Only in 2.4: ${allOnly24.join(', ')}`);
  }
  const overallVariance = ((allOnly23.length + allOnly24.length) / Math.max(all23.size, all24.size)) * 100;
  console.log(`  Overall Variance: ${overallVariance.toFixed(2)}%`);
  console.log('');

  // Section movement analysis
  console.log('TEST ID MOVEMENT BETWEEN SECTIONS:');
  const movedTests = [];
  
  // Check tests that moved from B to A (T10)
  if (b23.has('T10') && a24.has('T10')) {
    movedTests.push({
      testId: 'T10',
      from: 'B (Critical Error)',
      to: 'A (Confirmed Correct)',
      impact: 'MAJOR: Critical error resolved'
    });
  }
  
  // Check tests that moved from A to B
  if (a23.has('T13') && b24.has('T13')) {
    movedTests.push({
      testId: 'T13',
      from: 'A (Confirmed Correct)',
      to: 'B (Critical Error)',
      impact: 'MAJOR: New critical error detected'
    });
  } else if (!a23.has('T13') && b24.has('T13')) {
    movedTests.push({
      testId: 'T13',
      from: 'Not found',
      to: 'B (Critical Error)',
      impact: 'MAJOR: New critical error detected'
    });
  }
  
  // Check tests that disappeared from A
  if (a23.has('T7') && !a24.has('T7') && !b24.has('T7') && !c24.has('T7')) {
    movedTests.push({
      testId: 'T7',
      from: 'A (Confirmed Correct)',
      to: 'Not found',
      impact: 'Test removed from results'
    });
  }

  if (movedTests.length > 0) {
    movedTests.forEach(move => {
      console.log(`  ${move.testId}: ${move.from} → ${move.to}`);
      console.log(`    Impact: ${move.impact}`);
    });
  } else {
    console.log('  No significant test movements detected');
  }
  console.log('');

  // Final verdict comparison
  console.log('FINAL VERDICT:');
  console.log(`  variance2.3: ${data23.E.verdict}`);
  console.log(`  variance2.4: ${data24.E.verdict}`);
  const verdictMatch = data23.E.verdict === data24.E.verdict;
  console.log(`  Match: ${verdictMatch ? 'YES' : 'NO'}`);
  console.log('');

  // Summary statistics
  console.log('='.repeat(80));
  console.log('SUMMARY STATISTICS:');
  console.log('='.repeat(80));
  console.log(`Section A Variance: ${aVariance.toFixed(2)}%`);
  console.log(`Section B Variance: ${bVariance.toFixed(2)}%`);
  console.log(`Section C Variance: ${cVariance.toFixed(2)}%`);
  console.log(`Overall Test Coverage Variance: ${overallVariance.toFixed(2)}%`);
  console.log('');
  
  const avgVariance = (aVariance + bVariance + cVariance) / 3;
  console.log(`Average Section Variance: ${avgVariance.toFixed(2)}%`);
  console.log('');

  // Key findings
  console.log('KEY FINDINGS:');
  if (bVariance === 100) {
    console.log('  ⚠️  CRITICAL: Different critical errors detected between runs');
    console.log('     - This indicates non-deterministic behavior in critical error detection');
  }
  if (aVariance > 0) {
    console.log('  ⚠️  WARNING: Tests moved between confirmed correct and other sections');
  }
  if (!verdictMatch) {
    console.log('  ⚠️  CRITICAL: Final verdict differs between runs');
  }
  if (movedTests.some(m => m.impact.includes('MAJOR'))) {
    console.log('  ⚠️  CRITICAL: Major test classification changes detected');
  }
  console.log('');
}

// Run analysis
try {
  analyzeVariance();
} catch (error) {
  console.error('Error analyzing variance:', error);
  process.exit(1);
}





