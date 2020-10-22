import type { OrderType } from './order.entity'
export interface OrderDto {
  id: string
  tokenId: string
  type: OrderType
  price: bigint
  blockNumber: number
  output: string
}
