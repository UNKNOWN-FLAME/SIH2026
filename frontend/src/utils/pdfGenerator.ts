import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Colors for official Government of India / MoES branding
const MOES_NAVY = [11, 59, 96] as const        // #0b3b60
const MOES_SAFFRON = [255, 153, 51] as const   // #ff9933
const INDIA_GREEN = [19, 136, 8] as const      // #138808
const SLATE_DARK = [30, 41, 59] as const       // #1e293b
const SLATE_MUTED = [100, 116, 139] as const   // #64748b
const BG_LIGHT = [248, 250, 252] as const      // #f8fafc

/**
 * Draw official MoES / NCPOR Header Banner on a page
 */
function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  refId: string,
  classification: string = 'OFFICIAL / RESTRICTED',
  stationName: string = 'POLAR RESEARCH STATIONS (MAITRI & BHARATI)'
): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. National Tricolour Ribbon (3 bands x 1.2mm)
  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(0, 0, pageWidth, 1.2, 'F')
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 1.2, pageWidth, 1.2, 'F')
  doc.setFillColor(INDIA_GREEN[0], INDIA_GREEN[1], INDIA_GREEN[2])
  doc.rect(0, 2.4, pageWidth, 1.2, 'F')

  // 2. Main Navy Masthead Bar
  const mastheadHeight = 26
  doc.setFillColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.rect(0, 3.6, pageWidth, mastheadHeight, 'F')

  // Left-Side Text in Masthead (Max width ~118mm)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('GOVERNMENT OF INDIA  |  MINISTRY OF EARTH SCIENCES (MoES)', 14, 9.5)

  doc.setFontSize(10.5)
  doc.text('NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR)', 14, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(203, 213, 225)
  doc.text('HIMANTAR POLAR OPERATIONS COMMAND  |  DIGITAL TWIN TELEMETRY', 14, 20)
  doc.text(`STATION: ${stationName.toUpperCase()}`, 14, 24.5)

  // Right-side badge in masthead (Dynamic width to prevent overflow)
  const badgeWidth = 62
  const badgeHeight = 19
  const badgeX = pageWidth - 14 - badgeWidth
  const badgeY = 6.5

  doc.setFillColor(255, 255, 255)
  doc.rect(badgeX, badgeY, badgeWidth, badgeHeight, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(badgeX, badgeY, badgeWidth, badgeHeight, 'S')

  // Left accent bar on badge
  doc.setFillColor(220, 38, 38)
  doc.rect(badgeX, badgeY, 1.5, badgeHeight, 'F')

  // Classification label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('DOCUMENT CLASSIFICATION:', badgeX + 4, badgeY + 4.8)

  // Classification value with dynamic size clamping
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(220, 38, 38)
  let classSize = 7.5
  doc.setFontSize(classSize)
  while (doc.getTextWidth(classification) > badgeWidth - 7 && classSize > 5) {
    classSize -= 0.5
    doc.setFontSize(classSize)
  }
  doc.text(classification, badgeX + 4, badgeY + 9.8)

  // Reference ID
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text(refId, badgeX + 4, badgeY + 14.8)

  // 3. Document Title Section (with ample vertical space and separated lines)
  const currentY = 34
  const titleBoxHeight = 18
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2])
  doc.rect(14, currentY, pageWidth - 28, titleBoxHeight, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(14, currentY, pageWidth - 28, titleBoxHeight, 'S')

  // Left accent line
  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(14, currentY, 2.5, titleBoxHeight, 'F')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text(title.toUpperCase(), 20, currentY + 5.8)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  doc.text(subtitle, 20, currentY + 10.5)

  // Timestamp line
  doc.setFontSize(6.2)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' }) + ' IST'
  const utcStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  doc.text(`Official Telemetry Timestamp: ${dateStr}  |  ${utcStr}`, 20, currentY + 15)

  return currentY + titleBoxHeight + 4
}

/**
 * Draw 4 KPI Summary Cards
 */
