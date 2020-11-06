import 'dotenv/config'
export const DEFAULT_NODE_URL = 'http://localhost:8114'
export const DEFAULT_FEE_PRICE = '1000'
export const INDEXER_DB = 'indexer-data'
export const SUDT_TYPE_ARGS_LIST = process.env.SUDT_TYPE_ARGS_LIST?.split(',') ?? []
export const UI_SUDT_TYPE_ARGS = SUDT_TYPE_ARGS_LIST[0] ?? ''
export const SECP256K1_CODE_HASH = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'
export const SUDT_TX_HASH = process.env.SUDT_TX_HASH!
export const SECP256K1_TX_HASH = process.env.SECP256K1_TX_HASH!
export const ORDERBOOK_TX_HASH = process.env.ORDERBOOK_TX_HASH!
export const WEB_UI_PORT = process.env.WEB_UI_PORT
export const FEE = BigInt(3)
export const FEE_RATIO = BigInt(1_000)
export const SHANNONS_RATIO = BigInt(10 ** 8)
export const PRICE_RATIO = BigInt(10 ** 10)

export const ORDER_SCRIPTS: any = {
  lock: {
    args: '0x',
    code_hash: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    hash_type: 'type',
  },
  type: {
    args: '0x',
    code_hash: process.env.ORDERBOOK_TYPE_SCRIPT_CODE_HASH!,
    hash_type: 'type',
  },
}
