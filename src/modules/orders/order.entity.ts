// @ts-nocheck
import { Entity, PrimaryColumn, Column } from 'typeorm'

export enum OrderType {
  Bid, // 00
  Ask, // 01
}
export enum OrderStatus {
  Available,
  Pending,
}

@Entity()
export class Order {
  @PrimaryColumn('varchar')
  id: string // tx_hash + output_index

  @Column('varchar', { name: 'token_id' })
  tokenId: string

  @Column('int8')
  type: OrderType

  @Column('int8', { default: OrderStatus.Available })
  status: OrderStatus

  @Column('int')
  price: number

  @Column('int', { name: 'block_number' })
  blockNumber: number

  @Column('varchar')
  output: string
}
