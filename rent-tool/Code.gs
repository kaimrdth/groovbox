const TAX_YEAR = 2026;
const NY_TAX_YEAR = 2025;

const DEFAULTS = {
  monthlyRent: 4200,
  personAIncome: 135000,
  personBIncome: 115000,
  personALabel: 'Person A',
  personBLabel: 'Person B',
  includeTaxes: true,
  filingMode: 'separate',
  splitMode: 'equal',
  customPersonAShare: 50
};

const FEDERAL_STANDARD_DEDUCTION = {
  single: 16100,
  married: 32200
};

const FEDERAL_BRACKETS = {
  single: [
    [0, 12400, 0.10],
    [12400, 50400, 0.12],
    [50400, 105700, 0.22],
    [105700, 201775, 0.24],
    [201775, 256225, 0.32],
    [256225, 640600, 0.35],
    [640600, Infinity, 0.37]
  ],
  married: [
    [0, 24800, 0.10],
    [24800, 100800, 0.12],
    [100800, 211400, 0.22],
    [211400, 403550, 0.24],
    [403550, 512450, 0.32],
    [512450, 768700, 0.35],
    [768700, Infinity, 0.37]
  ]
};

const NY_STANDARD_DEDUCTION = {
  single: 8000,
  married: 16050
};

const NYS_BRACKETS = {
  single: [
    [0, 8500, 0.04],
    [8500, 11700, 0.045],
    [11700, 13900, 0.0525],
    [13900, 80650, 0.055],
    [80650, 215400, 0.06],
    [215400, 1077550, 0.0685],
    [1077550, 5000000, 0.0965],
    [5000000, 25000000, 0.103],
    [25000000, Infinity, 0.109]
  ],
  married: [
    [0, 17150, 0.04],
    [17150, 23600, 0.045],
    [23600, 27900, 0.0525],
    [27900, 161550, 0.055],
    [161550, 323200, 0.06],
    [323200, 2155350, 0.0685],
    [2155350, 5000000, 0.0965],
    [5000000, 25000000, 0.103],
    [25000000, Infinity, 0.109]
  ]
};

const NYC_BRACKETS = {
  single: [
    [0, 12000, 0.03078],
    [12000, 25000, 0.03762],
    [25000, 50000, 0.03819],
    [50000, Infinity, 0.03876]
  ],
  married: [
    [0, 21600, 0.03078],
    [21600, 45000, 0.03762],
    [45000, 90000, 0.03819],
    [90000, Infinity, 0.03876]
  ]
};

