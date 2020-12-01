import Matcher from './matcher'
import type { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import { formatOrderData, MATCH_ORDERS_CELL_DEPS } from '../../utils'

// TODO: fix test cases
describe.skip('Test Match', () => {
  const dealMakerCell: RawTransactionParams.Cell = {
    data: '',
    lock: { codeHash: '0x', hashType: 'data', args: '0x' },
    type: { codeHash: '0x', hashType: 'data', args: '0x' },
    capacity: '0x0',
    outPoint: { txHash: '0x0', index: '0x0' },
  }
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Match orders', () => {
    const baseBidOrder: OrderDto = {
      id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
      tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
      type: OrderType.Bid,
      price: BigInt(90_000_000_000), // 9
      blockNumber: 55,
      output: JSON.stringify({
        capacity: `0x${(90270000000).toString(16)}`,
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
        data: `${formatOrderData(
          BigInt(0), // sudt 0
          BigInt(10_000_000_000), // order amount 100
          BigInt(90_000_000_000), // price amount 9
          '00',
        )}`,
      }),
    }
    const baseAskOrder: OrderDto = {
      id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
      tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
      type: OrderType.Ask,
      price: BigInt(90_000_000_000), // 9
      blockNumber: 55,
      output: JSON.stringify({
        capacity: '0x0',
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
        data: `${formatOrderData(
          BigInt(10_030_000_000), // sudt 100.3
          BigInt(90_000_000_000), // order amount 900
          BigInt(90_000_000_000), // 9
          '01',
        )}`,
      }),
    }

    describe('Full match, One ask order One bid order', () => {
      it('return correct capacity and sudt amount', () => {
        expect.assertions(5)
        const matcher = new Matcher([baseBidOrder], [baseAskOrder], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
      })
    })

    describe('Part match, One ask order One bid order, left bid order', () => {
      it('return correct capacity and sudt amount when no ask order left', () => {
        expect.assertions(5)
        const bidOrder: OrderDto = {
          ...baseBidOrder,
          price: BigInt(10 * 10 ** 10), // 10
          output: JSON.stringify({
            capacity: `0x${(120360000000).toString(16)}`,
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
            data: `${formatOrderData(BigInt(0), BigInt(120 * 10 ** 8), BigInt(100_000_000_000), '00')}`,
          }),
        }
        const matcher = new Matcher([bidOrder], [baseAskOrder], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([90000000000, 30090000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([527894738, 9473684210])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 2526315790])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(28421052)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
      })

      it('return correct capacity and sudt amount when left ask order have cant match', () => {
        expect.assertions(5)
        const askOrder = {
          ...baseAskOrder,
          price: BigInt(11 * 10 ** 10),
          output: JSON.stringify({
            capacity: '0x0',
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
            data: `${formatOrderData(
              BigInt(10030000000), // sudt 100.3
              BigInt(110000000000), // order amount 1100
              BigInt(110000000000), // price 11
              '01',
            )}`,
          }),
        }
        const bidOrder = {
          ...baseBidOrder,
          price: BigInt(10 * 10 ** 10),
          output: `{"capacity":"0x${(1203.6 * 10 * 10 ** 7).toString(
            16,
          )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
            BigInt(0),
            BigInt(120 * 10 ** 8),
            BigInt(100_000_000_000),
            '00',
          )}"}`,
        }

        const matcher = new Matcher([bidOrder], [baseAskOrder, askOrder], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([90000000000, 30090000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([527894738, 9473684210])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 2526315790])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(28421052)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
      })
    })

    describe('Part match, One ask order One bid order, left ask order', () => {
      const bidOrder_3 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(501.5 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(50 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }
      const bidOrder_3_1 = {
        ...baseBidOrder,
        price: BigInt(8 * 10 ** 10),
        output: `{"capacity":"0x${(1002.4 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(100 * 10 ** 8),
          BigInt(80_000_000_000),
          '00',
        )}"}`,
      }

      it('return correct capacity and sudt amount when no bid order left', () => {
        expect.assertions(5)
        const askOrder_3 = {
          ...baseAskOrder,
          output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
            BigInt(13_039_000_000),
            BigInt(1170 * 10 ** 8),
            BigInt(90_000_000_000),
            '00',
          )}"}`,
        }
        const matcher = new Matcher([bidOrder_3], [askOrder_3], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([2_507_500_000, 47_500_000_000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([5_000_000_000, 8_024_000_000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 69_500_000_000])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(15_000_000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(142_500_000)
      })

      it('return correct capacity and sudt amount when have bid order left but cant match', () => {
        expect.assertions(5)
        const askOrder_3 = {
          ...baseAskOrder,
          output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
            BigInt(13_039_000_000),
            BigInt(1170 * 10 ** 8),
            BigInt(90_000_000_000),
            '00',
          )}"}`,
        }
        const matcher = new Matcher([bidOrder_3, bidOrder_3_1], [askOrder_3], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([2_507_500_000, 47_500_000_000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([5_000_000_000, 8_024_000_000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 69_500_000_000])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(15_000_000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(142_500_000)
      })
    })

    describe('Full match, One bid order Multiple ask order, no order left', () => {
      const bidOrder_4_1 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(2206.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(220 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_4_1 = {
        ...baseAskOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(12_036_000_000),
          BigInt(1200 * 10 ** 8),
          BigInt(100_000_000_000),
          '01',
        )}"}`,
      }
      const askOrder_4_2 = {
        ...baseAskOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(1000 * 10 ** 8),
          BigInt(100_000_000_000),
          '01',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        expect.assertions(5)
        const matcher = new Matcher([bidOrder_4_1], [askOrder_4_1, askOrder_4_2], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([1200 * 10 ** 8, 0, 100_000_000_000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([0, 220 * 10 ** 8, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(66_000_000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(660_000_000)
      })
    })

    describe('Partly match, One bid order Multiple ask order, left bid order', () => {
      const bidOrder_5_1 = {
        ...baseBidOrder,
        price: BigInt(100_000_000_000),
        output: JSON.stringify({
          capacity: `0x${(230_660_000_000).toString(16)}`,
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
          data: formatOrderData(BigInt(0), BigInt(23_000_000_000), BigInt(100_000_000_000), '00'),
        }),
      }

      const askOrder_5_1 = {
        ...baseAskOrder,
        price: BigInt(90_000_000_000),
        output: JSON.stringify({
          capacity: '0x0',
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
          data: formatOrderData(BigInt(12_036_000_000), BigInt(108_000_000_000), BigInt(90_000_000_000), '01'),
        }),
      }
      const askOrder_5_2 = {
        ...baseAskOrder,
        price: BigInt(95_000_000_000),
        output: JSON.stringify({
          capacity: '0x0',
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
          data: formatOrderData(BigInt(10_030_000_000), BigInt(95_000_000_000), BigInt(95_000_000_000), '01'),
        }),
      }

      it('return correct capacity and sudt amount', () => {
        expect.assertions(5)
        const matcher = new Matcher([bidOrder_5_1], [askOrder_5_1, askOrder_5_2], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([
          108_000_000_000,
          95_000_000_000,
          27_051_000_000,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([
          633_473_685,
          257_179_488,
          21_112_010_795,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 1887989205])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(63336032)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(609000000)
      })
    })

    describe('Partly match, One bid order Multiple ask order, left ask order', () => {
      const bidOrder_6_1 = {
        ...baseBidOrder,
        price: BigInt(10 * 10 ** 10),
        output: `{"capacity":"0x${(2206.6 * 10 * 10 ** 7).toString(
          16,
        )}","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(0),
          BigInt(220 * 10 ** 8),
          BigInt(100_000_000_000),
          '00',
        )}"}`,
      }

      const askOrder_6_1 = {
        ...baseAskOrder,
        price: BigInt(9 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(12_036_000_000),
          BigInt(1080 * 10 ** 8),
          BigInt(90_000_000_000),
          '01',
        )}"}`,
      }
      const askOrder_6_2 = {
        ...baseAskOrder,
        price: BigInt(95 * 10 ** 9),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(13_039_000_000),
          BigInt(1235 * 10 ** 8),
          BigInt(95_000_000_000),
          '01',
        )}"}`,
      }

      it('return correct capacity and sudt amount', () => {
        expect.assertions(5)
        const matcher = new Matcher([bidOrder_6_1], [askOrder_6_1, askOrder_6_2], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([
          1080 * 10 ** 8,
          8367131573,
          103657894743,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([
          633473685,
          220 * 10 ** 8,
          2375526316,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 19842105257])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(65999999)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(634973684)
      })
    })

    describe("Ask price is greater than bid price, can't match", () => {
      const askOrder_7 = {
        ...baseAskOrder,
        price: BigInt(11 * 10 ** 10),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(1100 * 10 ** 8),
          BigInt(110_000_000_000),
          '01',
        )}"}`,
      }

      it('returns empty array', () => {
        expect.assertions(3)
        const matcher = new Matcher([baseBidOrder], [askOrder_7], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList).toHaveLength(0)

        expect(Number(matcher.dealMakerSudtAmount)).toBe(0)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(0)
      })
    })
  })

  describe('Transaction', () => {
    it('should return null is no matched orders', () => {
      const matcher = new Matcher([], [], dealMakerCell)
      expect(matcher.rawTx).toBeNull()
    })
    it('should return tx when orders matched', () => {
      const matcher = new Matcher([], [], dealMakerCell)
      matcher.dealMakerCell = dealMakerCell
      matcher.matchedOrderList = [
        {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
          scripts: {
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            },
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          info: {
            sudtAmount: BigInt(10000000000),
            orderAmount: BigInt(0),
            price: BigInt(90000000000),
            capacity: BigInt(0),
            type: OrderType.Bid,
          },
        },
        {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
          scripts: {
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0xffffffffffffffffffffffffffffffffffffffff',
            },
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          info: {
            sudtAmount: BigInt(0),
            orderAmount: BigInt(0),
            price: BigInt(90000000000),
            capacity: BigInt(90000000000),
            type: OrderType.Ask,
          },
        },
      ]
      matcher.dealMakerCapacityAmount = BigInt(100000000)
      expect(matcher.rawTx).toEqual({
        version: '0x0',
        headerDeps: [],
        cellDeps: MATCH_ORDERS_CELL_DEPS,
        inputs: [
          { previousOutput: { txHash: '0x0', index: '0x0' }, since: '0x0' },
          {
            previousOutput: {
              txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
              index: '0x0',
            },
            since: '0x0',
          },
          {
            previousOutput: {
              txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
              index: '0x2',
            },
            since: '0x0',
          },
        ],
        witnesses: [{ lock: '', inputType: '', outputType: '' }, '0x', '0x'],
        outputs: [
          {
            capacity: '0x5e85440',
            lock: { codeHash: '0x', hashType: 'data', args: '0x' },
            type: { codeHash: '0x', hashType: 'data', args: '0x' },
          },
          {
            capacity: '0x0',
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            },
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          {
            capacity: '0x14f46b0400',
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0xffffffffffffffffffffffffffffffffffffffff',
            },
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
        ],
        outputsData: [
          '0x00000000000000000000000000000000',
          '0x00e40b540200000000000000000000000000000000000000000000000000000000046bf41400000000',
          '0x000000000000000000000000000000000000000000000000000000000000000000046bf41400000001',
        ],
      })
    })
  })
})
