import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm'

export enum DealStatus {
  Pending,
  Done,
  Failed,
  TIMEOUT,
}

@Entity()
export class Deal {
  @PrimaryColumn('varchar', { name: 'tx_hash' })
  txHash!: string

  @Column('varchar', { name: 'token_id' })
  tokenId!: string

  @Column('varchar', { name: 'order_ids' })
  orderIds!: string

  @Column('varchar', { name: 'deal_maker_cell' })
  dealMakerCell!: string // txHash:index

  @Column('varchar', { name: 'ckb_profit' })
  ckbProfit!: string

  @Column('varchar', { name: 'sudt_profit' })
  sudtProfit!: string

  @Column('varchar')
  fee!: string

  @Column('int8')
  status!: DealStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
