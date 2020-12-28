import { Entity, PrimaryColumn, Column } from 'typeorm'

export enum OrderType {
  Bid, // 00
  Ask, // 01
}

@Entity()
export class Order {
  @PrimaryColumn('varchar')
  id!: string // tx_hash + output_index

  @Column('varchar', { name: 'token_id' })
  tokenId!: string

  @Column('int8')
  type!: OrderType

  @Column('varchar', { length: 16, name: 'price_effect' })
  priceEffect!: string

  @Column('int', { name: 'price_exponent' })
  priceExponent!: number

  @Column('int', { name: 'block_number' })
  blockNumber!: number

  @Column('varchar')
  output!: string

  @Column('varchar', { name: 'owner_lock_hash' })
  ownerLockHash!: string
}
