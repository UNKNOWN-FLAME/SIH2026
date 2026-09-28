import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getStationLinkState,
  setStationLinkState,
  syncEdgeBuffer,
  type AnomalyInjectionResult,
  type SyncBufferResponse,
} from '../api/hq'
import { useQueryClient } from '@tanstack/react-query'

export type StationId = 'maitri' | 'bharati'
export type LinkState = 'UP' | 'DOWN' | 'DEGRADED'

interface StationContextType {
  stationId: StationId
  setStationId: (id: StationId) => void
  linkState: LinkState
  isOnline: boolean
  edgeBufferCount: number
  toggleLinkState: () => Promise<void>
  flushEdgeBuffer: () => Promise<SyncBufferResponse | null>
  lastAnomalyResult: AnomalyInjectionResult | null
  setLastAnomalyResult: (res: AnomalyInjectionResult | null) => void
  activeIncidentId: string | null
  setActiveIncidentId: (id: string | null) => void
  refreshLinkState: () => Promise<void>
}

const StationContext = createContext<StationContextType | undefined>(undefined)

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [stationId, setStationIdState] = useState<StationId>(() => {
    return (localStorage.getItem('himantar_active_station') as StationId) || 'maitri'
  })
  const [linkState, setLinkState] = useState<LinkState>('UP')
  const [edgeBufferCount, setEdgeBufferCount] = useState<number>(0)
  const [lastAnomalyResult, setLastAnomalyResult] = useState<AnomalyInjectionResult | null>(null)
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const setStationId = useCallback((id: StationId) => {
    setStationIdState(id)
    localStorage.setItem('himantar_active_station', id)
  }, [])

  const refreshLinkState = useCallback(async () => {
    try {
      const res = await getStationLinkState(stationId)
      setLinkState(res.link_state)
      setEdgeBufferCount(res.edge_buffer_count)
    } catch {
      // In offline / fallback mode, keep existing state
    }
  }, [stationId])

  useEffect(() => {
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
    } catch (e) {
      console.error('Failed to toggle link state:', e)
      // Optimistic update
      setLinkState(nextState)
    }
  }, [stationId, linkState, queryClient])

  const flushEdgeBuffer = useCallback(async (): Promise<SyncBufferResponse | null> => {
    try {
      const res = await syncEdgeBuffer(stationId)
      setLinkState('UP')
      setEdgeBufferCount(0)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      return res
    } catch (e) {
      console.error('Failed to flush edge buffer:', e)
      return null
    }
  }, [stationId, queryClient])

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
        activeIncidentId,
        setActiveIncidentId,
        refreshLinkState,
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
