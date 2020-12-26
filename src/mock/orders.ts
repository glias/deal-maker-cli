import type { OrderDto } from '../modules/orders/order.dto'
import { OrderType } from '../modules/orders/order.entity'

export const PRICE = {
  NINE: {
    effect: BigInt('900000000000000000'),
    exponent: BigInt(-17),
  },
  NINE_DOT_FIVE: {
    effect: BigInt('950000000000000000'),
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
}

export const BASE_ASK_ORDER: OrderDto = {
  id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
  tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
  type: OrderType.Ask,
  price: PRICE.NINE,
  blockNumber: 55,
  output: JSON.stringify({ ...BASE_SCRIPTS, capacity: '', data: '' }),
}
