import type { parseOrderCell } from '../utils'

type Order = ReturnType<typeof parseOrderCell>
export const askOrderWithLowerPrice: Order = {
  id: 'id_ask_low_price',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  blockNumber: 1,
  type: '01',
  price: {
    effect: BigInt('1000000000000000000'),
    exponent: BigInt(2),
  },
  orderAmount: BigInt(39_909_910_000),
  sudtAmount: BigInt(40_030_000_000),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    data: '0x00',
  },
}

export const askOrderWithHigherPrice: Order = {
  id: 'id_ask_high_price',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  blockNumber: 1,
  type: '01',
  price: {
    effect: BigInt('500000000000000000000'),
    exponent: BigInt(0),
  },
  orderAmount: BigInt(9_970_000_000),
  sudtAmount: BigInt(2_000_000_000),
  output: {
    capacity: '0x0',
    lock: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_ask',
      hash_type: 'hash_type_ask' as any,
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    data: '0x00',
  },
}

export const bidOrderWithLowerPrice: Order = {
  id: 'id_bid_low_price',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  blockNumber: 1,
  type: '00',
  price: {
    effect: BigInt('100000000000000000000'),
    exponent: BigInt(0),
  },
  orderAmount: BigInt(10_000_000_000),
  sudtAmount: BigInt(0),
  output: {
    capacity: '0x680c1fa80',
    lock: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    data: '0x00',
  },
}

export const bidOrderWithHigherPrice: Order = {
  id: 'id_bid_high_price',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  blockNumber: 1,
  type: '00',
  price: {
    effect: BigInt('500000000000000000000'),
    exponent: BigInt(0),
  },
  orderAmount: BigInt(10_000_000_000),
  sudtAmount: BigInt(1_000),
  output: {
    capacity: '0xfd8189880',
    lock: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x9c833b9ebd4259ca044d2c47c5e51b7fc25380b07291e54b248d3808f08ed7fd',
    },
    type: {
      code_hash: 'code_hash_bid',
      hash_type: 'hash_type_bid' as any,
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    data: '0x00',
  },
}

export const orderWithZeroAmount: Order = {
  id: 'id_order_with_zero_amount',
  tokenId: 'token_id_order_with_zero_amount',
  blockNumber: 2,
  type: '00',
  price: {
    effect: BigInt('1000000000000'),
    exponent: BigInt(0),
  },
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
  type: '02' as any,
  price: {
    effect: BigInt('1000000000000'),
    exponent: BigInt(0),
  },
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