const PAYROLL_TAX = {
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184500,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: {
    single: 200000,
    married: 250000
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Rent Reality')
    .addItem('Set up rent tool', 'setupRentTool')
    .addItem('Refresh scenarios', 'refreshScenariosFromSheet')
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('NYC Rent Reality')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDefaults() {
  return {
    defaults: DEFAULTS,
    taxYear: TAX_YEAR,
    nyTaxYear: NY_TAX_YEAR,
    sourceNote: getSourceNote()
  };
}

function setupRentTool() {
  const ss = SpreadsheetApp.getActive();
  const inputs = getOrCreateSheet_(ss, 'Inputs');
  const scenarios = getOrCreateSheet_(ss, 'Scenarios');
  const sources = getOrCreateSheet_(ss, 'Sources');

  buildInputsSheet_(inputs);
  buildScenariosSheet_(scenarios);
  buildSourcesSheet_(sources);
  refreshScenariosFromSheet();

  ss.setActiveSheet(inputs);
}

function refreshScenariosFromSheet() {
  const ss = SpreadsheetApp.getActive();
  const inputs = getOrCreateSheet_(ss, 'Inputs');
  const scenarios = getOrCreateSheet_(ss, 'Scenarios');
  const values = inputs.getRange('B2:B9').getValues().flat();
  const request = {
    monthlyRent: numberOrDefault_(values[0], DEFAULTS.monthlyRent),
    personAIncome: numberOrDefault_(values[1], DEFAULTS.personAIncome),
    personBIncome: numberOrDefault_(values[2], DEFAULTS.personBIncome),
    personALabel: values[3] || DEFAULTS.personALabel,
    personBLabel: values[4] || DEFAULTS.personBLabel,
    filingMode: values[5] || DEFAULTS.filingMode,
    splitMode: values[6] || DEFAULTS.splitMode,
    customPersonAShare: numberOrDefault_(values[7], DEFAULTS.customPersonAShare),
    includeTaxes: true
  };

  const result = calculateRentScenarios(request);
  writeScenarioResults_(scenarios, result);
  return result;
}

function writeCurrentScenarioToSheet(request) {
  const ss = SpreadsheetApp.getActive();
  const inputs = getOrCreateSheet_(ss, 'Inputs');
  const scenarios = getOrCreateSheet_(ss, 'Scenarios');
  const sources = getOrCreateSheet_(ss, 'Sources');
  const data = Object.assign({}, DEFAULTS, request || {});

  buildInputsSheet_(inputs, data);
  buildScenariosSheet_(scenarios);
  buildSourcesSheet_(sources);

  const result = calculateRentScenarios(data);
  writeScenarioResults_(scenarios, result);
  return result;
}

function calculateRentScenarios(request) {
  const data = Object.assign({}, DEFAULTS, request || {});
  const monthlyRent = Math.max(0, Number(data.monthlyRent) || 0);
  const annualRent = monthlyRent * 12;
  const incomeA = Math.max(0, Number(data.personAIncome) || 0);
  const incomeB = Math.max(0, Number(data.personBIncome) || 0);
  const combinedIncome = incomeA + incomeB;
  const labelA = data.personALabel || DEFAULTS.personALabel;
  const labelB = data.personBLabel || DEFAULTS.personBLabel;
  const filingMode = data.filingMode === 'joint' ? 'joint' : 'separate';

  const taxesA = estimateTaxes_(incomeA, 'single');
  const taxesB = estimateTaxes_(incomeB, 'single');
  const jointTaxes = estimateTaxes_(combinedIncome, 'married');
  const separateTakeHome = taxesA.takeHome + taxesB.takeHome;
  const jointTakeHome = jointTaxes.takeHome;
  const combinedTakeHome = filingMode === 'joint' ? jointTakeHome : separateTakeHome;

  const equalShares = [annualRent / 2, annualRent / 2];
  const grossWeightedShares = combinedIncome > 0
    ? [annualRent * incomeA / combinedIncome, annualRent * incomeB / combinedIncome]
    : equalShares;
  const customA = clamp_(Number(data.customPersonAShare) || 0, 0, 100) / 100;
  const customShares = [annualRent * customA, annualRent * (1 - customA)];
  const afterTaxWeightedShares = combinedTakeHome > 0
    ? [annualRent * taxesA.takeHome / separateTakeHome, annualRent * taxesB.takeHome / separateTakeHome]
    : equalShares;

  const rows = [
    makeScenario_(`${labelA} pays full rent`, labelA, annualRent, incomeA, taxesA.takeHome, annualRent),
    makeScenario_(`${labelB} pays full rent`, labelB, annualRent, incomeB, taxesB.takeHome, annualRent),
    makeHouseholdScenario_('Couple pays together', annualRent, combinedIncome, combinedTakeHome, annualRent),
    makeSplitScenario_('Split 50/50', labelA, labelB, equalShares, incomeA, incomeB, taxesA.takeHome, taxesB.takeHome, annualRent),
    makeSplitScenario_('Split by gross income', labelA, labelB, grossWeightedShares, incomeA, incomeB, taxesA.takeHome, taxesB.takeHome, annualRent),
    makeSplitScenario_('Split by estimated take-home', labelA, labelB, afterTaxWeightedShares, incomeA, incomeB, taxesA.takeHome, taxesB.takeHome, annualRent),
    makeSplitScenario_(`Custom split ${Math.round(customA * 100)}/${Math.round((1 - customA) * 100)}`, labelA, labelB, customShares, incomeA, incomeB, taxesA.takeHome, taxesB.takeHome, annualRent)
  ];

  return {
    inputs: data,
    taxYear: TAX_YEAR,
    nyTaxYear: NY_TAX_YEAR,
    monthlyRent,
    annualRent,
    people: [
      Object.assign({ label: labelA, income: incomeA }, taxesA),
      Object.assign({ label: labelB, income: incomeB }, taxesB)
    ],
    household: {
      grossIncome: combinedIncome,
      separateTakeHome,
      jointTakeHome,
      selectedTakeHome: combinedTakeHome,
      filingMode
    },
    rows,
    sourceNote: getSourceNote()
  };
}

function estimateTaxes_(grossIncome, filingStatus) {
  const status = filingStatus === 'married' ? 'married' : 'single';
  const federalTaxable = Math.max(0, grossIncome - FEDERAL_STANDARD_DEDUCTION[status]);
  const nyTaxable = Math.max(0, grossIncome - NY_STANDARD_DEDUCTION[status]);
  const federal = progressiveTax_(federalTaxable, FEDERAL_BRACKETS[status]);
  const nys = estimateNysTax_(grossIncome, nyTaxable, status);
  const nyc = progressiveTax_(nyTaxable, NYC_BRACKETS[status]);
  const fica = Math.min(grossIncome, PAYROLL_TAX.socialSecurityWageBase) * PAYROLL_TAX.socialSecurityRate;
  const medicareBase = grossIncome * PAYROLL_TAX.medicareRate;
  const additionalMedicare = Math.max(0, grossIncome - PAYROLL_TAX.additionalMedicareThreshold[status]) * PAYROLL_TAX.additionalMedicareRate;
  const payroll = fica + medicareBase + additionalMedicare;
  const totalTax = federal + nys + nyc + payroll;

  return {
    federal,
    nys,
    nyc,
    payroll,
    totalTax,
    takeHome: Math.max(0, grossIncome - totalTax),
    effectiveTaxRate: grossIncome > 0 ? totalTax / grossIncome : 0
  };
}

function progressiveTax_(taxableIncome, brackets) {
  return brackets.reduce((tax, bracket) => {
    const lower = bracket[0];
    const upper = bracket[1];
    const rate = bracket[2];
    if (taxableIncome <= lower) return tax;
    return tax + (Math.min(taxableIncome, upper) - lower) * rate;
  }, 0);
}

function estimateNysTax_(nyAdjustedGrossIncome, nyTaxableIncome, filingStatus) {
  const status = filingStatus === 'married' ? 'married' : 'single';
  const scheduleTax = progressiveTax_(nyTaxableIncome, NYS_BRACKETS[status]);

  if (nyAdjustedGrossIncome <= 107650) return scheduleTax;

  if (status === 'single') {
    if (nyTaxableIncome <= 215400) {
      return flatRateRecapture_(nyTaxableIncome, nyAdjustedGrossIncome, scheduleTax, 0.06, 107650, 157650);
    }
    if (nyTaxableIncome <= 1077550) {
      return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 215400, 568, 1831);
    }
    if (nyTaxableIncome <= 5000000) {
      return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 1077550, 2399, 30172);
    }
    if (nyTaxableIncome <= 25000000) {
      return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 5000000, 32571, 32500);
    }
    return nyTaxableIncome * 0.109;
  }

  if (nyTaxableIncome <= 161550) {
    return flatRateRecapture_(nyTaxableIncome, nyAdjustedGrossIncome, scheduleTax, 0.055, 107650, 157650);
  }
  if (nyTaxableIncome <= 323200) {
    return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 161550, 333, 807);
  }
  if (nyTaxableIncome <= 2155350) {
    return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 323200, 1140, 2747);
  }
  if (nyTaxableIncome <= 5000000) {
    return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 2155350, 3887, 60350);
  }
  if (nyTaxableIncome <= 25000000) {
    return recaptureTax_(scheduleTax, nyAdjustedGrossIncome, 5000000, 64237, 32500);
  }
  return nyTaxableIncome * 0.109;
}

