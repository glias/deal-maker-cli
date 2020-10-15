// @ts-nocheck
import { Entity, PrimaryColumn, Column } from 'typeorm'

enum OrderType {
  Buy,
  Sell,
}

@Entity()
export class Order {
  @PrimaryColumn('varchar')
  id: string // tx_hash + output_index

  @Column('varchar', { name: 'token_pair' })
  tokenPair: string

  @Column('int8')
  type: OrderType

  @Column('bigint', { name: 'total_count' })
  totalCount: bigint

  @Column('bigint', { name: 'dealt_count' })
  dealtCount: bigint

  @Column('varchar')
  price: string
}
