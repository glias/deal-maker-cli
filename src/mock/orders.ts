import type { parseOrderCell } from '../utils'

type Order = ReturnType<typeof parseOrderCell>
export const askOrderWithLowerPrice: Order = {
  id: 'id_ask_low_price',
  tokenId: 'token_id_ask',
  blockNumber: 1,
  type: '01',
  price: BigInt(123),
  output: {
    capacity: 'capacity_ask',
    lock: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    data: '0x00',
  },
}

export const askOrderWithHigherPrice: Order = {
  id: 'id_ask_high_price',
  tokenId: 'token_id_ask',
  blockNumber: 1,
  type: '01',
  price: BigInt(321),
  output: {
    capacity: 'capacity_ask',
    lock: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    data: '0x00',
  },
}

export const bidOrderWithLowerPrice: Order = {
  id: 'id_bid_low_price',
  tokenId: 'token_id_bid',
  blockNumber: 1,
  type: '00',
  price: BigInt(123),
  output: {
    capacity: 'capacity_bid',
    lock: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    data: '0x00',
  },
}

export const bidOrderWithHigherPrice: Order = {
  id: 'id_bid_high_price',
  tokenId: 'token_id_bid',
  blockNumber: 1,
  type: '00',
  price: BigInt(321),
  output: {
    capacity: 'capacity_bid',
    lock: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    data: '0x00',
  },
}
