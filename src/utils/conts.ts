import 'dotenv/config'
export const DEFAULT_NODE_URL = process.env.NODE_URL
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
export const SHANNONS_RATIO = 10 ** 8
export const ORDER_CELL_SIZE = 181 // 179 bytes base + 1 byte for version + 1 byte for price exponent
export const SUDT_CELL_SIZE = 154
export const PRICE_RATIO = BigInt(`1${'0'.repeat(128)}`)
export const ORDER_DATA_LENGTH = 88

export const ORDER_SCRIPTS: any = {
  lock: {
    args: '0x',
    code_hash: process.env.ORDERBOOK_LOCK_SCRIPT_CODE_HASH!,
    hash_type: 'type',
  },
  type: {
    args: '0x',
    code_hash: process.env.ORDERBOOK_TYPE_SCRIPT_CODE_HASH!,
    hash_type: process.env.ORDERBOOK_TYPE_SCRIPT_HASH_TYPE!,
  },
}

export const MATCH_ORDERS_CELL_DEPS = [
  {
    outPoint: {
      txHash: SUDT_TX_HASH,
      index: '0x0',
    },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: { txHash: ORDERBOOK_TX_HASH, index: '0x0' },
    depType: 'code' as CKBComponents.DepType,
  },
  {
    outPoint: { txHash: SECP256K1_TX_HASH, index: '0x0' },
    depType: 'depGroup' as CKBComponents.DepType,
  },
]
