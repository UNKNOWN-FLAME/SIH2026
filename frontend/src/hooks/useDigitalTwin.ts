import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDigitalTwinState,
  triggerDigitalTwinFault,
  dispatchDigitalTwinWorkOrder,
  type DigitalTwinStateOut,
} from '../api/hq'

export function useDigitalTwin(stationId: string) {
  return useQuery<DigitalTwinStateOut>({
    queryKey: ['digital-twin', stationId],
    queryFn: () => getDigitalTwinState(stationId),
    refetchInterval: 2_000, // 2s live polling for real-time physics telemetry
    enabled: Boolean(stationId),
  })
}

export function useTriggerDigitalTwinFault(stationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ faultId, severity = 1.0 }: { faultId: string; severity?: number }) =>
      triggerDigitalTwinFault(stationId, faultId, severity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-twin', stationId] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors', stationId] })
    },
  })
}

export function useDispatchDigitalTwinRepair(stationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (faultId: string) => dispatchDigitalTwinWorkOrder(stationId, faultId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-twin', stationId] })
      queryClient.invalidateQueries({ queryKey: ['iot-sensors', stationId] })
    },
  })
}
