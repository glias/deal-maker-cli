import type { OrderType } from './order.entity'
export interface OrderDto {
  id: string
  tokenId: string
  type: OrderType
  price: Record<'effect' | 'exponent', bigint>
  blockNumber: number
  output: string
}
