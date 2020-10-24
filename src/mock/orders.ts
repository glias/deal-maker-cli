import type { parseOrderCell } from '../utils'
import { OrderDto } from '../modules/orders/order.dto'
import { OrderType } from '../modules/orders/order.entity'

type Order = ReturnType<typeof parseOrderCell>
export const askOrderWithLowerPrice: Order = {
  id: 'id_ask_low_price',
  tokenId: 'token_id_ask',
  blockNumber: 1,
  type: '01',
  price: BigInt(321) * BigInt(2 ** 55),
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
  price: BigInt(100) * BigInt(2 ** 56),
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
  price: BigInt(321) * BigInt(2 ** 54),
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
  price: BigInt(100) * BigInt(2 ** 60),
  output: {
    capacity: 'capacity_bid',
    lock: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    type: { code_hash: 'code_hash_bid', hash_type: 'hash_type_bid' as any, args: 'args_bid' },
    data: '0x00',
  },
}

export const bidOrderList1: Array<OrderDto> = [
  {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Bid,
    price: BigInt('100000000000'),
    blockNumber: 2,
    output:
      '{"capacity":"0x2e90edd000","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"0x32000000000000000000000000000000640000000000000000000000000000000a0000000000000000"}',
  },
]

export const bidOrderList2: Array<OrderDto> = [
  {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Bid,
    price: BigInt('100000000000'),
    blockNumber: 2,
    output:
      '{"capacity":"0x174876e800","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"0x320000000000000000000000000000003200000000000000000000000000000000e876481700000000"}',
  },
]

export const bidOrderList3: Array<OrderDto> = [
  {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Bid,
    price: BigInt('110000000000'),
    blockNumber: 1,
    output:
      '{"capacity":"0x174876e800","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"0x32000000000000000000000000000000320000000000000000000000000000000b0000000000000000"}',
  },
  {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Bid,
    price: BigInt('100000000000'),
    blockNumber: 2,
    output:
      '{"capacity":"0x174876e800","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"0x320000000000000000000000000000003200000000000000000000000000000000e876481700000000"}',
  },
]

export const askOrderList1: Array<OrderDto> = [
  {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Ask,
    price: BigInt('100000000000'),
    blockNumber: 1,
    output:
      '{"capacity":"0x2540be400","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"0xc8000000000000000000000000000000e803000000000000000000000000000000e876481700000001"}',
  },
]
