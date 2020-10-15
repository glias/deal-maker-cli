// @ts-nocheck
import { Entity, PrimaryColumn, Column } from 'typeorm'

enum LiquidityType {
  Provide,
  Retrieve,
}

@Entity()
export class Liquidity {
  @PrimaryColumn()
  id: string // tx_hash + index

  @Column('varchar', { name: 'token_pair' })
  tokenPair: string

  @Column('int8')
  type: LiquidityType

  @Column('varchar')
  price: string

  @Column('bigint')
  count: bigint
}