function flatRateRecapture_(taxableIncome, adjustedGrossIncome, scheduleTax, flatRate, start, fullAt) {
  const flatTax = taxableIncome * flatRate;
  if (adjustedGrossIncome >= fullAt) return flatTax;
  const ratio = clamp_((adjustedGrossIncome - start) / (fullAt - start), 0, 1);
  return scheduleTax + (flatTax - scheduleTax) * ratio;
}

function recaptureTax_(scheduleTax, adjustedGrossIncome, start, baseAmount, incrementalBenefit) {
  const ratio = clamp_((adjustedGrossIncome - start) / 50000, 0, 1);
  return scheduleTax + baseAmount + incrementalBenefit * ratio;
}

function makeScenario_(scenario, payer, annualShare, grossIncome, takeHome, householdRent) {
  return decorateRow_({
    scenario,
    payer,
    annualShare,
    monthlyShare: annualShare / 12,
    grossIncome,
    takeHome,
    rentGrossPct: grossIncome > 0 ? annualShare / grossIncome : 0,
    rentNetPct: takeHome > 0 ? annualShare / takeHome : 0,
    householdRentPct: grossIncome > 0 ? householdRent / grossIncome : 0
  });
}

function makeHouseholdScenario_(scenario, annualShare, grossIncome, takeHome, householdRent) {
  return decorateRow_({
    scenario,
    payer: 'Household',
    annualShare,
    monthlyShare: annualShare / 12,
    grossIncome,
    takeHome,
    rentGrossPct: grossIncome > 0 ? annualShare / grossIncome : 0,
    rentNetPct: takeHome > 0 ? annualShare / takeHome : 0,
    householdRentPct: grossIncome > 0 ? householdRent / grossIncome : 0
  });
}

