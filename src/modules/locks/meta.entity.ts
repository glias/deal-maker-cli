import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class LockSyncMeta {
  @PrimaryGeneratedColumn()
  id!: number

  @Column('varchar', { name: 'block_number' })
  blockNumber!: string
}
