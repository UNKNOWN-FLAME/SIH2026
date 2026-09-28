import React, { useState } from 'react'
import { downloadLatestPdfReport } from '../../api/hq'

interface DownloadReportButtonProps {
  stationId?: string
  className?: string
  style?: React.CSSProperties
  variant?: 'primary' | 'secondary' | 'compact'
}

export default function DownloadReportButton({
  stationId = 'bharati',
  className = '',
  style = {},
  variant = 'primary',
}: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    setFeedback(null)
    setIsError(false)

    try {
      const filename = await downloadLatestPdfReport(stationId)
      setFeedback(`✓ ${filename}`)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      console.error('Failed to download report PDF:', err)
      setIsError(true)
      const msg = err.response?.data?.detail || 'Report not available'
      setFeedback(`❌ ${msg}`)
      setTimeout(() => setFeedback(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  const isCompact = variant === 'compact'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      <button
        onClick={handleDownload}
        disabled={loading}
        title={`Download Latest 3-Hour RCA Report for ${stationId.toUpperCase()}`}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: isCompact ? '4px 10px' : '6px 14px',
          background: loading ? '#64748b' : '#0b3b60',
          color: '#ffffff',
          border: '1px solid #072a44',
          borderRadius: 2,
          fontSize: isCompact ? 11 : 12,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          transition: 'all 0.15s ease-in-out',
          opacity: loading ? 0.75 : 1,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.background = '#0f4c7d'
        }}
        onMouseLeave={(e) => {
          if (!loading) e.currentTarget.style.background = '#0b3b60'
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: isCompact ? 14 : 16, color: '#fbbf24' }}
        >
          {loading ? 'sync' : 'picture_as_pdf'}
        </span>
        <span>
          {loading
            ? 'Downloading…'
            : isCompact
            ? 'PDF Report'
            : 'Download 3H Report (PDF)'}
        </span>
      </button>

      {/* Dynamic Feedback Toast / Tooltip */}
      {feedback && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 2,
            background: isError ? '#fee2e2' : '#dcfce7',
            color: isError ? '#991b1b' : '#166534',
            border: `1px solid ${isError ? '#f87171' : '#86efac'}`,
            whiteSpace: 'nowrap',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {feedback}
        </span>
      )}
    </div>
  )
}
