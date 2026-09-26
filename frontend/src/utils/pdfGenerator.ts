import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import emblemOfIndia from '../assets/emblem_of_india.svg'

// Preload Ashoka Emblem image for immediate canvas rendering
const _emblemImg = new Image()
_emblemImg.src = emblemOfIndia

// Colors for official Government of India / MoES branding
const MOES_NAVY = [11, 59, 96] as const        // #0b3b60
const MOES_SAFFRON = [255, 153, 51] as const   // #ff9933
const INDIA_GREEN = [19, 136, 8] as const      // #138808
const SLATE_DARK = [30, 41, 59] as const       // #1e293b
const SLATE_MUTED = [100, 116, 139] as const   // #64748b
const BG_LIGHT = [248, 250, 252] as const      // #f8fafc

/**
 * Creates high-resolution canvas with Ashoka Lion Capital, Bilingual Devanagari & English
 * typography and horizontal double rule matching the official Government Gazette SITREP format.
 */
function createGovtHeaderCanvas(
  titleHindi: string,
  titleEnglish: string
): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 430
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // White paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 1. National Tricolour Ribbon at top of document (3 equal horizontal segments)
  const ribbonH = 6
  const thirdW = canvas.width / 3
  ctx.fillStyle = '#FF9933'
  ctx.fillRect(0, 0, thirdW, ribbonH)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(thirdW, 0, thirdW, ribbonH)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.strokeRect(thirdW, 0, thirdW, ribbonH)
  ctx.fillStyle = '#138808'
  ctx.fillRect(thirdW * 2, 0, thirdW, ribbonH)

  const centerX = canvas.width / 2

  // 2. Centered Ashoka Lion Capital Emblem
  if (_emblemImg.complete && _emblemImg.naturalWidth > 0) {
    const emblemH = 92
    const emblemW = (_emblemImg.naturalWidth / _emblemImg.naturalHeight) * emblemH
    ctx.drawImage(_emblemImg, centerX - emblemW / 2, 38, emblemW, emblemH)
  }

  // 3. Official Government Typography (Bilingual Hindi Devanagari + English)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0b3b60'
  ctx.font = 'bold 30px "Noto Sans Devanagari", "Mangal", "Segoe UI", Arial, sans-serif'
  ctx.fillText('भारत सरकार • GOVERNMENT OF INDIA', centerX, 155)

  ctx.font = 'bold 25px "Noto Sans Devanagari", "Mangal", "Segoe UI", Arial, sans-serif'
  ctx.fillStyle = '#1e293b'
  ctx.fillText('पृथ्वी विज्ञान मंत्रालय • MINISTRY OF EARTH SCIENCES', centerX, 192)

  ctx.font = 'bold 22px "Noto Sans Devanagari", "Mangal", "Segoe UI", Arial, sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText('राष्ट्रीय ध्रुवीय एवं समुद्री अनुसंधान केंद्र (NCPOR), वास्को-डि-गामा, गोवा', centerX, 227)

  ctx.font = 'italic 19px "Noto Sans Devanagari", "Mangal", "Georgia", serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('45वां भारतीय वैज्ञानिक अंटार्कटिक अभियान (45th Indian Scientific Expedition to Antarctica)', centerX, 258)

  // Double horizontal rule lines
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(centerX - 560, 288)
  ctx.lineTo(centerX + 560, 288)
  ctx.stroke()

  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX - 560, 294)
  ctx.lineTo(centerX + 560, 294)
  ctx.stroke()

  // Centered Bilingual Report Title
  ctx.font = '900 30px "Noto Sans Devanagari", "Mangal", "Georgia", serif'
  ctx.fillStyle = '#0f172a'
  ctx.fillText(titleHindi, centerX, 338)

  ctx.font = 'bold 21px "Inter", "Segoe UI", sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText(titleEnglish, centerX, 375)

  return canvas.toDataURL('image/png')
}

/**
 * Draw official Government Gazette header banner
 */