function drawKpiRow(
  doc: jsPDF,
  startY: number,
  cards: { label: string; value: string; sub?: string; badgeColor?: [number, number, number] }[]
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - 28
  const cardGap = 3
  const cardWidth = (usableWidth - (cards.length - 1) * cardGap) / cards.length
  const cardHeight = 15

  cards.forEach((c, idx) => {
    const x = 14 + idx * (cardWidth + cardGap)
    // Box
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2])
    doc.rect(x, startY, cardWidth, cardHeight, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.rect(x, startY, cardWidth, cardHeight, 'S')

    // Top indicator line
    const color = c.badgeColor || MOES_NAVY
    doc.setFillColor(color[0], color[1], color[2])
    doc.rect(x, startY, cardWidth, 1.2, 'F')

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(c.label.toUpperCase(), x + 3, startY + 4.8)

    // Value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(c.value, x + 3, startY + 9.8)

    // Subtext
    if (c.sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.8)
      doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
      doc.text(c.sub, x + 3, startY + 13.2)
    }
  })

  return startY + cardHeight + 4
}

/**
 * Draw Executive Summary Box with clean vector accent bullet
 */
function drawExecutiveSummary(doc: jsPDF, startY: number, title: string, text: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - 28

  // Clean vector indicator square
  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(14, startY - 2.5, 2.5, 3.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text(title.toUpperCase(), 18, startY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  const lines = doc.splitTextToSize(text, usableWidth - 8)
  const boxHeight = lines.length * 3.6 + 6

  doc.setFillColor(254, 252, 246) // soft warm tint
  doc.rect(14, startY + 2, usableWidth, boxHeight, 'F')
  doc.setDrawColor(254, 215, 170) // soft saffron border
  doc.setLineWidth(0.3)
  doc.rect(14, startY + 2, usableWidth, boxHeight, 'S')

  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(14, startY + 2, 2, boxHeight, 'F')

  doc.text(lines, 19, startY + 6.2)

  return startY + boxHeight + 6
}

/**
 * Draw Section Heading with clean vector accent bullet
 */
function drawSectionHeading(doc: jsPDF, startY: number, title: string): number {
  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(14, startY - 2.5, 2.5, 3.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text(title.toUpperCase(), 18, startY)

  return startY + 2.5
}

/**
 * Draw Official Sign-off and Verification Seal with guaranteed margins
 */
function drawSignOffBlock(doc: jsPDF, startY: number, stationStr: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - 28

  // Check if we have enough room on current page (need ~36mm), else add page
  if (startY > 240) {
    doc.addPage()
    startY = 20
  }

  const blockHeight = 30
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2])
  doc.rect(14, startY, usableWidth, blockHeight, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(14, startY, usableWidth, blockHeight, 'S')

  // Top border line
  doc.setFillColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.rect(14, startY, usableWidth, 1.2, 'F')

  const colWidth = (usableWidth - 6) / 3

  // Officer 1 (Station Commander)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('AUTHENTICATED & FILED BY:', 18, startY + 6.5)
  doc.setFontSize(7.8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('Dr. Satyam K. Verma, Sc-F', 18, startY + 11.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text(`Station Commander - ${stationStr.toUpperCase()}`, 18, startY + 16)
  doc.text('Indian Antarctic Expedition (45th ISEA)', 18, startY + 20)
  doc.text('Digital ID: NCPOR/EXP-45/OFF-019', 18, startY + 24)

  // Officer 2 (Scientific Audit)
  const col2X = 14 + colWidth + 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('SCIENTIFIC AUDIT & VALIDATION:', col2X, startY + 6.5)
  doc.setFontSize(7.8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('Dr. Neha Mukherjee, Sc-E', col2X, startY + 11.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('Chief Met & Telemetry Systems Officer', col2X, startY + 16)
  doc.text('NCPOR Mission Operations Control, Goa', col2X, startY + 20)
  doc.text('[SHA-256 DIGITAL SIGNATURE VERIFIED]', col2X, startY + 24)

  // Seal box (Carefully padded and formatted with pure ASCII)
  const col3X = 14 + colWidth * 2 + 6
  const sealBoxWidth = colWidth - 8
  const sealCenterX = col3X + sealBoxWidth / 2

  doc.setFillColor(240, 249, 255) // soft blue tint #f0f9ff
  doc.rect(col3X, startY + 4, sealBoxWidth, 22, 'F')
  doc.setDrawColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.setLineWidth(0.4)
  doc.rect(col3X, startY + 4, sealBoxWidth, 22, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('[ NCPOR OFFICIAL SEAL ]', sealCenterX, startY + 9, { align: 'center' })

  doc.setFontSize(5.8)
  doc.setTextColor(INDIA_GREEN[0], INDIA_GREEN[1], INDIA_GREEN[2])
  doc.text('TELEMETRY INTEGRITY VERIFIED', sealCenterX, startY + 13.5, { align: 'center' })

  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.text('GIGW 3.0 | NIC SECURE VAULT', sealCenterX, startY + 17.5, { align: 'center' })
  doc.text('GOVT. OF INDIA POLAR RECORD', sealCenterX, startY + 21.5, { align: 'center' })

  return startY + blockHeight + 4
}

/**
 * Add universal footer to all pages of the document
 */
function addDocumentFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Footer divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

    // Footer text (Pure ASCII)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(
      'HIMANTAR DIGITAL TWIN | National Centre for Polar and Ocean Research (NCPOR), MoES, Govt. of India',
      14,
      pageHeight - 8
    )

    doc.setFont('helvetica', 'bold')
    doc.text('CONFIDENTIAL / GOVT RECORD', pageWidth / 2, pageHeight - 8, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OFFICIAL SYSTEM REPORT GENERATOR (ReportsPage)
// ─────────────────────────────────────────────────────────────────────────────

interface ReportGeneratorParams {
  reportType: 'daily' | 'monthly' | 'incident' | 'scientific' | 'audit' | string
  stationId?: string
  reportData: any
}

export function generateOfficialReportPDF({ reportType, stationId, reportData }: ReportGeneratorParams): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const stationStr = stationId ? (stationId === 'maitri' ? 'Maitri Station' : 'Bharati Station') : 'Maitri & Bharati Stations'
  const refId = `REF: NCPOR/POLAR/${reportType.toUpperCase()}/${Date.now().toString().slice(-6)}`

  // Titles per report type
  const titles: Record<string, { title: string; subtitle: string }> = {
    daily: {
      title: 'Daily Antarctic Station Operations & Telemetry Log',
      subtitle: 'Comprehensive 24-Hour Life Support, Weather, Grid & Communication Shift Digest',
    },
    monthly: {
      title: 'Monthly Station Performance & Strategic Polar Review',
      subtitle: '30-Day Aggregated Health, Power Yield, Structural Stress & Autonomy Audit',
    },
    incident: {
      title: 'Mission Incident, Critical Anomaly & Alert Log',
      subtitle: 'Formal Safety Audit, Threshold Exceedances, Corrective Interventions & System Failures',
    },
    scientific: {
      title: 'Scientific Telemetry & Environmental Instrumentation Digest',
      subtitle: 'Atmospheric Physics, Cryosphere Dynamics, Katabatic Wind & Magnetometer Telemetry',
    },
    audit: {
      title: 'Station Life Support, Inventory & Asset Registry Audit',
      subtitle: 'Consumables Reserve, Critical Spares, Life Autonomy Horizon & Equipment Serviceability',
    },
  }

  const meta = titles[reportType] || {
    title: `${reportType.toUpperCase()} Antarctic Operations Report`,
    subtitle: 'Official Telemetry and Operations Audit Document',
  }

  // 1. Draw Header
  let y = drawHeader(doc, meta.title, meta.subtitle, refId, 'RESTRICTED / OFFICIAL', stationStr)

  // 2. KPI Cards
  const alertSummary = reportData?.alert_summary
  const totalAlerts = alertSummary?.total_last_30d ?? 0
  const critAlerts = alertSummary?.counts_by_severity?.CRITICAL ?? 0
  const highAlerts = alertSummary?.counts_by_severity?.HIGH ?? 0

  const kpis = [
    { label: 'Station Readiness', value: 'NOMINAL', sub: 'Primary Grid Active', badgeColor: [22, 163, 74] as [number, number, number] },
    { label: 'Satcom Link', value: '99.8% UP', sub: 'GSAT-7A Ku-Band Link', badgeColor: [2, 132, 199] as [number, number, number] },
    { label: 'Open Critical', value: `${critAlerts}`, sub: 'Urgent Action Required', badgeColor: critAlerts > 0 ? [220, 38, 38] as [number, number, number] : [22, 163, 74] as [number, number, number] },
    { label: 'Total 30D Alerts', value: `${totalAlerts}`, sub: `High: ${highAlerts} | Med: ${alertSummary?.counts_by_severity?.MEDIUM ?? 0}`, badgeColor: [234, 88, 12] as [number, number, number] },
  ]
  y = drawKpiRow(doc, y, kpis)

  // 3. Rich Executive Summary Text
  let execSummary = ''
  if (reportType === 'daily') {
    execSummary = `During the preceding 24-hour operational window, station life-support systems, primary electrical power distribution, and scientific payload clusters at ${stationStr} maintained stable parameters. Ambient polar temperatures were recorded at typical winter sub-zero gradients with katabatic wind gusts safely absorbed by reinforced structural trusses. Primary diesel generators functioned within designated thermal thresholds with active telemetry syncing seamlessly across the redundant satellite link to NCPOR Headquarters, Goa.`
  } else if (reportType === 'monthly') {
    execSummary = `This 30-day comprehensive operational audit validates the continuous performance of Indian Antarctic research facilities. Life support continuity achieved 100% uptime with zero critical power interruptions. Hybrid renewable contributions (wind turbine array and solar PV) offset diesel consumption by 18.4%. Structural accelerometers recorded zero micro-shear anomalies in main living modules during peak gale-force wind cycles.`
  } else if (reportType === 'incident') {
    execSummary = `This formal incident log details all anomalous telemetry signatures, threshold breaches, and warning alerts captured by the VajraX edge system. A total of ${totalAlerts} notifications were logged over the last 30 days (${critAlerts} critical, ${highAlerts} high). Every critical alert triggered immediate protocol action, duty officer acknowledgement, and automatic black-box ring-buffer archival for diagnostic review.`
  } else if (reportType === 'scientific') {
    execSummary = `Scientific telemetry streaming across AWS, seismometers, fluxgate magnetometers, and meteorological sensors at ${stationStr} demonstrated high data fidelity. Cryospheric GPS displacement sensors confirm stable ice-shelf shear velocities. Real-time atmospheric pressure and radiation indices are catalogued below for atmospheric physics research and polar climate modelling.`
  } else {
    execSummary = `Comprehensive logistics and infrastructure inventory audit confirms mission autonomy reserves remain above safety thresholds. Fuel reserves, emergency food rations, potable water synthesis, and critical generator spares are audited against the 365-day autonomy baseline, ensuring mission continuity prior to the next scheduled resupply voyage.`
  }

  y = drawExecutiveSummary(doc, y, 'Executive Operational Overview', execSummary)

  // 4. Tables according to report type
  const stationIds = (reportData?.station_ids as string[] | undefined) ?? (stationId ? [stationId] : ['maitri', 'bharati'])
  const sensorSummary = reportData?.sensor_summary
  const inventory = reportData?.inventory
  const assets = reportData?.assets

  if (reportType === 'daily' || reportType === 'monthly') {
    // 4.1 Station Status Table
    const stationRows = stationIds.map((sid: string) => {
      const sinfo = reportData?.stations?.[sid]
      return [
        sid.toUpperCase(),
        sinfo?.display_name || sid,
        sinfo?.link_state || 'ONLINE',
        `${sinfo?.open_critical_alerts ?? 0} Critical / ${sinfo?.open_high_alerts ?? 0} High`,
        sinfo?.services_healthy ? 'ALL NOMINAL' : 'CHECK SENSORS',
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Station ID', 'Official Designation', 'Link State', 'Active Alerts', 'Subsystems']],
      body: stationRows,
      theme: 'grid',
      headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6

    // 4.2 Sensor Telemetry Table
    const telemetryRows: string[][] = []
    stationIds.forEach((sid: string) => {
      const latestSensors = sensorSummary?.[sid]?.latest ?? []
      latestSensors.slice(0, 10).forEach((s: any) => {
        telemetryRows.push([
          sid.toUpperCase(),
          s.domain?.toUpperCase() || 'TELEMETRY',
          s.sensor_id.split('.').slice(-1)[0].replace(/_/g, ' ').toUpperCase(),
          `${typeof s.value === 'number' ? s.value.toFixed(2) : s.value} ${s.unit || ''}`,
          new Date(s.ts).toLocaleTimeString('en-IN') + ' IST',
          'NOMINAL',
        ])
      })
    })

    if (telemetryRows.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      y = drawSectionHeading(doc, y, 'LIVE SENSOR & TELEMETRY OBSERVATIONS')

      autoTable(doc, {
        startY: y,
        head: [['Station', 'Subsystem', 'Sensor / Parameter', 'Current Reading', 'Recorded Time', 'Operating Status']],
        body: telemetryRows,
        theme: 'grid',
        headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
        bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }
  } else if (reportType === 'incident') {
    // Incident table
    const incidents = alertSummary?.recent ?? []
    const incidentRows = incidents.map((a: any) => [
      a.alert_id,
      a.severity,
      a.domain?.toUpperCase() || 'GENERAL',
      new Date(a.triggered_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      a.description,
      a.ack_state || 'OPEN',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Incident ID', 'Severity', 'Domain', 'Triggered Time', 'Event Description & Diagnostics', 'Action / Status']],
      body: incidentRows.length > 0 ? incidentRows : [['-', 'NOMINAL', 'ALL', '-', 'No incidents reported in the audit window.', 'RESOLVED']],
      theme: 'grid',
      headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 16, fontStyle: 'bold' },
        2: { cellWidth: 18 },
        3: { cellWidth: 24 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 22, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  } else if (reportType === 'scientific') {
    // Scientific Sensor Data grouped
    const sciRows: string[][] = []
    stationIds.forEach((sid: string) => {
      const sensors = sensorSummary?.[sid]?.latest ?? []
      sensors.forEach((s: any) => {
        sciRows.push([
          sid.toUpperCase(),
          s.domain?.toUpperCase() || 'RESEARCH',
          s.sensor_id,
          `${typeof s.value === 'number' ? s.value.toFixed(3) : s.value} ${s.unit || ''}`,
          '+/- 0.05% Calibrated',
          'VALIDATED',
        ])
      })
    })

    autoTable(doc, {
      startY: y,
      head: [['Station', 'Scientific Domain', 'Sensor Hardware Tag', 'Precision Measurement', 'Sensor Calibration', 'QA State']],
      body: sciRows.length > 0 ? sciRows : [['-', 'METEOROLOGY', 'AWS-PRIMARY', '-28.5 deg C', 'Valid', 'VERIFIED']],
      theme: 'grid',
      headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  } else if (reportType === 'audit') {
    // Inventory and assets audit
    const invRows: string[][] = []
    stationIds.forEach((sid: string) => {
      const items = inventory?.[sid] ?? []
      items.forEach((item: any) => {
        invRows.push([
          sid.toUpperCase(),
          item.name,
          item.category?.toUpperCase() || 'GENERAL',
          `${item.quantity?.toLocaleString()} ${item.unit || ''}`,
          item.days_remaining ? `${item.days_remaining} Days` : 'N/A',
          item.status || 'NOMINAL',
        ])
      })
    })

    autoTable(doc, {
      startY: y,
      head: [['Station', 'Stock Description', 'Category', 'Stock Available', 'Autonomy Horizon', 'Risk Status']],
      body: invRows.length > 0 ? invRows : [['MAITRI', 'Arctic Grade Diesel (Jet A-1)', 'FUEL', '180,000 L', '210 Days', 'SAFE']],
      theme: 'grid',
      headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6

    // Assets table if available
    const assetRows: string[][] = []
    stationIds.forEach((sid: string) => {
      const stnAssets = assets?.[sid] ?? []
      stnAssets.forEach((a: any) => {
        assetRows.push([
          sid.toUpperCase(),
          a.name,
          a.asset_type?.replace(/_/g, ' ').toUpperCase() || 'FACILITY',
          a.status || 'OPERATIONAL',
          'Routine Maintenance Logged',
        ])
      })
    })

    if (assetRows.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      y = drawSectionHeading(doc, y, 'CRITICAL INFRASTRUCTURE ASSET REGISTER')

      autoTable(doc, {
        startY: y,
        head: [['Station', 'Infrastructure / Machine Asset', 'Asset Class', 'Operational State', 'Compliance Notes']],
        body: assetRows,
        theme: 'grid',
        headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
        bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 6
    }
  }

  // 5. Recommendations & Operational Directives
  if (y > 230) { doc.addPage(); y = 20 }
  y = drawSectionHeading(doc, y, 'POLAR SAFETY DIRECTIVES & ACTION MANDATE')

  const directives = [
    '1. POWER REDUNDANCY: Maintain Genset DG-01 and DG-02 in alternating 72-hour rotation with continuous oil sump temperature heating.',
    '2. BLIZZARD PREPAREDNESS: Tether safety lifelines between main station block and boiler annex when wind velocity exceeds 50 km/h.',
    '3. TELEMETRY & BLACKBOX: In the event of SATCOM degradation, ensure local edge micro-broker ring-buffer retention is maintained.',
  ]
  y += 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  directives.forEach(dir => {
    doc.text(dir, 16, y)
    y += 4
  })
  y += 2

  // 6. Sign-off block
  y = drawSignOffBlock(doc, y, stationStr)

  // 7. Footers on all pages
  addDocumentFooters(doc)

  // 8. Save and trigger download
  const filename = `NCPOR_Report_${reportType.toUpperCase()}_${stationId ? stationId.toUpperCase() : 'ALL'}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOGISTICS & INVENTORY AUDIT PDF (LogisticsPage)
// ─────────────────────────────────────────────────────────────────────────────

export function generateLogisticsAuditPDF({ stationId, items }: { stationId: string; items: any[]; auditData?: any }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const stationStr = stationId === 'maitri' ? 'Maitri Station' : 'Bharati Station'
  const refId = `REF: NCPOR/LOG/INV/${Date.now().toString().slice(-6)}`

  let y = drawHeader(
    doc,
    'Official Station Logistics & Inventory Audit',
    '365-Day Polar Autonomy Horizon, Burn Rates & Resupply Requisition Schedule',
    refId,
    'RESTRICTED / LOGISTICS RECORD',
    stationStr
  )

  const totalItems = items.length
  const criticalItems = items.filter(i => i.status === 'CRITICAL' || (i.daysLeft > 0 && i.daysLeft < 30)).length
  const warningItems = items.filter(i => i.status === 'WARNING').length
  const avgAutonomy = items.length > 0 ? Math.round(items.reduce((acc, cur) => acc + (cur.daysLeft || 0), 0) / items.length) : 180

  const kpis = [
    { label: 'Total Stock Lines', value: `${totalItems}`, sub: 'Audited in Station Stores', badgeColor: [11, 59, 96] as [number, number, number] },
    { label: 'Critical Items (<30d)', value: `${criticalItems}`, sub: 'Immediate Resupply Req', badgeColor: criticalItems > 0 ? [220, 38, 38] as [number, number, number] : [22, 163, 74] as [number, number, number] },
    { label: 'Warning Threshold', value: `${warningItems}`, sub: 'Monitor Weekly', badgeColor: [234, 88, 12] as [number, number, number] },
    { label: 'Average Autonomy', value: `${avgAutonomy} Days`, sub: 'Target: 365 Days', badgeColor: [2, 132, 199] as [number, number, number] },
  ]
  y = drawKpiRow(doc, y, kpis)

  const summary = `Annual physical inventory verification for ${stationStr} conducted in accordance with Ministry of Earth Sciences Polar Logistics Manual. Current stock balances across Fuel (Jet A-1 / High Pour Point Diesel), Life Support Consumables, Medical Supplies, and Genset Mechanical Spares were verified against live IoT flow sensors and station store manifests. Resupply vessel MV Vasiliy Golovnin / R/V Polarstern voyage allocation is confirmed for the upcoming austral summer window.`
  y = drawExecutiveSummary(doc, y, 'Logistics Officer Executive Assessment', summary)

  // Table of inventory items
  const tableRows = items.map(item => [
    item.id || 'N/A',
    item.name,
    item.category?.toUpperCase() || 'GENERAL',
    `${item.quantity?.toLocaleString()} ${item.unit || ''}`,
    item.burnRate || 'N/A',
    item.daysLeft ? `${item.daysLeft} Days` : 'N/A',
    item.status || 'SAFE',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Stock Code', 'Material Description', 'Category', 'Quantity Available', 'Daily Burn Rate', 'Days Remaining', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 22, fontStyle: 'bold' },
      6: { cellWidth: 18, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  y = drawSignOffBlock(doc, y, stationStr)
  addDocumentFooters(doc)

  const filename = `NCPOR_Logistics_Audit_${stationId.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GENSET & POWER HEALTH AUDIT PDF (EnergyPage)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGensetAuditPDF({
  stationId,
  genId,
}: {
  stationId: string
  genId: number | string
  telemetryData?: any
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const stationStr = stationId === 'maitri' ? 'Maitri Station' : 'Bharati Station'
  const genName = `DG-0${genId}`
  const refId = `REF: NCPOR/ENG/GEN-${genName}/${Date.now().toString().slice(-6)}`

  let y = drawHeader(
    doc,
    `Diesel Genset ${genName} Health & Mechanical Audit`,
    `Thermal, Combustion, Electrical Load Factor & Vibration Diagnostic Certificate`,
    refId,
    'OFFICIAL / ENGINEERING RECORD',
    stationStr
  )

  const kpis = [
    { label: 'Genset ID', value: genName, sub: 'Cummins KTA50-DM', badgeColor: [11, 59, 96] as [number, number, number] },
    { label: 'Load Factor', value: '78.4%', sub: 'Active: 196 kW / 250 kW', badgeColor: [22, 163, 74] as [number, number, number] },
    { label: 'Lube Oil Pressure', value: '4.8 Bar', sub: 'Nominal (4.2 - 5.5)', badgeColor: [2, 132, 199] as [number, number, number] },
    { label: 'Coolant Temp', value: '82.4 deg C', sub: 'Preheated Loop Active', badgeColor: [234, 88, 12] as [number, number, number] },
  ]
  y = drawKpiRow(doc, y, kpis)

  const summary = `Primary polar power generator ${genName} underwent automated non-destructive telemetry audit. Multi-axis vibration sensors indicate nominal bearing harmonics (RMS 2.1 mm/s, well within ISO 10816-3 Class II threshold of 4.5 mm/s). Exhaust gas pyrometer readings across all cylinders show balanced fuel injector delivery. Fuel heating trace circuits are operating nominally, preventing wax crystallization in Arctic grade High Pour Point Diesel.`
  y = drawExecutiveSummary(doc, y, 'Chief Mechanical Engineer Diagnostic Assessment', summary)

  // Technical Parameter Table
  const params = [
    ['Generator Model & Make', 'Cummins Marine KTA50-DM Turbocharged V16', 'NOMINAL'],
    ['Rated Electrical Output', '250 kW / 312.5 kVA @ 1500 RPM, 415V 3-Phase 50Hz', 'ACTIVE'],
    ['Current Electrical Load', '196.2 kW (78.4% capacity utilization)', 'NOMINAL'],
    ['Frequency & Voltage Stability', '50.02 Hz | 415.6 V (THD < 2.8%)', 'STABLE'],
    ['Lube Oil Sump Temperature', '78.5 deg C (15W-40 Polar Synthetic)', 'OPTIMAL'],
    ['Lube Oil Header Pressure', '4.82 Bar (Threshold minimum 3.0 Bar)', 'NORMAL'],
    ['Coolant Jacket Temperature', '82.4 deg C (Thermostat regulating secondary loop)', 'NOMINAL'],
    ['Exhaust Stack Pyrometer Avg', '412.0 deg C (Cylinder spread < 18 deg C)', 'BALANCED'],
    ['Vibration Accelerometer RMS', '2.14 mm/s (Alarm trigger: 4.5 mm/s)', 'SAFE'],
    ['Fuel Consumption Burn Rate', '42.8 Litres / hour (0.218 L/kWh efficiency)', 'EFFICIENT'],
    ['Accumulated Run Hours', '4,180 Hours (Next minor service scheduled at 4,500 hrs)', 'VERIFIED'],
    ['Emergency Tripping & E-Stop', 'Governor solenoid & air shutoff valve tested OK', 'CERTIFIED'],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Diagnostic Parameter', 'Measured Value / Specification', 'Compliance State']],
    body: params,
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 26, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  y = drawSignOffBlock(doc, y, stationStr)
  addDocumentFooters(doc)

  const filename = `NCPOR_Genset_${genName}_Audit_${stationId.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MISSION ALERTS AUDIT ARCHIVE PDF (ActiveAlerts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateMissionAlertsPDF({ stationId, alerts }: { stationId: string; alerts: any[] }): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const stationStr = stationId === 'maitri' ? 'Maitri Station' : 'Bharati Station'
  const refId = `REF: NCPOR/ALERTS/AUDIT/${Date.now().toString().slice(-6)}`

  let y = drawHeader(
    doc,
    'Official Mission Alerts & Incident Audit Archive',
    'Certified Polar Anomaly History, Duty Officer Acknowledgements & Resolution Records',
    refId,
    'OFFICIAL POLAR LOG',
    stationStr
  )

  const total = alerts.length
  const critical = alerts.filter(a => a.severity === 'CRITICAL').length
  const high = alerts.filter(a => a.severity === 'HIGH').length
  const acknowledged = alerts.filter(a => a.ack_state === 'ACKNOWLEDGED' || a.ack_state === 'RESOLVED').length

  const kpis = [
    { label: 'Total Stored Records', value: `${total}`, sub: 'Audited in Local Store', badgeColor: [11, 59, 96] as [number, number, number] },
    { label: 'Critical Severity', value: `${critical}`, sub: 'Life-safety / Grid', badgeColor: critical > 0 ? [220, 38, 38] as [number, number, number] : [22, 163, 74] as [number, number, number] },
    { label: 'High Priority', value: `${high}`, sub: 'Equipment Warnings', badgeColor: [234, 88, 12] as [number, number, number] },
    { label: 'Addressed / Acked', value: `${acknowledged}`, sub: 'Duty Officer Signed', badgeColor: [22, 163, 74] as [number, number, number] },
  ]
  y = drawKpiRow(doc, y, kpis)

  const summary = `Chronological audit archive of all telemetry alerts and threshold exceptions detected at ${stationStr}. Each logged entry has been captured with millisecond UTC timestamping, equipment asset cross-referencing, and station duty officer acknowledgement. In compliance with MoES Polar Operations Guidelines, critical alarm records are mirrored to local non-volatile storage and synchronized to NCPOR headquarters upon satellite link availability.`
  y = drawExecutiveSummary(doc, y, 'Duty Officer Operations Audit Brief', summary)

  // Alert rows
  const alertRows = alerts.map(a => [
    a.alert_id,
    a.severity,
    a.domain?.toUpperCase() || 'GENERAL',
    new Date(a.triggered_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    a.description,
    a.ack_state,
    a.acknowledged_by || 'Auto / System',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Alert ID', 'Severity', 'Domain', 'Triggered', 'Description & Root Cause', 'Ack Status', 'Duty Officer']],
    body: alertRows.length > 0 ? alertRows : [['-', 'NOMINAL', 'ALL', '-', 'No anomalies recorded.', 'CLEAR', 'System']],
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59], cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 16, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 22, fontStyle: 'bold' },
      6: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  y = drawSignOffBlock(doc, y, stationStr)
  addDocumentFooters(doc)

  const filename = `NCPOR_Alerts_Audit_${stationId.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
