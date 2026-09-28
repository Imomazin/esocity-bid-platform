import { hashString } from '@/lib/rng'

/** Shipping provider abstraction. Demo provider now; Shippo / EasyPost / carrier APIs later. */

export interface ShipmentRequest {
  orderId: string
  orderReference: string
  postcode: string
  service: string
}

export interface Shipment {
  carrier: string
  trackingNumber: string
  labelUrl: string | null
  simulated: boolean
}

export interface ShippingProvider {
  readonly name: 'demo' | 'shippo' | 'easypost'
  createShipment(request: ShipmentRequest): Promise<Shipment>
}

export class DemoShippingProvider implements ShippingProvider {
  readonly name = 'demo' as const

  async createShipment(request: ShipmentRequest): Promise<Shipment> {
    return {
      carrier:
        request.service === 'NEXT_DAY' ? 'Esocity Priority (demo)' : 'Esocity Express (demo)',
      trackingNumber: demoTrackingNumber(request.orderId),
      labelUrl: null,
      simulated: true,
    }
  }
}

export function demoTrackingNumber(orderId: string): string {
  return `ESB${hashString(orderId).toString().padStart(10, '0').slice(0, 10)}GB`
}
