import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAlerts, acknowledgeAlert, type PaginatedAlerts, type AlertOut } from '../api/hq'

export function useAlerts(params?: {
  station_id?: string
  ack_state?: string
  page_size?: number
}) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => getAlerts(params),
    refetchInterval: 10_000,
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, note }: { alertId: string; note?: string }) =>
      acknowledgeAlert(alertId, note),
    onMutate: async ({ alertId }) => {
      // Cancel any ongoing queries to prevent race conditions
      await qc.cancelQueries({ queryKey: ['alerts'] })

      // Optimistically remove the acknowledged alert from all alert queries in cache
      qc.setQueriesData<PaginatedAlerts>({ queryKey: ['alerts'] }, (old) => {
        if (!old || !old.items) return old
        return {
          ...old,
          total: Math.max(0, (old.total ?? 1) - 1),
          items: old.items.filter((item: AlertOut) => item.alert_id !== alertId),
        }
      })
    },
    onSuccess: () => {
      // Invalidate all alert queries and summary counts across the entire application
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['station'] })
      qc.invalidateQueries({ queryKey: ['stations'] })
    },
    onError: (err) => {
      console.error('Failed to acknowledge alert:', err)
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