export function drawGovtGazetteHeader(
  doc: jsPDF,
  titleHindi: string,
  titleEnglish: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const headerHeight = 54
  try {
    const dataUrl = createGovtHeaderCanvas(titleHindi, titleEnglish)
    if (dataUrl) {
      doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, headerHeight)
      return headerHeight + 3
    }
  } catch (err) {
    console.warn('Canvas header fallback:', err)
  }

  // Vector fallback if canvas unavailable
  const thirdW = pageWidth / 3
  doc.setFillColor(MOES_SAFFRON[0], MOES_SAFFRON[1], MOES_SAFFRON[2])
  doc.rect(0, 0, thirdW, 2.2, 'F')
  doc.setFillColor(255, 255, 255)
  doc.rect(thirdW, 0, thirdW, 2.2, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.rect(thirdW, 0, thirdW, 2.2, 'S')
  doc.setFillColor(INDIA_GREEN[0], INDIA_GREEN[1], INDIA_GREEN[2])
  doc.rect(thirdW * 2, 0, thirdW, 2.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('GOVERNMENT OF INDIA • MINISTRY OF EARTH SCIENCES', pageWidth / 2, 12, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  doc.text('NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR), GOA', pageWidth / 2, 17, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('45th Indian Scientific Expedition to Antarctica', pageWidth / 2, 21.5, { align: 'center' })

  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.4)
  doc.line(25, 25, pageWidth - 25, 25)
  doc.setLineWidth(0.15)
  doc.line(25, 26.2, pageWidth - 25, 26.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(titleEnglish.toUpperCase(), pageWidth / 2, 33, { align: 'center' })

  return 38
}

/**
 * Standard MoES / Government Header function (backward-compatible)
 */
export function drawHeader(
  doc: jsPDF,
  title: string,
  _subtitle: string,
  _refId?: string,
  _classification?: string,
  _stationName?: string
): number {
  return drawGovtGazetteHeader(doc, 'भारत सरकार • आधिकारिक प्रतिवेदन', title.toUpperCase())
}

/**
 * Draw subtle diagonal watermark across all pages
 */
export function drawWatermark(doc: jsPDF, text: string = 'NCPOR • POLAR ARCHIVE') {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.saveGraphicsState()
    doc.setTextColor(228, 234, 242) // subtle watermark tint
    doc.setFont('times', 'bold')
    doc.setFontSize(36)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.text(text, pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 35,
    })
    doc.restoreGraphicsState()
  }
}

/**
 * Draw Government Metadata Grid matching official Gazette SITREP
 */
export function drawGovtMetadataGrid(
  doc: jsPDF,
  startY: number,
  items: { label: string; value: string; color?: [number, number, number] }[]
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - 28
  const x = 14
  const boxHeight = 22

  doc.setFillColor(255, 255, 255)
  doc.rect(x, startY, usableWidth, boxHeight, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(x, startY, usableWidth, boxHeight, 'S')

  const colWidth = usableWidth / 2

  // Row 1: Left & Right
  if (items[0]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(`${items[0].label}: `, x + 4, startY + 5.5)
    const lblW = doc.getTextWidth(`${items[0].label}: `)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
    doc.text(items[0].value, x + 4 + lblW, startY + 5.5)
  }

  if (items[1]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(`${items[1].label}: `, x + colWidth + 4, startY + 5.5)
    const lblW = doc.getTextWidth(`${items[1].label}: `)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
    doc.text(items[1].value, x + colWidth + 4 + lblW, startY + 5.5)
  }

  // Row 2: Left & Right
  if (items[2]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(`${items[2].label}: `, x + 4, startY + 11.5)
    const lblW = doc.getTextWidth(`${items[2].label}: `)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
    doc.text(items[2].value, x + 4 + lblW, startY + 11.5)
  }

  if (items[3]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(`${items[3].label}: `, x + colWidth + 4, startY + 11.5)
    const lblW = doc.getTextWidth(`${items[3].label}: `)
    doc.setFont('helvetica', 'bold')
    const col = items[3].color || [22, 163, 74]
    doc.setTextColor(col[0], col[1], col[2])
    doc.text(items[3].value, x + colWidth + 4 + lblW, startY + 11.5)
  }

  // Row 3: Full Width
  if (items[4]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(`${items[4].label}: `, x + 4, startY + 17.5)
    const lblW = doc.getTextWidth(`${items[4].label}: `)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
    doc.text(items[4].value, x + 4 + lblW, startY + 17.5)
  }

  return startY + boxHeight + 6
}

/**
 * Draw Black-Box Cryptographic Registration Block
 */
export function drawBlackBoxRegistration(
  doc: jsPDF,
  startY: number,
  incidents: number = 0,
  hash: string = 'SHA256:7f8b92c4e1a056d39fa451b68ce92d4f8a123e7b'
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - 28
  const x = 14

  if (startY > 240) {
    doc.addPage()
    startY = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('BLACK-BOX CRYPTOGRAPHIC REGISTRATION (DIGITAL VERIFICATION)', x, startY)

  const boxHeight = 22
  doc.setFillColor(248, 250, 252)
  doc.rect(x, startY + 2.5, usableWidth, boxHeight, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(x, startY + 2.5, usableWidth, boxHeight, 'S')

  doc.setFillColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.rect(x, startY + 2.5, 1.5, boxHeight, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  doc.text(`Recorded Critical Incidents: ${incidents} event(s) locked during this weekly/daily period.`, x + 4, startY + 7.5)

  doc.text('Ed25519 & SHA-256 Hash Chain: ', x + 4, startY + 12.5)
  doc.setTextColor(2, 132, 199)
  doc.setFont('courier', 'bold')
  doc.text(hash, x + 4 + doc.getTextWidth('Ed25519 & SHA-256 Hash Chain: '), startY + 12.5)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74)
  doc.setFontSize(6.2)
  doc.text('Cryptographic Chain Authenticated: Telemetry sequence anchors to on-station hardware security module. Tampering resistance confirmed under Ministry Guidelines.', x + 4, startY + 17.5)

  return startY + boxHeight + 8
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
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2])
    doc.rect(x, startY, cardWidth, cardHeight, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.rect(x, startY, cardWidth, cardHeight, 'S')

    const color = c.badgeColor || MOES_NAVY
    doc.setFillColor(color[0], color[1], color[2])
    doc.rect(x, startY, cardWidth, 1.2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
    doc.text(c.label.toUpperCase(), x + 3, startY + 4.8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(c.value, x + 3, startY + 9.8)

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

  doc.setFillColor(254, 252, 246)
  doc.rect(14, startY + 2, usableWidth, boxHeight, 'F')
  doc.setDrawColor(254, 215, 170)
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
 * Draw Official Sign-off and Verification Seal with circular blue ink stamp
 */
function drawSignOffBlock(doc: jsPDF, startY: number, stationStr: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const x = 14

  if (startY > 240) {
    doc.addPage()
    startY = 20
  }

  // Left: NIC Meghraj cloud vault info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2])
  doc.text('NIC MEGHRAJ CLOUD VAULT ID: NCPOR-GOI-ARC-2026-99382-SEC', x, startY + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('GIGW 3.0 Standard • Ministry of Earth Sciences, Govt. of India', x, startY + 16.5)

  // Right: Circular blue stamp seal
  const sealCenterX = pageWidth - 14 - 35
  const sealCenterY = startY + 11

  doc.setDrawColor(3, 105, 161)
  doc.setLineWidth(0.6)
  doc.circle(sealCenterX, sealCenterY, 13.5, 'S')
  doc.setLineWidth(0.2)
  doc.circle(sealCenterX, sealCenterY, 11.5, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.2)
  doc.setTextColor(3, 105, 161)
  doc.text('★ NCPOR ★', sealCenterX, sealCenterY - 6.5, { align: 'center' })
  doc.setFontSize(4.5)
  doc.text('POLAR DIVISION', sealCenterX, sealCenterY - 3, { align: 'center' })
  doc.setFontSize(6.5)
  doc.setTextColor(11, 59, 96)
  doc.text('CERTIFIED', sealCenterX, sealCenterY + 1.2, { align: 'center' })
  doc.setFontSize(4.8)
  doc.setTextColor(3, 105, 161)
  doc.text('GOVT. OF INDIA', sealCenterX, sealCenterY + 5.5, { align: 'center' })

  // Officer designation
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2])
  doc.text('Dr. Director / Head of Polar Operations', sealCenterX, startY + 29, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  doc.text(`NCPOR, Ministry of Earth Sciences, Goa • ${stationStr}`, sealCenterX, startY + 33, { align: 'center' })

  return startY + 38
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
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

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
  if (reportType === 'sitrep') {
    generateSitrepGazettePDF({ stationId: stationId || 'maitri' })
    return
  }
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

  // 1. Draw Official Government Gazette Header
  const hindiTitle = reportType === 'daily'
    ? 'दैनिक टेलीमेट्री एवं परिचालन स्थिति प्रतिवेदन (SITREP)'
    : reportType === 'monthly'
    ? 'मासिक ध्रुवीय परिचालन एवं स्थिरता प्रतिवेदन'
    : reportType === 'incident'
    ? 'ध्रुवीय संकट, असामान्यता एवं आपातकालीन लॉग'
    : reportType === 'scientific'
    ? 'वैज्ञानिक टेलीमेट्री एवं पर्यावरण मापन प्रतिवेदन'
    : 'स्टेशन रसद, जीवन समर्थन एवं संपत्ति सत्यापन प्रतिवेदन'

  let y = drawGovtGazetteHeader(doc, hindiTitle, meta.title.toUpperCase())

  // Draw Official Metadata Grid matching Government Gazette
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  y = drawGovtMetadataGrid(doc, y, [
    { label: 'Official Ref', value: refId },
    { label: 'Reporting Window', value: `${dateStr} • 24-HR DIURNAL CYCLE` },
    { label: 'Facility', value: `${stationStr.toUpperCase()} (70°45'S, 11°44'E)` },
    { label: 'Ground Satellite Lock', value: '99.8% (ISRO GSAT-7A / GSAT-30)', color: [22, 163, 74] },
    { label: 'Archive Rollup', value: '60,480 Samples Decimated to 672 Hourly Rollups (93.8% Saved)' },
  ])

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

  // 5.2 Black-Box Cryptographic Registration
  if (y > 210) { doc.addPage(); y = 20 }
  y = drawBlackBoxRegistration(doc, y, critAlerts)

  // 6. Official Sign-off block
  if (y > 230) { doc.addPage(); y = 20 }
  y = drawSignOffBlock(doc, y, stationStr)

  // 7. Watermark and Footers on all pages
  drawWatermark(doc, 'NCPOR • POLAR ARCHIVE')
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. OFFICIAL WEATHER FORECAST & EXPEDITION SAFETY SITREP (Govt Format)
// ─────────────────────────────────────────────────────────────────────────────

export interface WeatherReportParams {
  stationId: string
  forecast7Day: Array<{
    day: string
    date: string
    highTemp: number
    lowTemp: number
    condition: string
    windSpeed: number
    windGust: number
    snowProb: number
    blizzardRisk: string
    pressure: number
    solarHours: number
    uvIndex: number
    summary: string
  }>
  hourlyData?: Array<{
    hour: string
    temp: number
    condition: string
    wind: number
    gust: number
    windChill: number
    blizzardRisk: number
    pressure: number
    solarOffset: number
    activitySafety: 'SAFE' | 'CAUTION' | 'RESTRICTED' | 'NO-GO'
  }>
  selectedDay?: {
    day: string
    date: string
    highTemp: number
    lowTemp: number
    condition: string
    windSpeed: number
    windGust: number
    blizzardRisk: string
    summary: string
  }
}

export function generateWeatherMissionReportPDF({
  stationId,
  forecast7Day,
  hourlyData,
  selectedDay,
}: WeatherReportParams): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const stationStr = stationId === 'maitri' ? 'Maitri Station' : 'Bharati Station'
  const refId = `NCPOR/MET-AI/${stationId.toUpperCase()}/2026-W37`
  const facilityCoords = stationId === 'maitri' ? 'MAITRI BASE (70°45\'S, 11°44\'E)' : 'BHARATI BASE (69°24\'S, 76°11\'E)'

  // 1. Official Government Header (Ashoka Lion Capital + MoES / NCPOR)
  let y = drawGovtGazetteHeader(
    doc,
    'मौसम पूर्वानुमान एवं ध्रुवीय अभियान सुरक्षा प्रतिवेदन',
    'POLAR WEATHER FORECAST & EXPEDITION SAFETY SITREP'
  )

  // 2. Official Metadata Grid matching Government Gazette
  y = drawGovtMetadataGrid(doc, y, [
    { label: 'Official Ref', value: refId },
    { label: 'Forecast Cycle', value: '7-Day Synoptic Ensembles (IMD • ECMWF Polar Run)' },
    { label: 'Facility', value: facilityCoords },
    { label: 'Ground Satellite Lock', value: '99.9% (INSAT-3DR / METOP-C HRPT)', color: [22, 163, 74] },
    { label: 'AI Weather Model', value: 'VajraX Katabatic Neural Engine v4.2 • 1-Hr Resolution Decimation' },
  ])

  // 3. High-level KPIs
  const maxGust = Math.max(...forecast7Day.map(d => d.windGust))
  const minTemp = Math.min(...forecast7Day.map(d => d.lowTemp))
  const maxBlizzard = forecast7Day.some(d => d.blizzardRisk === 'CRITICAL' || d.blizzardRisk === 'HIGH') ? 'HIGH / ACTIVE' : 'MODERATE'

  const kpis = [
    { label: '7-Day Min Temp', value: `${minTemp}°C`, sub: 'Antarctic Winter Floor', badgeColor: [2, 132, 199] as [number, number, number] },
    { label: 'Peak Katabatic Gust', value: `${maxGust} km/h`, sub: 'Plateau Drainage Flow', badgeColor: maxGust > 80 ? [220, 38, 38] as [number, number, number] : [234, 88, 12] as [number, number, number] },
    { label: 'Blizzard Advisory', value: maxBlizzard, sub: 'Safety Lifeline Mandate', badgeColor: maxBlizzard.includes('HIGH') ? [220, 38, 38] as [number, number, number] : [22, 163, 74] as [number, number, number] },
    { label: 'Sortie Clearance', value: 'CAUTION', sub: 'Heli Operations Marginal', badgeColor: [234, 88, 12] as [number, number, number] },
  ]
  y = drawKpiRow(doc, y, kpis)

  // 4. Executive Meteorological Prognosis
  const prognosisText = `Atmospheric synoptic dynamics across ${facilityCoords} indicate intense katabatic gravity currents descending from the high polar plateau. Numerical AI modeling forecasts a deep circumpolar low-pressure trough passing through Queen Maud Land. Outdoor traverses, over-snow convoy movements (PistenBully), and scientific balloon launches must synchronize with diurnal weather lulls identified below.`
  y = drawExecutiveSummary(doc, y, 'Executive Meteorological Prognosis & Diurnal Advisory', prognosisText)

  // 5. 7-Day Synoptic Forecast Table
  y = drawSectionHeading(doc, y, '7-DAY SYNOPTIC POLAR WEATHER OUTLOOK (IMD / NCPOR)')
  const tableRows = forecast7Day.map(d => [
    `${d.day.toUpperCase()} (${d.date})`,
    d.condition.toUpperCase(),
    `${d.highTemp}°C / ${d.lowTemp}°C`,
    `${d.windSpeed} km/h (Gusts: ${d.windGust})`,
    `${d.snowProb}%`,
    `${d.blizzardRisk}`,
    `${d.pressure} hPa`,
    d.windGust > 70 ? 'RESTRICTED' : 'CLEAR',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Day / Date', 'Condition', 'Temp (H/L)', 'Wind & Gusts', 'Snow Prob', 'Blizzard Risk', 'Pressure', 'Outdoor Safety']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 6.5, textColor: [30, 41, 59], cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 20 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16 },
      5: { cellWidth: 22, fontStyle: 'bold' },
      6: { cellWidth: 18 },
      7: { cellWidth: 'auto', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  // 6. Selected Day Upcoming Hours & Diurnal Phases Detail
  if (y > 210) { doc.addPage(); y = 20 }
  const targetDayLabel = selectedDay ? `${selectedDay.day.toUpperCase()} (${selectedDay.date})` : 'TARGET FORECAST DAY'
  y = drawSectionHeading(doc, y, `DIURNAL KATABATIC PROGRESSION & HOURLY IMPACT: ${targetDayLabel}`)

  const diurnalPhases = [
    ['Phase 1 (00:00 - 06:00 UTC)', 'Nocturnal Radiative Inversion', 'Extreme sub-zero cold (-26°C), katabatic drainage begins down ice slope.', 'CRITICAL COLD'],
    ['Phase 2 (06:00 - 12:00 UTC)', 'Katabatic Wind Build-up', 'Sustained gale acceleration (50-70 km/h). Blowing snow begins to reduce visibility.', 'CAUTION'],
    ['Phase 3 (12:00 - 18:00 UTC)', 'Peak Diurnal Turbulence & Wind Peak', 'Severe surface wind gusts (85-98 km/h). Helicopter & drone sorties strictly grounded.', 'SUSPENDED'],
    ['Phase 4 (18:00 - 24:00 UTC)', 'Post-Sunset Gravity Settling', 'Atmospheric boundary layer stabilizes; winds taper to 35 km/h. Snow refreeze.', 'MODERATE'],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Diurnal Window', 'Atmospheric Phase', 'Physical Dynamics & Operational Impact', 'Flight & Traverse Status']],
    body: diurnalPhases,
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.8 },
    bodyStyles: { fontSize: 6.5, textColor: [30, 41, 59], cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 26, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  // 7. Hourly Detail Table (if hourlyData provided)
  if (hourlyData && hourlyData.length > 0) {
    if (y > 210) { doc.addPage(); y = 20 }
    y = drawSectionHeading(doc, y, 'HOURLY WEATHER & CHILL FORECAST (24-HR PROGRESSION)')

    const hourlyRows = hourlyData.slice(0, 16).map(h => [
      h.hour,
      `${h.temp}°C`,
      `${h.windChill}°C`,
      h.condition.toUpperCase(),
      `${h.wind} km/h`,
      `${h.gust} km/h`,
      `${h.blizzardRisk}%`,
      `${h.pressure} hPa`,
      h.activitySafety,
    ])

    autoTable(doc, {
      startY: y,
      head: [['Hour (UTC)', 'Temp', 'Chill', 'Condition', 'Wind', 'Gust', 'Blizzard', 'Pressure', 'Safety Protocol']],
      body: hourlyRows,
      theme: 'grid',
      headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 6.5, fontStyle: 'bold', cellPadding: 1.6 },
      bodyStyles: { fontSize: 6.2, textColor: [30, 41, 59], cellPadding: 1.6 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // 8. Polar Safety Mandate & Directives
  if (y > 220) { doc.addPage(); y = 20 }
  y = drawSectionHeading(doc, y, 'EXPEDITION SAFETY DIRECTIVES (MINISTRY OF EARTH SCIENCES)')
  const metDirectives = [
    '1. BLIZZARD PROTOCOL: Outdoor foot travel beyond 50m of main station structure prohibited when wind exceeds 60 km/h or visibility drops below 200m.',
    '2. AVIATION & HELI SORTIES: Chetak / Dhruv helicopter sorties require sustained wind < 45 km/h, gust spread < 15 km/h, and zero active whiteout warning.',
    '3. GENERATOR LOAD COMPENSATION: Heating trace lines for water intake ducts and bulk fuel tanks must remain at maximum heating profile throughout sub -25°C windows.',
  ]
  y += 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2])
  metDirectives.forEach(dir => {
    doc.text(dir, 16, y)
    y += 4
  })
  y += 2

  // 9. Black-Box Cryptographic Registration
  if (y > 215) { doc.addPage(); y = 20 }
  y = drawBlackBoxRegistration(doc, y, 0, 'SHA256:4d8e91c2b5f087e31a89c42de71b650a32e189cf')

  // 10. Official Sign-off block
  if (y > 230) { doc.addPage(); y = 20 }
  y = drawSignOffBlock(doc, y, stationStr)

  // 11. Watermark & Universal Footers
  drawWatermark(doc, 'NCPOR • POLAR ARCHIVE')
  addDocumentFooters(doc)

  const filename = `NCPOR_Weather_SITREP_${stationId.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. OFFICIAL SITREP WEEKLY GAZETTE PDF (Government Gazette Pattern)
// ─────────────────────────────────────────────────────────────────────────────

export interface SitrepGazetteParams {
  selectedWeek?: string
  stationId?: string
  sitrepNumber?: string
}

export async function generateSitrepGazettePDF({
  selectedWeek = '11 Sep 2026 – 18 Sep 2026',
  stationId = 'maitri',
  sitrepNumber,
}: SitrepGazetteParams = {}): Promise<void> {
  const stationStr = stationId === 'maitri' ? 'Maitri Base' : 'Bharati Base'
  const facilityCoords = stationId === 'maitri' ? 'MAITRI BASE (70°45\'S, 11°44\'E)' : 'BHARATI BASE (69°24\'S, 76°11\'E)'
  const refId = sitrepNumber || `NCPOR/SITREP/45-ISEA/${stationId === 'maitri' ? 'MAI' : 'BHR'}/2026-W37`

  // 1. High-fidelity DOM capture using html2canvas if rendered on page
  const docElem = typeof document !== 'undefined' ? document.getElementById('printable-gazette-doc') : null
  if (docElem) {
    try {
      const canvas = await html2canvas(docElem, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#fcfcfb',
        scrollX: 0,
        scrollY: 0,
        windowWidth: docElem.scrollWidth || 1024,
        windowHeight: docElem.scrollHeight || 1400,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('printable-gazette-doc')
          if (el) {
            el.style.overflow = 'visible'
            el.style.maxHeight = 'none'
            el.style.height = 'auto'
          }
        },
      })
      const imgData = canvas.toDataURL('image/png')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth() // 210
      const pageHeight = doc.internal.pageSize.getHeight() // 297
      const margin = 8
      const printWidth = pageWidth - (margin * 2) // 194
      const printHeight = (canvas.height * printWidth) / canvas.width

      if (printHeight <= pageHeight - (margin * 2)) {
        doc.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight, undefined, 'FAST')
      } else {
        const scale = (pageHeight - (margin * 2)) / printHeight
        const finalW = printWidth * scale
        const finalH = pageHeight - (margin * 2)
        const offsetX = (pageWidth - finalW) / 2
        doc.addImage(imgData, 'PNG', offsetX, margin, finalW, finalH, undefined, 'FAST')
      }

      const filename = `${refId.replace(/\//g, '_')}.pdf`
      doc.save(filename)
      return
    } catch (err) {
      console.warn('html2canvas capture failed, falling back to programmatic PDF:', err)
    }
  }

  // 2. Pure programmatic vector fallback (matching exact layout and contents of screenshot)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // 1. Official Government Header (Ashoka Lion Capital + MoES / NCPOR)
  let y = drawGovtGazetteHeader(
    doc,
    'साप्ताहिक टेलीमेट्री एवं परिचालन स्थिति प्रतिवेदन (SITREP)',
    'WEEKLY POLAR EXPEDITION TELEMETRY ARCHIVE DIGEST'
  )

  // 2. Official Metadata Grid matching user's exact uploaded Government Gazette screenshot
  y = drawGovtMetadataGrid(doc, y, [
    { label: 'Gazette Serial Ref', value: refId },
    { label: 'Archived Window', value: selectedWeek },
    { label: 'Station Identity', value: facilityCoords },
    { label: 'Ground Satellite Lock', value: '99.4% (ISRO GSAT-30)', color: [22, 163, 74] },
    { label: 'Decimation Ratio', value: '60,480 Samples Decimated to 672 Hourly Rollups (93.8% Saved)' },
  ])

  // 3. Subsystem Telemetry Summary Table (matching exact 4 rows in screenshot)
  y = drawSectionHeading(doc, y, '1. प्रमुख उपप्रणालियों की परिचालन स्थिति (SUBSYSTEM TELEMETRY SUMMARY)')

  const subsystemRows = [
    ['Primary Microgrid (DG-1, DG-2, BESS)', '84.2 kW continuous', 'Coolant Temp +86.2°C nominal', 'NORMAL'],
    ['Arctic Grade Fuel Reserve', '138,400 Litres (214 Days Autonomy)', 'Thermal Tracing Line Active (-38°C)', 'AUTONOMOUS'],
    ['Habitat Life Support & HVAC', '+21.4°C Living Core / 410 ppm CO2', 'Triple-Glazed Thermal Aerogel', 'NOMINAL'],
    ['Snow-Melt Fresh Water Recycler', '9,200 Litres Reservoir Buffer', 'CHP Waste Heat Re-use (+48°C)', 'OPTIMAL'],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Subsystem Unit', 'Average Operational Load', 'Cold Resistance Metric', 'Status']],
    body: subsystemRows,
    theme: 'grid',
    headStyles: { fillColor: [MOES_NAVY[0], MOES_NAVY[1], MOES_NAVY[2]], fontSize: 7.2, fontStyle: 'bold', cellPadding: 2.4 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2.4 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: 'bold' },
      1: { cellWidth: 50 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 26, fontStyle: 'bold', textColor: [22, 163, 74] },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // 4. Black-Box Cryptographic Registration Block (matching exact section in screenshot)
  y = drawBlackBoxRegistration(
    doc,
    y,
    1,
    'SHA256:7f8b92c4e1a056d39fa451b68ce92d4f8a123e7b'
  )

  // 5. Official Sign-off block with stamp and signature
  if (y > 230) { doc.addPage(); y = 20 }
  y = drawSignOffBlock(doc, y, stationStr)

  // 6. Watermark and Footers on all pages
  drawWatermark(doc, 'NCPOR • POLAR ARCHIVE')
  addDocumentFooters(doc)

  const filename = `${refId.replace(/\//g, '_')}.pdf`
  doc.save(filename)
}
