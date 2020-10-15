// @ts-nocheck
import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity()
export class Info {
  @PrimaryColumn('varchar', { name: 'token_pair' })
  tokenPair: string

  @Column('text')
  cell: string
}
