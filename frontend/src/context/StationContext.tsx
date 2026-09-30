import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getStationLinkState,
  setStationLinkState,
  syncEdgeBuffer,
  clearAnomaly,
  type AnomalyInjectionResult,
  type SyncBufferResponse,
} from '../api/hq'
import { getToken } from '../api/client'
import { useQueryClient } from '@tanstack/react-query'

export type StationId = 'maitri' | 'bharati'
export type LinkState = 'UP' | 'DOWN' | 'DEGRADED'

export interface InjectedAnomalyRecord extends AnomalyInjectionResult {
  ended_at?: string
}

interface StationContextType {
  stationId: StationId
  setStationId: (id: StationId | ((prev: StationId) => StationId)) => void
  linkState: LinkState
  isOnline: boolean
  edgeBufferCount: number
  toggleLinkState: () => Promise<void>
  flushEdgeBuffer: () => Promise<SyncBufferResponse | null>
  lastAnomalyResult: AnomalyInjectionResult | null
  setLastAnomalyResult: (res: AnomalyInjectionResult | null) => void
  emergencyAlert: AnomalyInjectionResult | null
  triggerEmergencyAlert: (res: AnomalyInjectionResult) => void
  dismissEmergencyAlert: () => void
  activeIncidentId: string | null
  setActiveIncidentId: (id: string | null) => void
  refreshLinkState: () => Promise<void>
  isBlackBoxOpen: boolean
  openBlackBox: () => void
  closeBlackBox: () => void
  isImpactModalOpen: boolean
  openImpactModal: () => void
  closeImpactModal: () => void
  completedIncidentResult: AnomalyInjectionResult | null
  anomalyHistory: InjectedAnomalyRecord[]
  clearAnomalyHistory: () => void
  // Blackout modal
  isBlackoutModalOpen: boolean
  closeBlackoutModal: () => void
  postBlackoutIncident: AnomalyInjectionResult | null
  // Telemetry sync
  isTelemetrySyncing: boolean
  syncProgress: number
  syncStage: string
  // Additional actions
  acknowledgeAnomalyAtHQ: () => void
  clearCompletedIncident: () => void
  endAnomalyOnConsole: (stationId?: string) => void
}

const StationContext = createContext<StationContextType | undefined>(undefined)