function makeSplitScenario_(scenario, labelA, labelB, shares, incomeA, incomeB, takeHomeA, takeHomeB, householdRent) {
  const shareA = shares[0] || 0;
  const shareB = shares[1] || 0;
  const rowA = makeScenario_(`${scenario}: ${labelA}`, labelA, shareA, incomeA, takeHomeA, householdRent);
  const rowB = makeScenario_(`${scenario}: ${labelB}`, labelB, shareB, incomeB, takeHomeB, householdRent);
  return {
    scenario,
    payer: `${labelA} / ${labelB}`,
    annualShare: shareA + shareB,
    monthlyShare: (shareA + shareB) / 12,
    grossIncome: incomeA + incomeB,
    takeHome: takeHomeA + takeHomeB,
    rentGrossPct: incomeA + incomeB > 0 ? (shareA + shareB) / (incomeA + incomeB) : 0,
    rentNetPct: takeHomeA + takeHomeB > 0 ? (shareA + shareB) / (takeHomeA + takeHomeB) : 0,
    householdRentPct: incomeA + incomeB > 0 ? householdRent / (incomeA + incomeB) : 0,
    zone: zoneForPct_((shareA + shareB) / Math.max(1, incomeA + incomeB)),
    recommendation: recommendationForPct_((shareA + shareB) / Math.max(1, incomeA + incomeB)),
    detail: [rowA, rowB]
  };
}

function decorateRow_(row) {
  row.zone = zoneForPct_(row.rentGrossPct);
  row.recommendation = recommendationForPct_(row.rentGrossPct);
  return row;
}

function zoneForPct_(pct) {
  if (pct <= 0.25) return 'Comfortable';
  if (pct <= 0.30) return 'Recommended';
  if (pct <= 0.40) return 'Stretch';
  return 'High';
}

function recommendationForPct_(pct) {
  if (pct <= 0.25) return 'Very workable by the 30% gross-income rule.';
  if (pct <= 0.30) return 'Inside the common recommended rent zone.';
  if (pct <= 0.40) return 'Possible stretch; check savings, debt, and utilities.';
  return 'High rent burden; likely constraining after-tax cash flow.';
}

function writeScenarioResults_(sheet, result) {
  sheet.clear();
  sheet.getRange('A1').setValue('NYC Rent Reality Scenarios').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2').setValue(`Monthly rent: ${formatCurrency_(result.monthlyRent)} | Federal tax year ${result.taxYear}; NY/NYC tax tables ${result.nyTaxYear}`);
  sheet.getRange('A4:I4').setValues([[
    'Scenario',
    'Payer',
    'Monthly share',
    'Annual share',
    'Gross income',
    'Estimated take-home',
    'Rent % gross',
    'Rent % take-home',
    'Zone'
  ]]).setFontWeight('bold');

  const rows = [];
  result.rows.forEach((row) => {
    rows.push(rowToSheet_(row));
    if (row.detail) {
      row.detail.forEach((detailRow) => rows.push(rowToSheet_(detailRow)));
    }
  });

  if (rows.length) {
    const range = sheet.getRange(5, 1, rows.length, 9);
    range.setValues(rows);
    sheet.getRange(5, 3, rows.length, 4).setNumberFormat('$#,##0');
    sheet.getRange(5, 7, rows.length, 2).setNumberFormat('0.0%');
    applyZoneFormatting_(sheet.getRange(5, 9, rows.length, 1));
  }

  sheet.getRange('K4:L8').setValues([
    ['Zone', 'Rent % of gross income'],
    ['Comfortable', '<= 25%'],
    ['Recommended', '25% to 30%'],
    ['Stretch', '30% to 40%'],
    ['High', '> 40%']
  ]);
  sheet.getRange('K4:L4').setFontWeight('bold');
  applyZoneFormatting_(sheet.getRange('K5:K8'));
  sheet.autoResizeColumns(1, 12);
}

