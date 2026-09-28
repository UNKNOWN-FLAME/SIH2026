export interface RequisitionItem {
  id: string
  name: string
  sku: string
  category: 'Fuel' | 'Mechanical Spares' | 'Electrical Spares' | 'Telecom & IT' | 'Scientific' | 'Life Support' | 'Safety'
  quantity: number
  unit: string
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  reason: string
  stationId: 'maitri' | 'bharati'
  addedAt: string
  sourceAnomaly: string
}

const STORAGE_KEY = 'himantar_shipment_requisitions'

export function getShipmentRequisitions(stationId?: string): RequisitionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: RequisitionItem[] = JSON.parse(raw)
    if (stationId) {
      return parsed.filter((item) => item.stationId === stationId)
    }
    return parsed
  } catch {
    return []
  }
}

export function addShipmentRequisition(item: RequisitionItem): RequisitionItem[] {
  try {
    const current = getShipmentRequisitions()
    const existingIndex = current.findIndex((i) => i.id === item.id)
    let updated: RequisitionItem[]
    if (existingIndex >= 0) {
      updated = [...current]
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + item.quantity,
        addedAt: new Date().toISOString(),
      }
    } else {
      updated = [item, ...current]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('himantar_requisitions_updated', { detail: updated }))
    return updated
  } catch {
    return []
  }
}

export function removeShipmentRequisition(id: string): RequisitionItem[] {
  try {
    const current = getShipmentRequisitions()
    const updated = current.filter((i) => i.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('himantar_requisitions_updated', { detail: updated }))
    return updated
  } catch {
    return []
  }
}

export function clearShipmentRequisitions(stationId?: string): void {
  try {
    if (!stationId) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      const current = getShipmentRequisitions()
      const remaining = current.filter((i) => i.stationId !== stationId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
    }
    window.dispatchEvent(new CustomEvent('himantar_requisitions_updated'))
  } catch {}
}
