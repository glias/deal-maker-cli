import type { parseOrderCell } from '../utils'
import { ORDER_SCRIPTS } from '../utils'

type Order = ReturnType<typeof parseOrderCell>
export const askOrderWithLowerPrice: Order = {
  id: 'id_ask_low_price',
  tokenId: 'token_id_ask',
  blockNumber: 1,
  type: '01',
  price: BigInt(321) * BigInt(2 ** 55),
  orderAmount: BigInt(400_000_000_000),
  sudtAmount: BigInt(1_000),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    data: '0x00',
  },
}

export const askOrderWithHigherPrice: Order = {
  id: 'id_ask_high_price',
  tokenId: 'token_id_ask',
  blockNumber: 1,
  type: '01',
  price: BigInt(100) * BigInt(2 ** 56),
  orderAmount: BigInt(100),
  sudtAmount: BigInt(1_000),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: { code_hash: 'code_hash_ask', hash_type: 'hash_type_ask' as any, args: 'args_ask' },
    data: '0x00',
  },
}

export const bidOrderWithLowerPrice: Order = {
  id: 'id_bid_low_price',
  tokenId: 'token_id_bid',
  blockNumber: 1,
  type: '00',
  price: BigInt(321) * BigInt(2 ** 54),
  orderAmount: BigInt(100),
  sudtAmount: BigInt(1_000),
  output: {
    capacity: '0x1f5900000000000001',
    lock: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    data: '0x00',
  },
}

export const bidOrderWithHigherPrice: Order = {
  id: 'id_bid_high_price',
  tokenId: 'token_id_bid',
  blockNumber: 1,
  type: '00',
  price: BigInt(100) * BigInt(2 ** 60),
  orderAmount: BigInt(100),
  sudtAmount: BigInt(1_000),
  output: {
    capacity: '0x2710000000000000001',
    lock: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    data: '0x00',
  },
}

export const orderWithZeroAmount: Order = {
  id: 'id_order_with_zero_amount',
  tokenId: 'token_id_order_with_zero_amount',
  blockNumber: 2,
  type: '00',
  price: BigInt(100),
  orderAmount: BigInt(0),
  sudtAmount: BigInt('1000'),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: 'args_order_with_zero_amount',
    },
    data: '0x00',
  },
}

export const orderWithWrongType: Order = {
  id: 'id_order_with_zero_amount',
  tokenId: 'token_id_order_with_zero_amount',
  blockNumber: 2,
  type: '02',
  price: BigInt(100),
  orderAmount: BigInt('1000'),
  sudtAmount: BigInt('1000'),
  output: {
    capacity: '0x',
    lock: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: 'args_order_with_zero_amount',
    },
    data: '0x00',
  },
}

export const orderWithAskButSudtAmountZero: Order = {
  id: 'id_order_with_zero_amount',
  tokenId: 'token_id_order_with_zero_amount',
  blockNumber: 2,
  type: '01',
  price: BigInt(100),
  orderAmount: BigInt('1000'),
  sudtAmount: BigInt('0'),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_order_with_zero_amount',
      hash_type: 'hash_type_order_with_zero_amount' as any,
      args: 'args_order_with_zero_amount',
    },
    data: '0x00',
  },
}
