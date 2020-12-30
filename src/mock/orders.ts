import type { parseOrderCell } from '../utils'
import type { OrderDto } from '../modules/orders/order.dto'
import { OrderType } from '../modules/orders/order.entity'

export const PRICE = {
  ONE: {
    effect: BigInt('1000000000000000000'),
    exponent: BigInt(-18),
  },
  FIVE: {
    effect: BigInt('500000000000000000'),
    exponent: BigInt(-17),
  },
  EIGHT: {
    effect: BigInt('800000000000000000'),
    exponent: BigInt(-17),
  },
  NINE: {
    effect: BigInt('900000000000000000'),
    exponent: BigInt(-17),
  },
  TEN: {
    effect: BigInt('1000000000000000000'),
    exponent: BigInt(-17),
  },
  ELEVEN: {
    effect: BigInt('1100000000000000000'),
    exponent: BigInt(-17),
  },
}

export const BASE_SCRIPTS = {
  lock: {
    code_hash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
    hash_type: 'data',
    args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
  },
  type: {
    code_hash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
    hash_type: 'type',
    args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
  },
}

export const BASE_BID_ORDER: OrderDto = {
  id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
  tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
  type: OrderType.Bid,
  price: PRICE.NINE,
  blockNumber: 55,
  output: JSON.stringify({ ...BASE_SCRIPTS, capacity: ``, data: `` }),
  ownerLockHash: '',
}

export const BASE_ASK_ORDER: OrderDto = {
  id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
  tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
  type: OrderType.Ask,
  price: PRICE.NINE,
  blockNumber: 55,
  output: JSON.stringify({ ...BASE_SCRIPTS, capacity: '', data: '' }),
  ownerLockHash: '',
}

// REFACTOR
type Order = ReturnType<typeof parseOrderCell>
export const askOrderWithLowerPrice: Order = {
  id: 'id_ask_low_price',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  blockNumber: 1,
  type: '01',
  price: PRICE.ONE,
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
  price: PRICE.FIVE,
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
  price: PRICE.ONE,
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
  price: PRICE.FIVE,
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
  price: PRICE.TEN,
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
  price: PRICE.TEN,
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
  price: PRICE.TEN,
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
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    data: '0x00',
  },
}
