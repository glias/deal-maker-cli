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

  @Column('varchar', { name: 'order_ids' })
  orderIds!: string

  @Column('varchar')
  fee!: string

  @Column('int8')
  status!: DealStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
