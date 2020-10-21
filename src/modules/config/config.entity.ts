// @ts-nocheck
import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { IsUrl, validate } from 'class-validator'
import { DEFAULT_NODE_URL, DEFAULT_FEE_PRICE } from '../../utils'

@Entity()
export class Config {
  @PrimaryGeneratedColumn()
  id: number

  @Column('varchar', { name: 'remote_url', default: DEFAULT_NODE_URL })
  @IsUrl(
    { require_tld: false, require_protocol: true, require_host: true },
    { message: 'remote url must be an URL address' },
  )
  remoteUrl: string

  @Column('varchar', { name: 'token_pairs', default: '' })
  tokenPairs: string

  @Column('varchar', { name: 'fee_rate', default: DEFAULT_FEE_PRICE })
  feeRate: string

  @Column('varchar', { name: 'key_file', eager: false, nullable: true })
  keyFile: string | null

  @Column('varchar', { name: 'tip_block_number', default: '0x0' })
  tipBlockNumber: string

  @BeforeInsert()
  @BeforeUpdate()
  async validate() {
    const errors = await validate(this)
    if (errors.length > 0) {
      throw new Error(JSON.stringify(errors[0].constraints))
    }
  }
}
