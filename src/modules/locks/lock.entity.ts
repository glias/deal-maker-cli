import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity()
export class Lock {
  @PrimaryColumn('varchar', { name: 'lock_hash' })
  lockHash!: string

  @Column('varchar', { name: 'code_hash' })
  codeHash!: string

  @Column('varchar', { name: 'hash_type' })
  hashType!: CKBComponents.ScriptHashType

  @Column('varchar')
  args!: string
}
