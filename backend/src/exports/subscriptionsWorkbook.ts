import ExcelJS from 'exceljs'
import { projects, seats, subscriptions } from '../data/store.js'
import { getUsdToInrRate } from './fxRate.js'

const BRAND = '4C4FEB'
const BRAND_DARK = '1E1B4B'
const INK = '14162B'
const MUTED = '656B80'
const SURFACE_SOFT = 'F3F4F9'
const BORDER = 'E4E6EF'
const GREEN = 'DFF5EC'
const GREEN_INK = '12805E'
const AMBER = 'FDF1D9'
const AMBER_INK = 'A2620A'
const RED = 'FDEAED'
const RED_INK = 'C23A4C'

export type ExportCurrency = 'USD' | 'INR'
const convert = (amountUsd: number, currency: ExportCurrency, rate: number) => currency === 'INR' ? amountUsd * rate : amountUsd
const display = (amountUsd: number, currency: ExportCurrency, rate: number) => `${currency === 'INR' ? '₹' : '$'}${convert(amountUsd, currency, rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// The Currency cell (B4) drives every money cell below - flipping it re-evaluates each formula.
// The live USD->INR rate is fetched once per export (see fxRate.ts) and baked in as a literal, since
// Excel has no way to fetch live data itself without external add-ins.
const CURRENCY_CELL = '$B$4'
const moneyFormula = (amountUsd: number, rate: number) => `IF(${CURRENCY_CELL}="INR","₹"&TEXT(${amountUsd}*${rate},"#,##0.00"),"$"&TEXT(${amountUsd},"#,##0.00"))`
const dateFormat = 'mmm d, yyyy'
const thinBorder: Partial<ExcelJS.Borders> = { top: { style: 'thin', color: { argb: `FF${BORDER}` } }, left: { style: 'thin', color: { argb: `FF${BORDER}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER}` } }, right: { style: 'thin', color: { argb: `FF${BORDER}` } } }

const monthLabel = (month: string) => { const [year, monthNumber] = month.split('-').map(Number); return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
const fill = (color: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } })
const budgetTone = (percent: number | null) => percent == null ? { bg: SURFACE_SOFT, ink: MUTED } : percent >= 90 ? { bg: RED, ink: RED_INK } : percent >= 70 ? { bg: AMBER, ink: AMBER_INK } : { bg: GREEN, ink: GREEN_INK }
const styleHeaderRow = (row: ExcelJS.Row) => { row.height = 22; row.eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = fill(BRAND_DARK); cell.alignment = { vertical: 'middle' }; cell.border = thinBorder }) }

const LAST_COLUMN = 'H'

export async function buildSubscriptionsWorkbook(month: string, currency: ExportCurrency = 'USD'): Promise<ExcelJS.Workbook> {
  const monthlyItems = subscriptions.filter((item) => item.month === month)
  const activeItems = monthlyItems.filter((item) => item.status === 'ACTIVE')
  const monthlySpend = activeItems.reduce((sum, item) => sum + item.usdMonthlyCost, 0)
  const totalBudget = projects.reduce((sum, project) => sum + (project.monthlyBudget ?? 0), 0)
  const budgetUsedPercent = totalBudget ? (monthlySpend / totalBudget) * 100 : null
  const remainingBudget = totalBudget ? totalBudget - monthlySpend : null
  const subscribedUsers = new Set(seats.filter((seat) => activeItems.some((item) => item.id === seat.subscriptionId)).map((seat) => seat.email)).size
  const projectRows = projects.map((project) => {
    const spend = monthlyItems.filter((item) => item.projectId === project.id && item.status === 'ACTIVE').reduce((sum, item) => sum + item.usdMonthlyCost, 0)
    const percent = project.monthlyBudget ? (spend / project.monthlyBudget) * 100 : null
    return { name: project.name, spend, budget: project.monthlyBudget, percent }
  })
  const assignments = seats.filter((seat) => monthlyItems.some((item) => item.id === seat.subscriptionId))
  const rate = await getUsdToInrRate()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'EC LABS'
  workbook.created = new Date()

  buildSheet(workbook, month, currency, rate, { monthlySpend, budgetUsedPercent, remainingBudget, subscribedUsers, projectRows }, monthlyItems, assignments)

  return workbook
}

function buildSheet(
  workbook: ExcelJS.Workbook,
  month: string,
  currency: ExportCurrency,
  rate: number,
  data: { monthlySpend: number; budgetUsedPercent: number | null; remainingBudget: number | null; subscribedUsers: number; projectRows: { name: string; spend: number; budget: number | null; percent: number | null }[] },
  items: typeof subscriptions,
  assignments: typeof seats,
) {
  const sheet = workbook.addWorksheet('Subscription Analytics', { views: [{ showGridLines: false }] })
  sheet.columns = [{ width: 26 }, { width: 20 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 16 }]

  sheet.mergeCells(`A2:${LAST_COLUMN}2`)
  const title = sheet.getCell('A2')
  title.value = `EC LABS — ${monthLabel(month)} Subscription Analytics`
  title.font = { size: 18, bold: true, color: { argb: `FF${BRAND_DARK}` } }

  sheet.mergeCells(`A3:${LAST_COLUMN}3`)
  const subtitle = sheet.getCell('A3')
  subtitle.value = 'Monthly spend, budget health, and team coverage across all projects'
  subtitle.font = { size: 11, color: { argb: `FF${MUTED}` } }

  // ---- Live currency control: change B4 and every money cell below recalculates ----
  const currencyLabel = sheet.getCell('A4')
  currencyLabel.value = 'Currency'
  currencyLabel.font = { size: 10, bold: true, color: { argb: `FF${MUTED}` } }
  currencyLabel.alignment = { vertical: 'middle' }
  const currencyCell = sheet.getCell('B4')
  currencyCell.value = currency
  currencyCell.font = { size: 12, bold: true, color: { argb: `FF${BRAND_DARK}` } }
  currencyCell.alignment = { vertical: 'middle', horizontal: 'center' }
  currencyCell.fill = fill('FFFFFF')
  currencyCell.border = thinBorder
  currencyCell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"USD,INR"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Invalid currency', error: 'Choose USD or INR from the list.' }
  const rateNote = sheet.getCell('D4')
  rateNote.value = `1 USD = ₹${rate.toFixed(2)} (live rate at export)`
  rateNote.font = { size: 9, italic: true, color: { argb: `FF${MUTED}` } }
  rateNote.alignment = { vertical: 'middle' }
  sheet.getRow(4).height = 22

  const budgetTint = budgetTone(data.budgetUsedPercent)
  type Kpi = { label: string; range: string; bg: string; ink: string; value: ExcelJS.CellValue; numFmt?: string }
  const kpis: Kpi[] = [
    { label: 'MONTHLY SPEND', range: 'A:B', bg: BRAND, ink: 'FFFFFF', value: { formula: moneyFormula(data.monthlySpend, rate), result: display(data.monthlySpend, currency, rate) } },
    { label: 'BUDGET USED', range: 'C:D', bg: budgetTint.bg, ink: budgetTint.ink, value: data.budgetUsedPercent == null ? '—' : data.budgetUsedPercent / 100, numFmt: data.budgetUsedPercent == null ? undefined : '0%' },
    { label: 'REMAINING BUDGET', range: 'E:F', bg: budgetTint.bg, ink: budgetTint.ink, value: data.remainingBudget == null ? '—' : { formula: moneyFormula(Math.max(data.remainingBudget, 0), rate), result: display(Math.max(data.remainingBudget, 0), currency, rate) } },
    { label: 'SUBSCRIBED USERS', range: 'G:H', bg: SURFACE_SOFT, ink: INK, value: data.subscribedUsers },
  ]
  sheet.getRow(5).height = 20
  sheet.getRow(6).height = 34
  for (const kpi of kpis) {
    const [start, end] = kpi.range.split(':')
    sheet.mergeCells(`${start}5:${end}5`)
    sheet.mergeCells(`${start}6:${end}6`)
    const labelCell = sheet.getCell(`${start}5`)
    labelCell.value = kpi.label
    labelCell.font = { size: 9, bold: true, color: { argb: `FF${kpi.label === 'MONTHLY SPEND' ? 'E4E3FF' : kpi.ink}` } }
    labelCell.alignment = { vertical: 'middle', horizontal: 'center' }
    labelCell.fill = fill(kpi.bg)
    const valueCell = sheet.getCell(`${start}6`)
    valueCell.value = kpi.value
    if (kpi.numFmt) valueCell.numFmt = kpi.numFmt
    valueCell.font = { size: 20, bold: true, color: { argb: `FF${kpi.ink}` } }
    valueCell.alignment = { vertical: 'middle', horizontal: 'center' }
    valueCell.fill = fill(kpi.bg)
  }

  sheet.mergeCells(`A8:${LAST_COLUMN}8`)
  const sectionTitle = sheet.getCell('A8')
  sectionTitle.value = 'Spend by project'
  sectionTitle.font = { size: 13, bold: true, color: { argb: `FF${BRAND_DARK}` } }

  const projectHeaderRow = sheet.getRow(9)
  projectHeaderRow.values = ['Project', 'Monthly spend', 'Budget', 'Usage']
  projectHeaderRow.eachCell({ includeEmpty: false }, (cell) => { cell.font = { bold: true, size: 10, color: { argb: `FF${MUTED}` } }; cell.alignment = { vertical: 'middle' }; cell.border = thinBorder; cell.fill = fill(SURFACE_SOFT) })

  let rowIndex = 10
  for (const project of data.projectRows) {
    const row = sheet.getRow(rowIndex)
    row.getCell(1).value = project.name
    row.getCell(2).value = { formula: moneyFormula(project.spend, rate), result: display(project.spend, currency, rate) }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' }
    if (project.budget == null) { row.getCell(3).value = '—' } else { row.getCell(3).value = { formula: moneyFormula(project.budget, rate), result: display(project.budget, currency, rate) }; row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' } }
    row.getCell(4).value = project.percent == null ? null : project.percent / 100
    row.getCell(4).numFmt = '0%'
    const tone = budgetTone(project.percent)
    row.getCell(4).font = { bold: true, color: { argb: `FF${tone.ink}` } }
    row.getCell(4).fill = fill(tone.bg)
    for (let column = 1; column <= 4; column += 1) { const cell = row.getCell(column); if (!cell.alignment) cell.alignment = { vertical: 'middle' }; cell.border = thinBorder }
    rowIndex += 1
  }

  // ---- Subscription ledger ----
  rowIndex += 2
  sheet.mergeCells(`A${rowIndex}:${LAST_COLUMN}${rowIndex}`)
  const ledgerTitle = sheet.getCell(`A${rowIndex}`)
  ledgerTitle.value = `${monthLabel(month)} subscriptions`
  ledgerTitle.font = { size: 13, bold: true, color: { argb: `FF${BRAND_DARK}` } }
  rowIndex += 1

  const ledgerHeaders = ['Service', 'Vendor', 'Project', 'Billing cycle', 'Monthly cost', 'Payment mode', 'Subscribed users', 'Renewal date']
  const ledgerHeaderRow = sheet.getRow(rowIndex)
  ledgerHeaderRow.values = ledgerHeaders
  styleHeaderRow(ledgerHeaderRow)
  const ledgerHeaderRowIndex = rowIndex
  rowIndex += 1

  const projectName = (projectId: string) => projects.find((project) => project.id === projectId)?.name ?? 'Unknown project'
  items.forEach((item, index) => {
    const assignedSeats = seats.filter((seat) => seat.subscriptionId === item.id)
    const row = sheet.getRow(rowIndex)
    row.values = [
      item.serviceName,
      item.vendor,
      projectName(item.projectId),
      item.billingCycle === 'ONE_OFF' ? 'One-off' : item.billingCycle[0] + item.billingCycle.slice(1).toLowerCase(),
      { formula: moneyFormula(item.usdMonthlyCost, rate), result: display(item.usdMonthlyCost, currency, rate) },
      item.paymentMode,
      assignedSeats.length,
      new Date(item.renewalDate),
    ]
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(8).numFmt = dateFormat
    const rowFill = index % 2 === 1 ? SURFACE_SOFT : null
    for (let column = 1; column <= 8; column += 1) { const cell = row.getCell(column); if (!cell.alignment) cell.alignment = { vertical: 'middle' }; cell.border = thinBorder; if (rowFill) cell.fill = fill(rowFill) }
    rowIndex += 1
  })

  const ledgerLastRow = rowIndex - 1
  sheet.autoFilter = { from: `A${ledgerHeaderRowIndex}`, to: `${LAST_COLUMN}${Math.max(ledgerLastRow, ledgerHeaderRowIndex)}` }

  // ---- Team assignments: which user is on which subscription ----
  rowIndex += 2
  sheet.mergeCells(`A${rowIndex}:${LAST_COLUMN}${rowIndex}`)
  const assignmentsTitle = sheet.getCell(`A${rowIndex}`)
  assignmentsTitle.value = 'Team assignments'
  assignmentsTitle.font = { size: 13, bold: true, color: { argb: `FF${BRAND_DARK}` } }
  rowIndex += 1

  const assignmentHeaders = ['User', 'Email', 'Subscription', 'Project', 'License type', 'Assigned date']
  const assignmentHeaderRow = sheet.getRow(rowIndex)
  assignmentHeaderRow.values = assignmentHeaders
  styleHeaderRow(assignmentHeaderRow)
  rowIndex += 1

  assignments.forEach((seat, index) => {
    const subscription = items.find((item) => item.id === seat.subscriptionId)
    const row = sheet.getRow(rowIndex)
    row.values = [
      seat.name,
      seat.email,
      subscription?.serviceName ?? 'Unknown subscription',
      subscription ? projectName(subscription.projectId) : '—',
      seat.licenseType === 'TEAM' ? 'Team' : 'Individual',
      new Date(seat.assignedAt),
    ]
    row.getCell(6).numFmt = dateFormat
    const rowFill = index % 2 === 1 ? SURFACE_SOFT : null
    for (let column = 1; column <= 6; column += 1) { const cell = row.getCell(column); cell.alignment = { vertical: 'middle' }; cell.border = thinBorder; if (rowFill) cell.fill = fill(rowFill) }
    rowIndex += 1
  })
}
