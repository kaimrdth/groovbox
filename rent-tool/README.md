# NYC Rent Reality Apps Script

Google Sheets-bound Apps Script for comparing NYC apartment rent against one-person, two-person, equal-split, income-weighted, take-home-weighted, and custom-split scenarios.

## Files

- `Code.gs`: Apps Script backend, spreadsheet menu, tax estimates, scenario generation, and web app endpoints.
- `Index.html`: Deployable Apps Script web app UI.
- `appsscript.json`: Apps Script manifest.

## Install

1. Create or open a Google Sheet.
2. Go to Extensions > Apps Script.
3. Add `Code.gs`, `Index.html`, and `appsscript.json` from this repo.
4. Reload the Sheet and run Rent Reality > Set up rent tool.
5. To deploy the UI, use Apps Script Deploy > New deployment > Web app.

## Assumptions

The model assumes W-2 wage income, full-year NYC residency, standard deductions, no credits, no itemized deductions, and employee payroll taxes only. It is a planning tool, not tax advice.

## Tax Data

- Federal brackets and standard deductions: IRS tax year 2026 inflation adjustments.
- Social Security/Medicare: 2026 employee rates and Social Security wage base.
- New York State and NYC resident tax: NY Tax Department 2025 IT-201 resident instructions and 2025 standard deductions.

NY/NYC 2026 resident rate tables were not available from NY Tax Department when this was built, so the script keeps NY constants clearly labeled as `NY_TAX_YEAR = 2025`.
