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
  acknowledgeAnomalyAtHQ: () => void
  endAnomalyOnConsole: (targetStation?: StationId) => Promise<void>
  postBlackoutIncident: AnomalyInjectionResult | null
  isBlackoutModalOpen: boolean
  openBlackoutModal: () => void
  closeBlackoutModal: () => void
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
  clearCompletedIncident: () => void
  isTelemetrySyncing: boolean
  syncProgress: number
  syncStage: string
  runTelemetrySyncAnimation: (onComplete?: () => void) => void
  broadcastSyncEvent: (msg: {
    type: string
    linkState?: LinkState
    edgeBufferCount?: number
    stationId?: StationId
    anomaly?: AnomalyInjectionResult | null
    [key: string]: unknown
  }) => void
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

  // Post-Blackout Synchronization State
  const [postBlackoutIncident, setPostBlackoutIncident] = useState<AnomalyInjectionResult | null>(() => {
    try {
      const raw = localStorage.getItem('himantar_post_blackout_incident')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState<boolean>(false)
  const openBlackoutModal = useCallback(() => setIsBlackoutModalOpen(true), [])
  const closeBlackoutModal = useCallback(() => {
    setIsBlackoutModalOpen(false)
    setPostBlackoutIncident(null)
    localStorage.removeItem('himantar_post_blackout_incident')
  }, [])

  const [isImpactModalOpen, setIsImpactModalOpen] = useState<boolean>(false)
  const openImpactModal = useCallback(() => setIsImpactModalOpen(true), [])
  const closeImpactModal = useCallback(() => setIsImpactModalOpen(false), [])

  // ── High-Fidelity Satellite Telemetry Sync Animation ──
  const [isTelemetrySyncing, setIsTelemetrySyncing] = useState<boolean>(false)
  const [syncProgress, setSyncProgress] = useState<number>(0)
  const [syncStage, setSyncStage] = useState<string>('')

  const runTelemetrySyncAnimation = useCallback((onComplete?: () => void) => {
    setIsTelemetrySyncing(true)
    setSyncProgress(12)
    setSyncStage('Locking GSAT-7 S-Band transponder carrier...')

    const t1 = setTimeout(() => {
      setSyncProgress(38)
      setSyncStage('Validating Protobuf telemetry frames & CRC-32...')
    }, 450)

    const t2 = setTimeout(() => {
      setSyncProgress(72)
      setSyncStage('Decrypting NVMe SSD flight recorder block chain...')
    }, 950)

    const t3 = setTimeout(() => {
      setSyncProgress(94)
      setSyncStage('Reconciling Dual-Twin telemetry with Goa HQ...')
    }, 1500)

    const t4 = setTimeout(() => {
      setSyncProgress(100)
      setSyncStage('✓ 100% Dual-Twin Parity Verified (0 Packet Loss)')
      if (onComplete) onComplete()
    }, 2000)

    const t5 = setTimeout(() => {
      setIsTelemetrySyncing(false)
      setSyncProgress(0)
      setSyncStage('')
    }, 3400)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [])

  const broadcastSyncEvent = useCallback((msg: {
    type: string
    linkState?: LinkState
    edgeBufferCount?: number
    stationId?: StationId
    anomaly?: AnomalyInjectionResult | null
    [key: string]: unknown
  }) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('himantar_dual_twin_sync')
        ch.postMessage(msg)
        ch.close()
      }
      localStorage.setItem('himantar_dual_twin_last_event', JSON.stringify({ ...msg, _t: Date.now() }))
    } catch (e) {
      console.debug('Dual-twin broadcast error:', e)
    }
  }, [])

  // Check and trigger offline blackout reconciliation when link transitions to UP
  const checkAndTriggerOfflineReconciliation = useCallback((targetStation: string) => {
    try {
      const raw = localStorage.getItem('himantar_offline_incidents_queue')
      if (!raw) return
      const queue = JSON.parse(raw)
      if (Array.isArray(queue) && queue.length > 0) {
        const latest = queue[queue.length - 1]
        setPostBlackoutIncident(latest)
        localStorage.setItem('himantar_post_blackout_incident', JSON.stringify(latest))

        // Inject into mission alerts store
        const storeKey = `himantar_mission_alerts_store_${targetStation.toLowerCase()}`
        const existingAlerts = JSON.parse(localStorage.getItem(storeKey) || '[]')
        const newAlert = {
          alert_id: `ALR-OFFLINE-${Date.now()}`,
          station_id: targetStation,
          title: `[OFFLINE SYNC] ${latest.anomaly_name}`,
          subsystem: latest.category || 'telemetry',
          severity: latest.severity || 'HIGH',
          ack_state: 'OPEN',
          description: `Anomaly occurred during satellite link blackout: ${latest.description}`,
          created_at: latest.occurredAt || new Date().toISOString(),
          stored_at: new Date().toISOString(),
        }
        localStorage.setItem(storeKey, JSON.stringify([newAlert, ...existingAlerts].slice(0, 150)))
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        // Clear offline queue
        localStorage.removeItem('himantar_offline_incidents_queue')

        broadcastSyncEvent({
          type: 'POST_BLACKOUT_SYNC',
          incident: latest,
          stationId: targetStation as StationId,
        })
      }
    } catch (e) {
      console.error('Failed to reconcile offline incidents:', e)
    }
  }, [queryClient, broadcastSyncEvent])

  // ── Real-time Cross-Window Synchronization (BroadcastChannel + LocalStorage) ──
  useEffect(() => {
    let ch: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel('himantar_dual_twin_sync')
      ch.onmessage = (event) => {
        handleSyncPayload(event.data)
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === 'himantar_dual_twin_last_event' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue)
          handleSyncPayload(payload)
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)

    function handleSyncPayload(data: any) {
      if (!data || typeof data !== 'object') return
      if (data.type === 'LINK_UPDATE') {
        if (data.linkState) {
          setLinkState(data.linkState)
          if (data.linkState === 'UP') {
            checkAndTriggerOfflineReconciliation(data.stationId || stationId)
          }
        }
        if (typeof data.edgeBufferCount === 'number') setEdgeBufferCount(data.edgeBufferCount)
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['stations'] })
      } else if (data.type === 'BUFFER_TICK') {
        if (typeof data.edgeBufferCount === 'number') setEdgeBufferCount(data.edgeBufferCount)
      } else if (data.type === 'FLUSH_UPDATE') {
        setLinkState('UP')
        setEdgeBufferCount(0)
        runTelemetrySyncAnimation()
        checkAndTriggerOfflineReconciliation(data.stationId || stationId)
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['stations'] })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['sensors'] })
        queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
      } else if (data.type === 'ANOMALY_TRIGGER') {
        if (data.anomaly) {
          setLastAnomalyResultState(data.anomaly)
          setEmergencyAlert(data.anomaly)
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          queryClient.invalidateQueries({ queryKey: ['sensors'] })
          queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }
      } else if (data.type === 'CONSOLE_ANOMALY_END') {
        // Console ended the anomaly.
        setLastAnomalyResultState((prev) => {
          if (!prev) return null
          const completedWithEnd = {
            ...prev,
            consoleEnded: true,
            ended_at: new Date().toISOString(),
          }
          setCompletedIncidentResult(completedWithEnd)
          try {
            localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
          } catch {}
          if (prev.hqAcknowledged) {
            localStorage.removeItem('himantar_last_anomaly')
            return null
          }
          const updated = { ...prev, consoleEnded: true }
          try {
            localStorage.setItem('himantar_last_anomaly', JSON.stringify(updated))
          } catch {}
          return updated
        })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (data.type === 'HQ_ANOMALY_ACK') {
        // HQ acknowledged the anomaly.
        setEmergencyAlert(null)
        setLastAnomalyResultState((prev) => {
          if (!prev) return null
          const completedWithEnd = {
            ...prev,
            hqAcknowledged: true,
            ended_at: prev.ended_at || new Date().toISOString(),
          }
          setCompletedIncidentResult(completedWithEnd)
          try {
            localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
          } catch {}
          if (prev.consoleEnded) {
            localStorage.removeItem('himantar_last_anomaly')
            return null
          }
          const updated = { ...prev, hqAcknowledged: true }
          try {
            localStorage.setItem('himantar_last_anomaly', JSON.stringify(updated))
          } catch {}
          return updated
        })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (data.type === 'POST_BLACKOUT_SYNC') {
        if (data.incident) {
          setPostBlackoutIncident(data.incident)
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }
      } else if (data.type === 'ANOMALY_CLEAR') {
        setLastAnomalyResultState((prev) => {
          if (prev) {
            const completedWithEnd = {
              ...prev,
              consoleEnded: true,
              hqAcknowledged: true,
              ended_at: new Date().toISOString(),
            }
            setCompletedIncidentResult(completedWithEnd)
            try {
              localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
            } catch {}
          }
          return null
        })
        setEmergencyAlert(null)
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        queryClient.invalidateQueries({ queryKey: ['sensors'] })
        queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (data.type === 'CLEAR_COMPLETED_INCIDENT') {
        setCompletedIncidentResult(null)
        try {
          localStorage.removeItem('himantar_last_completed_incident')
        } catch {}
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } else if (data.type === 'STATION_SWITCH') {
        if (data.stationId) setStationIdState(data.stationId)
      }
    }

    return () => {
      if (ch) ch.close()
      window.removeEventListener('storage', handleStorage)
    }
  }, [queryClient, stationId, checkAndTriggerOfflineReconciliation])

  // ── Offline Buffer 1Hz Ticker ──
  useEffect(() => {
    if (linkState !== 'DOWN') return
    const timer = setInterval(() => {
      setEdgeBufferCount((prev) => {
        const next = prev + 1
        broadcastSyncEvent({
          type: 'BUFFER_TICK',
          edgeBufferCount: next,
          stationId,
        })
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [linkState, stationId, broadcastSyncEvent])

  const [emergencyAlert, setEmergencyAlert] = useState<AnomalyInjectionResult | null>(null)

  const triggerEmergencyAlert = useCallback((res: AnomalyInjectionResult) => {
    if (linkState === 'DOWN') {
      // ── OFFLINE BLACKOUT: DO NOT BROADCAST TO HQ ──
      const offlineItem: AnomalyInjectionResult = {
        ...res,
        occurredAt: new Date().toISOString(),
        injectedWhileOffline: true,
        consoleEnded: false,
        hqAcknowledged: false,
        lossAssessment: {
          equipmentStress: res.severity === 'CRITICAL' ? 'High - Thermal & Mechanical Excursion Exceeded Operational Safety limits' : 'Moderate - Redundant load shift',
          telemetryDeviation: res.impacts?.[0] || res.description,
          rationImpact: res.category === 'life_support' ? 'Minor ration quarantine risk' : 'None',
          estimatedDowntime: 'Buffered to local NVMe SSD (Zero Packet Loss)',
        },
        onIceActionTaken: 'Station Commander isolated affected subsystem, initiated trace heating & buffered frames to NVMe SSD flight recorder.',
      }

      try {
        const raw = localStorage.getItem('himantar_offline_incidents_queue')
        const queue = raw ? JSON.parse(raw) : []
        queue.push(offlineItem)
        localStorage.setItem('himantar_offline_incidents_queue', JSON.stringify(queue))
      } catch {}

      // Keep local state on console so the edge operator sees and manages the anomaly
      setEmergencyAlert(offlineItem)
      setLastAnomalyResultState(offlineItem)
      try {
        localStorage.setItem('himantar_edge_active_anomaly', JSON.stringify(offlineItem))
      } catch {}
      return
    }

    // ── ONLINE LINKED MODE ──
    const initialAlert: AnomalyInjectionResult = {
      ...res,
      consoleEnded: false,
      hqAcknowledged: false,
      injectedWhileOffline: false,
    }
    setEmergencyAlert(initialAlert)
    setLastAnomalyResultState(initialAlert)
    try {
      localStorage.setItem('himantar_last_anomaly', JSON.stringify(initialAlert))
      localStorage.setItem('himantar_edge_active_anomaly', JSON.stringify(initialAlert))
    } catch {}
    broadcastSyncEvent({
      type: 'ANOMALY_TRIGGER',
      anomaly: initialAlert,
      stationId,
    })
  }, [linkState, stationId, broadcastSyncEvent])

  // Dual-Condition Rule: Called when on-ice console ends/clears the anomaly
  const endAnomalyOnConsole = useCallback(async (targetStation?: StationId) => {
    const sid = targetStation || stationId
    clearAnomaly(sid).catch(() => {})
    try {
      localStorage.removeItem('himantar_edge_active_anomaly')
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
    queryClient.invalidateQueries({ queryKey: ['sensors'] })
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })

    setLastAnomalyResultState((prev) => {
      if (!prev) return null
      const completedWithEnd = {
        ...prev,
        consoleEnded: true,
        ended_at: new Date().toISOString(),
      }
      setCompletedIncidentResult(completedWithEnd)
      try {
        localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
      } catch {}

      if (prev.hqAcknowledged) {
        // Both conditions met (console ended + HQ acknowledged) -> clear active anomaly
        localStorage.removeItem('himantar_last_anomaly')
        return null
      }
      // HQ has not acknowledged yet -> keep showing with consoleEnded = true
      const updated = { ...prev, consoleEnded: true }
      try {
        localStorage.setItem('himantar_last_anomaly', JSON.stringify(updated))
      } catch {}
      return updated
    })

    broadcastSyncEvent({
      type: 'CONSOLE_ANOMALY_END',
      stationId: sid,
    })
  }, [stationId, queryClient, broadcastSyncEvent])

  // Dual-Condition Rule: Called when HQ acknowledges the alert
  const acknowledgeAnomalyAtHQ = useCallback((targetStation?: StationId) => {
    const sid = targetStation || stationId
    setEmergencyAlert(null) // Dismiss modal/siren

    setLastAnomalyResultState((prev) => {
      if (!prev) return null
      const completedWithEnd = {
        ...prev,
        hqAcknowledged: true,
        ended_at: prev.ended_at || new Date().toISOString(),
      }
      setCompletedIncidentResult(completedWithEnd)
      try {
        localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
      } catch {}

      if (prev.consoleEnded) {
        // Both conditions met (console ended + HQ acknowledged) -> clear active anomaly
        localStorage.removeItem('himantar_last_anomaly')
        return null
      }
      // Console has not ended yet -> keep showing with hqAcknowledged = true
      const updated = { ...prev, hqAcknowledged: true }
      try {
        localStorage.setItem('himantar_last_anomaly', JSON.stringify(updated))
      } catch {}
      return updated
    })

    broadcastSyncEvent({
      type: 'HQ_ANOMALY_ACK',
      stationId: sid,
    })
  }, [stationId, broadcastSyncEvent])

  const setLastAnomalyResult = useCallback((res: AnomalyInjectionResult | null) => {
    setLastAnomalyResultState((prev) => {
      if (prev && res === null) {
        const completedWithEnd = {
          ...prev,
          consoleEnded: true,
          hqAcknowledged: true,
          ended_at: new Date().toISOString(),
        }
        setCompletedIncidentResult(completedWithEnd)
        try {
          localStorage.setItem('himantar_last_completed_incident', JSON.stringify(completedWithEnd))
        } catch {}
      }
      return res
    })
    try {
      if (res) {
        localStorage.setItem('himantar_last_anomaly', JSON.stringify(res))
        if (linkState !== 'DOWN') {
          broadcastSyncEvent({
            type: 'ANOMALY_TRIGGER',
            anomaly: res,
            stationId,
          })
        }
      }
    } catch {}
  }, [stationId, linkState, broadcastSyncEvent])

  const dismissEmergencyAlert = useCallback(() => {
    setEmergencyAlert(null)
  }, [])

  const clearCompletedIncident = useCallback(() => {
    setCompletedIncidentResult(null)
    setLastAnomalyResultState((prev) => {
      if (prev && (prev.consoleEnded || prev.hqAcknowledged)) {
        try {
          localStorage.removeItem('himantar_last_anomaly')
        } catch {}
        return null
      }
      return prev
    })
    try {
      localStorage.removeItem('himantar_last_completed_incident')
      localStorage.removeItem('himantar_last_anomaly')
    } catch {}
    broadcastSyncEvent({
      type: 'CLEAR_COMPLETED_INCIDENT',
      stationId,
    })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }, [stationId, broadcastSyncEvent, queryClient])

  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const [isBlackBoxOpen, setIsBlackBoxOpen] = useState<boolean>(false)
  const openBlackBox = useCallback(() => setIsBlackBoxOpen(true), [])
  const closeBlackBox = useCallback(() => setIsBlackBoxOpen(false), [])

  const setStationId = useCallback((action: StationId | ((prev: StationId) => StationId)) => {
    setStationIdState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      const safe: StationId = next === 'bharati' ? 'bharati' : 'maitri'
      localStorage.setItem('himantar_active_station', safe)
      broadcastSyncEvent({
        type: 'STATION_SWITCH',
        stationId: safe,
      })
      return safe
    })
  }, [broadcastSyncEvent])

  const refreshLinkState = useCallback(async () => {
    if (!getToken()) return
    try {
      const res = await getStationLinkState(stationId)
      setLinkState(res.link_state)
      setEdgeBufferCount(res.edge_buffer_count)
    } catch {
      // Offline fallback
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
      if (res.link_state === 'UP') {
        checkAndTriggerOfflineReconciliation(stationId)
      }
      broadcastSyncEvent({
        type: 'LINK_UPDATE',
        linkState: res.link_state,
        edgeBufferCount: res.edge_buffer_count,
        stationId,
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
    } catch (e) {
      console.error('Failed to toggle link state:', e)
      setLinkState(nextState)
      if (nextState === 'UP') {
        checkAndTriggerOfflineReconciliation(stationId)
      }
      broadcastSyncEvent({
        type: 'LINK_UPDATE',
        linkState: nextState,
        edgeBufferCount: 0,
        stationId,
      })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
    }
  }, [stationId, linkState, queryClient, broadcastSyncEvent, checkAndTriggerOfflineReconciliation])

  const flushEdgeBuffer = useCallback(async (): Promise<SyncBufferResponse | null> => {
    runTelemetrySyncAnimation()
    try {
      const res = await syncEdgeBuffer(stationId)
      setLinkState('UP')
      setEdgeBufferCount(0)
      await setStationLinkState(stationId, 'UP').catch(() => {})
      checkAndTriggerOfflineReconciliation(stationId)
      broadcastSyncEvent({
        type: 'FLUSH_UPDATE',
        linkState: 'UP',
        edgeBufferCount: 0,
        stationId,
      })
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
      checkAndTriggerOfflineReconciliation(stationId)
      broadcastSyncEvent({
        type: 'FLUSH_UPDATE',
        linkState: 'UP',
        edgeBufferCount: 0,
        stationId,
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['stations'] })
      return null
    }
  }, [stationId, queryClient, broadcastSyncEvent, checkAndTriggerOfflineReconciliation])

  const isOnline = linkState === 'UP'

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
        acknowledgeAnomalyAtHQ,
        endAnomalyOnConsole,
        postBlackoutIncident,
        isBlackoutModalOpen,
        openBlackoutModal,
        closeBlackoutModal,
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
        clearCompletedIncident,
        isTelemetrySyncing,
        syncProgress,
        syncStage,
        runTelemetrySyncAnimation,
        broadcastSyncEvent,
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
