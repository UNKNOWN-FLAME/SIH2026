import { useQuery } from '@tanstack/react-query'
import {
  getEnergyForecast,
  getFuelForecast,
  getEquipmentAnomalies,
  getMaintenanceSchedule,
  getWeatherEnsemble,
  getPredictionsV2,
} from '../api/hq'

export function useEnergyForecast(stationId: string) {
  return useQuery({
    queryKey: ['energy-forecast', stationId],
    queryFn: () => getEnergyForecast(stationId),
    refetchInterval: 30_000,
    enabled: Boolean(stationId),
  })
}

export function useFuelForecast(stationId: string) {
  return useQuery({
    queryKey: ['fuel-forecast', stationId],
    queryFn: () => getFuelForecast(stationId),
    refetchInterval: 30_000,
    enabled: Boolean(stationId),
  })
}

export function useEquipmentAnomalies(stationId: string) {
  return useQuery({
    queryKey: ['equipment-anomalies', stationId],
    queryFn: () => getEquipmentAnomalies(stationId),
    refetchInterval: 15_000,
    enabled: Boolean(stationId),
  })
}

export function useMaintenanceSchedule(stationId: string) {
  return useQuery({
    queryKey: ['maintenance-schedule', stationId],
    queryFn: () => getMaintenanceSchedule(stationId),
    refetchInterval: 60_000,
    enabled: Boolean(stationId),
  })
}

export function useWeatherEnsemble(stationId: string) {
  return useQuery({
    queryKey: ['weather-ensemble', stationId],
    queryFn: () => getWeatherEnsemble(stationId),
    refetchInterval: 45_000,
    enabled: Boolean(stationId),
  })
}

export function usePredictionsV2(stationId: string) {
  return useQuery({
    queryKey: ['predictions-v2', stationId],
    queryFn: () => getPredictionsV2(stationId),
    refetchInterval: 30_000,
    enabled: Boolean(stationId),
  })
}
