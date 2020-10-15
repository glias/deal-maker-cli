// @ts-nocheck
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Config {
  @PrimaryGeneratedColumn()
  id: string

  @Column('varchar', { name: 'remote_url', default: 'http://localhost:8114' })
  remoteUrl

  @Column('varchar', { name: 'token_pairs', default: '' })
  tokenPairs: string

  @Column('varchar', { name: 'fee_rate', default: '1000' })
  feeRate: string

  @Column('varchar', { name: 'key_file', eager: false, nullable: true })
  keyFile: string | null
}
