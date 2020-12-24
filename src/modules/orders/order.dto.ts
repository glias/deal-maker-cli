import type { OrderType } from './order.entity'
export interface OrderDto {
  id: string
  tokenId: string
  type: OrderType
  priceEffect: bigint
  priceExponent: bigint
  blockNumber: number
  output: string
}
