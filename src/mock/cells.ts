import { Cell } from '@ckb-lumos/base'
import { encodeOrderData } from '../utils'
export const bidCell: Cell = {
  cell_output: {
    capacity: '0x12a05f2000',
    lock: {
      code_hash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
      hash_type: 'data',
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    type: {
      code_hash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
      hash_type: 'type',
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
  },
  out_point: {
    tx_hash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
    index: '0x0',
  },
  block_hash: '0xaaeee4a93a1d79ccdf50f9e2e6c688f9d935bb8c21aeaf2c09508f8070b1bd89',
  block_number: '0x13',
  data: encodeOrderData({
    sudtAmount: BigInt('50000000000'),
    orderAmount: BigInt('10000000000'),
    version: '01' as '01',
    price: {
      effect: BigInt('20000000000000000000'),
      exponent: BigInt(-9),
    },
    type: '00' as '00' | '01',
  }),
}

export const askCell: Cell = {
  cell_output: {
    capacity: '0x12a05f2000',
    lock: {
      code_hash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
      hash_type: 'data',
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
    type: {
      code_hash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
      hash_type: 'type',
      args: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
    },
  },
  out_point: {
    tx_hash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
    index: '0x1',
  },
  block_hash: '0xaaeee4a93a1d79ccdf50f9e2e6c688f9d935bb8c21aeaf2c09508f8070b1bd89',
  block_number: '0x13',
  data: encodeOrderData({
    version: '01',
    sudtAmount: BigInt('50000000000'),
    orderAmount: BigInt('100000000000'),
    price: {
      effect: BigInt('5000000000000000000'),
      exponent: BigInt(-18),
    },
    type: '01',
  }),
}