export function StationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const [stationId, setStationIdState] = useState<StationId>(() => {
    const raw = localStorage.getItem('himantar_active_station')
    return raw === 'bharati' ? 'bharati' : 'maitri'
  })
  const [linkState, setLinkState] = useState<LinkState>('UP')
  const [edgeBufferCount, setEdgeBufferCount] = useState<number>(0)
  const [lastAnomalyResult, setLastAnomalyResultState] = useState<AnomalyInjectionResult | null>(() => {
    try {
      const raw = localStorage.getItem('himantar_last_anomaly')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [completedIncidentResult, setCompletedIncidentResult] = useState<AnomalyInjectionResult | null>(() => {
    try {
      const raw = localStorage.getItem('himantar_last_completed_incident')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [anomalyHistory, setAnomalyHistory] = useState<InjectedAnomalyRecord[]>(() => {
    try {
      const raw = localStorage.getItem('himantar_anomaly_history')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const clearAnomalyHistory = useCallback(() => {
    setAnomalyHistory([])
    try {
      localStorage.removeItem('himantar_anomaly_history')
    } catch {}
  }, [])

  const [isImpactModalOpen, setIsImpactModalOpen] = useState<boolean>(false)
  const openImpactModal = useCallback(() => setIsImpactModalOpen(true), [])
  const closeImpactModal = useCallback(() => setIsImpactModalOpen(false), [])

  // Blackout modal state
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState<boolean>(false)
  const [postBlackoutIncident, setPostBlackoutIncident] = useState<AnomalyInjectionResult | null>(null)
  const closeBlackoutModal = useCallback(() => setIsBlackoutModalOpen(false), [])

  // Telemetry sync state
  const [isTelemetrySyncing, setIsTelemetrySyncing] = useState<boolean>(false)
  const [syncProgress, setSyncProgress] = useState<number>(0)
  const [syncStage, setSyncStage] = useState<string>('')

  // Suppress unused-variable warnings for setters that are internal state only
  void setIsTelemetrySyncing
  void setSyncProgress
  void setSyncStage
  void setPostBlackoutIncident
  void setIsBlackoutModalOpen

  const setLastAnomalyResult = useCallback((res: AnomalyInjectionResult | null) => {
    setLastAnomalyResultState((prev) => {
      const nowIso = new Date().toISOString()
      // When anomaly ends (transitions from active to null):
      if (prev && res === null) {
        const completedWithEnd = {
          ...prev,
          ended_at: nowIso,
        }
        setCompletedIncidentResult(completedWithEnd)
        try {
          localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
        } catch {}
        setIsImpactModalOpen(true)

        // Close it in anomalyHistory
        setAnomalyHistory((prevHistory) => {
          const updated = prevHistory.map((item) => {
            if (!item.ended_at && (item.incident_id === prev.incident_id || item.anomaly_id === prev.anomaly_id)) {
              return { ...item, ended_at: nowIso }
            }
            return item
          })
          try {
            localStorage.setItem('himantar_anomaly_history', JSON.stringify(updated.slice(-50)))
          } catch {}
          return updated
        })
      } else if (res) {
        // When a new anomaly is injected:
        setAnomalyHistory((prevHistory) => {
          // If a previous one was running without ended_at, close it at now
          const closed = prevHistory.map((item) =>
            !item.ended_at ? { ...item, ended_at: nowIso } : item
          )
          const newRecord: InjectedAnomalyRecord = {
            ...res,
            injected_at: res.injected_at || nowIso,
          }
          const updated = [...closed, newRecord]
          try {
            localStorage.setItem('himantar_anomaly_history', JSON.stringify(updated.slice(-50)))
          } catch {}
          return updated
        })
      }
      return res
    })
    try {
      if (res) {
        localStorage.setItem('himantar_last_anomaly', JSON.stringify(res))
      } else {
        localStorage.removeItem('himantar_last_anomaly')
        // Automatically restore IoT sensors and nominal baseline via backend
        clearAnomaly(stationId).catch(() => {})
        queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
        queryClient.invalidateQueries({ queryKey: ['sensors'] })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['stations'] })
      }
    } catch {}
  }, [stationId, queryClient])

  const [emergencyAlert, setEmergencyAlert] = useState<AnomalyInjectionResult | null>(null)

  const triggerEmergencyAlert = useCallback((res: AnomalyInjectionResult) => {
    setEmergencyAlert(res)
    setLastAnomalyResult(res)
  }, [setLastAnomalyResult])

  const dismissEmergencyAlert = useCallback(() => {
    setEmergencyAlert(null)
  }, [])

  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const [isBlackBoxOpen, setIsBlackBoxOpen] = useState<boolean>(false)
  const openBlackBox = useCallback(() => setIsBlackBoxOpen(true), [])
  const closeBlackBox = useCallback(() => setIsBlackBoxOpen(false), [])

  const setStationId = useCallback((action: StationId | ((prev: StationId) => StationId)) => {
    setStationIdState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      const safe: StationId = next === 'bharati' ? 'bharati' : 'maitri'
      localStorage.setItem('himantar_active_station', safe)
      return safe
    })
  }, [])

  const refreshLinkState = useCallback(async () => {
    // Only query backend if authenticated; avoids 401 on login page
    if (!getToken()) return
    try {
      const res = await getStationLinkState(stationId)
      setLinkState(res.link_state)
      setEdgeBufferCount(res.edge_buffer_count)
    } catch {
      // In offline / fallback mode, keep existing state
    }
  }, [stationId])

  useEffect(() => {
    if (!getToken()) return
    refreshLinkState()
    const timer = setInterval(refreshLinkState, 8000)
    return () => clearInterval(timer)
  }, [refreshLinkState])

  const toggleLinkState = useCallback(async () => {
    const nextState: LinkState = linkState === 'UP' ? 'DOWN' : 'UP'
    try {
      const res = await setStationLinkState(stationId, nextState === 'UP' ? 'UP' : 'DOWN')
      setLinkState(res.link_state)
      setEdgeBufferCount(res.edge_buffer_count)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
    } catch (e) {
      console.error('Failed to toggle link state:', e)
      // Optimistic update
      setLinkState(nextState)
      queryClient.invalidateQueries({ queryKey: ['stations'] })
    }
  }, [stationId, linkState, queryClient])

  const flushEdgeBuffer = useCallback(async (): Promise<SyncBufferResponse | null> => {
    try {
      const res = await syncEdgeBuffer(stationId)
      setLinkState('UP')
      setEdgeBufferCount(0)
      await setStationLinkState(stationId, 'UP').catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
      return res
    } catch (e) {
      console.error('Failed to flush edge buffer:', e)
      try {
        await setStationLinkState(stationId, 'UP')
      } catch {}
      setLinkState('UP')
      setEdgeBufferCount(0)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
      return null
    }
  }, [stationId, queryClient])

  const isOnline = linkState === 'UP'

  const acknowledgeAnomalyAtHQ = useCallback(() => {
    dismissEmergencyAlert()
  }, [dismissEmergencyAlert])

  const clearCompletedIncident = useCallback(() => {
    setCompletedIncidentResult(null)
    try { localStorage.removeItem('himantar_last_completed_incident') } catch {}
  }, [])

  const endAnomalyOnConsole = useCallback((_stationId?: string) => {
    setLastAnomalyResult(null)
  }, [setLastAnomalyResult])

  return (
    <StationContext.Provider
      value={{
        stationId,
        setStationId,
        linkState,
        isOnline,
        edgeBufferCount,
        toggleLinkState,
        flushEdgeBuffer,
        lastAnomalyResult,
        setLastAnomalyResult,
        emergencyAlert,
        triggerEmergencyAlert,
        dismissEmergencyAlert,
        activeIncidentId,
        setActiveIncidentId,
        refreshLinkState,
        isBlackBoxOpen,
        openBlackBox,
        closeBlackBox,
        isImpactModalOpen,
        openImpactModal,
        closeImpactModal,
        completedIncidentResult,
        anomalyHistory,
        clearAnomalyHistory,
        isBlackoutModalOpen,
        closeBlackoutModal,
        postBlackoutIncident,
        isTelemetrySyncing,
        syncProgress,
        syncStage,
        acknowledgeAnomalyAtHQ,
        clearCompletedIncident,
        endAnomalyOnConsole,
      }}
    >
      {children}
    </StationContext.Provider>
  )
}

export function useStation() {
  const ctx = useContext(StationContext)
  if (!ctx) {
    throw new Error('useStation must be used within a StationProvider')
  }
  return ctx
}