function rowToSheet_(row) {
  return [
    row.scenario,
    row.payer,
    row.monthlyShare,
    row.annualShare,
    row.grossIncome,
    row.takeHome,
    row.rentGrossPct,
    row.rentNetPct,
    row.zone
  ];
}

function applyZoneFormatting_(range) {
  const rules = [
    ['Comfortable', '#d9ead3'],
    ['Recommended', '#fff2cc'],
    ['Stretch', '#fce5cd'],
    ['High', '#f4cccc']
  ].map(([text, color]) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(text)
    .setBackground(color)
    .setRanges([range])
    .build());

  const sheet = range.getSheet();
  sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat(rules));
}

function buildInputsSheet_(sheet, values) {
  const data = Object.assign({}, DEFAULTS, values || {});
  sheet.clear();
  sheet.getRange('A1').setValue('Rent Reality Inputs').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2:B9').setValues([
    ['Monthly rent', data.monthlyRent],
    ['Person A annual gross income', data.personAIncome],
    ['Person B annual gross income', data.personBIncome],
    ['Person A label', data.personALabel],
    ['Person B label', data.personBLabel],
    ['Filing mode (separate or joint)', data.filingMode],
    ['Split mode (equal, gross, takehome, custom)', data.splitMode],
    ['Custom Person A share %', data.customPersonAShare]
  ]);
  sheet.getRange('A11').setValue('Use Rent Reality > Refresh scenarios after editing inputs.').setFontStyle('italic');
  sheet.getRange('B2:B4').setNumberFormat('$#,##0');
  sheet.autoResizeColumns(1, 2);
}

function buildScenariosSheet_(sheet) {
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  sheet.setFrozenRows(4);
}

function buildSourcesSheet_(sheet) {
  sheet.clear();
  sheet.getRange('A1').setValue('Tax Sources and Assumptions').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A3:B10').setValues([
    ['Federal brackets and standard deduction', 'IRS tax year 2026 inflation adjustments, IR-2025-103 / Rev. Proc. 2025-32'],
    ['Payroll taxes', 'SSA 2026 wage base and IRS Social Security/Medicare withholding rates'],
    ['NY State standard deduction', 'NY Tax Department 2025 standard deductions'],
    ['NY State resident brackets', 'NY Tax Department 2025 IT-201 instructions'],
    ['NYC resident brackets', 'NY Tax Department 2025 IT-201 instructions'],
    ['Assumption', 'W-2 wage income, full-year NYC resident, standard deductions, no credits, no itemized deductions'],
    ['Planning zone', 'Common gross-rent rule: recommended at 25% to 30%; stretch above 30%; high above 40%'],
    ['Caution', 'This is planning math, not tax advice. Actual withholding and tax filing can differ.']
  ]);
  sheet.autoResizeColumns(1, 2);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function numberOrDefault_(value, defaultValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function clamp_(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency_(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

function getSourceNote() {
  return [
    `Federal income tax uses IRS ${TAX_YEAR} brackets and standard deductions.`,
    `NY State and NYC resident income tax use NY Tax Department ${NY_TAX_YEAR} IT-201 resident tables, the latest NY tables checked when this was built.`,
    'Payroll tax estimates include employee Social Security and Medicare only.',
    'Assumes W-2 income, full-year NYC residency, standard deductions, and no credits or itemized deductions.'
  ].join(' ');
}
