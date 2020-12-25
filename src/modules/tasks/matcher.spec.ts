import Matcher from './matcher'
import type { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import { encodeOrderData, MATCH_ORDERS_CELL_DEPS } from '../../utils'

describe('Test Match', () => {
  const PRICE = {
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

  const dealMakerCell: RawTransactionParams.Cell = {
    data: '0x',
    lock: { codeHash: '0x', hashType: 'data', args: '0x' },
    type: { codeHash: '0x', hashType: 'data', args: '0x' },
    capacity: '0x0',
    outPoint: { txHash: '0x0', index: '0x0' },
  }

  const baseScripts = {
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
  const baseBidOrder: OrderDto = {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Bid,
    price: PRICE.NINE,
    blockNumber: 55,
    output: JSON.stringify({ ...baseScripts, capacity: ``, data: `` }),
  }
  const baseAskOrder: OrderDto = {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Ask,
    price: PRICE.NINE,
    blockNumber: 55,
    output: JSON.stringify({ ...baseScripts, capacity: '', data: '' }),
  }

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Match orders', () => {
    describe('Full match', () => {
      it('1 Ask 1 Bid', () => {
        expect.assertions(5)
        const bidOrder: OrderDto = {
          ...baseBidOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90_270_000_000).toString(16)}`,
            data: encodeOrderData({
              sudtAmount: BigInt('0'),
              orderAmount: BigInt('10000000000'),
              price: PRICE.NINE,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // sudt 100.3
              orderAmount: BigInt('90000000000'), // order amount 900
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
      })

      it('2 Ask 1 Bid', () => {
        const bidOrder = {
          ...baseBidOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(220_660_000_000).toString(16)}`, // 2206.6 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // 0 sudt
              orderAmount: BigInt('22000000000'), // 220 sudt
              price: PRICE.TEN,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('12036000000'), // 120.36 sudt
              orderAmount: BigInt('120000000000'), // 1200 ckb order amount
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // 100.3 sudt
              orderAmount: BigInt('100000000000'), // 1000 ckb order amount
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }

        expect.assertions(5)
        const matcher = new Matcher([bidOrder], [askOrder_1, askOrder_2], dealMakerCell)
        matcher.match()
        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([
          120_000_000_000,
          0,
          100_000_000_000,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([0, 22_000_000_000, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(66_000_000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(660_000_000)
      })

      describe('Skip bid order whose balance is not enough for cost and fee', () => {
        const bidOrderToSkip = {
          ...baseBidOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90269999999).toString(16)}`,
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // sudt 0
              orderAmount: BigInt('10000000000'), // order amount 100
              price: PRICE.NINE,
              type: '00',
              version: '01',
            }),
          }),
        }
        it('continue the loop if the bid order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = {
            ...baseBidOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: encodeOrderData({
                sudtAmount: BigInt('0'), // sudt 0
                orderAmount: BigInt('10000000000'), // order amount 100
                price: PRICE.NINE,
                type: '00',
                version: '01',
              }),
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: encodeOrderData({
                sudtAmount: BigInt('10030000000'), // sudt 100.3
                orderAmount: BigInt('90000000000'), // order amount 900
                price: PRICE.NINE,
                type: '01',
                version: '01',
              }),
            }),
          }
          const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
        })

        it('break the loop if the bid order is a partially matched one', () => {
          expect.assertions(2)
          const bidOrder = {
            ...baseBidOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: encodeOrderData({
                sudtAmount: BigInt('0'), // sudt 0
                orderAmount: BigInt('10000000000'), // order amount 100
                price: PRICE.NINE,
                type: '00',
                version: '01',
              }),
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: encodeOrderData({
                sudtAmount: BigInt('10030000000'), // sudt 100.3
                orderAmount: BigInt('90000000000'), // order amount 900
                price: PRICE.NINE,
                type: '01',
                version: '01',
              }),
            }),
          }
          const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
          matcher.bidOrderList[0].part = true
          matcher.match()
          expect(matcher.matchedOrderList).toHaveLength(1)
          expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
        })
      })

      describe('Skip ask order whose balance is not enough for cost and fee', () => {
        const askOrderToSkip = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10029999999'), // sudt 100.29999999
              orderAmount: BigInt('90000000000'), // order amount 900
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        it('continue the loop if the ask order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = {
            ...baseBidOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: encodeOrderData({
                sudtAmount: BigInt('0'), // sudt 0
                orderAmount: BigInt('10000000000'), // order amount 100
                price: PRICE.NINE,
                type: '00',
                version: '01',
              }),
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: encodeOrderData({
                sudtAmount: BigInt(10_030_000_000), // sudt 100.3
                orderAmount: BigInt(90_000_000_000), // order amount 900
                price: PRICE.NINE,
                type: '01',
                version: '01',
              }),
            }),
          }
          const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
        })

        it('break the loop if the ask order is a partially matched one', () => {
          expect.assertions(2)
          const bidOrder = {
            ...baseBidOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: encodeOrderData({
                sudtAmount: BigInt(0), // sudt 0
                orderAmount: BigInt(10_000_000_000), // order amount 100
                price: PRICE.NINE,
                type: '00',
                version: '01',
              }),
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: PRICE.NINE,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: encodeOrderData({
                sudtAmount: BigInt(10_030_000_000), // sudt 100.3
                orderAmount: BigInt(90_000_000_000), // order amount 900
                price: PRICE.NINE,
                type: '01',
                version: '01',
              }),
            }),
          }
          const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
          matcher.askOrderList[0].part = true
          matcher.match()
          expect(matcher.matchedOrderList).toHaveLength(1)
          expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
        })
      })
    })

    describe('Partial match', () => {
      describe('Ask Order > Bid Order', () => {
        const bidOrder: OrderDto = {
          ...baseBidOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(120_360_000_000).toString(16)}`, // 1203.6 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // 0 sudt
              orderAmount: BigInt('9000000000'), // 90 sudt order amount
              price: PRICE.TEN,
              type: '00',
              version: '01',
            }),
          }),
        }
        const askOrder = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // 100.3 sudt
              orderAmount: BigInt('120000000000'), // 1200 ckb order amount
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }

        it('return correct capacity and sudt amount when no bid order left', () => {
          expect.assertions(5)
          // traded 900 ckb and 90 sudt
          const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([30_090_000_000, 90_000_000_000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9_000_000_000, 1_003_000_000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 30_000_000_000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
        })

        describe('Skip bid order whose balance is not enough for cost and fee', () => {
          const bidOrderToSkip = {
            ...baseBidOrder,
            price: PRICE.TEN,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90_269_999_999).toString(16)}`, // 902.69999999 ckb
              data: encodeOrderData({
                sudtAmount: BigInt('0'), // 0 sudt
                orderAmount: BigInt('9000000000'), // 90 sudt order amount
                price: PRICE.TEN,
                type: '00',
                version: '01',
              }),
            }),
          }

          it('continue the loop if the bid order is not a partially matched one', () => {
            expect.assertions(5)
            // traded 900 ckb and 90 sudt
            const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([30_090_000_000, 90_000_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9_000_000_000, 1_003_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 30_000_000_000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
          })

          it('break the loop if the bid order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
            matcher.bidOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
          })
        })

        describe('Skip ask order whose balance is not enough for cost and fee', () => {
          const askOrderToSkip = {
            ...baseAskOrder,
            price: PRICE.TEN,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0', // 0 ckb
              data: encodeOrderData({
                sudtAmount: BigInt('9026999999'), // 90.26999999 sudt
                orderAmount: BigInt('120000000000'), // 1200 ckb order amount
                price: {
                  effect: BigInt('1000000000000000000'),
                  exponent: BigInt(-17),
                },
                type: '01',
                version: '01',
              }),
            }),
          }

          it('continue the loop if the ask order is not a partially matched one', () => {
            expect.assertions(5)
            // traded 900 ckb and 90 sudt
            const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([30_090_000_000, 90_000_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9_000_000_000, 1_003_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 30_000_000_000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
          })

          it('break the loop if the ask order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
            matcher.askOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
          })
        })
      })

      describe('Ask Order < Bid Order', () => {
        const bidOrder: OrderDto = {
          ...baseBidOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(120_360_000_000).toString(16)}`, // 1203.6 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // 0 sudt
              orderAmount: BigInt('12000000000'), // 120 sudt order amount
              price: PRICE.TEN,
              type: '00',
              version: '01',
            }),
          }),
        }
        const askOrder = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // 100.3 sudt
              orderAmount: BigInt('90000000000'), // 900 ckb order amount
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }

        it('return correct capacity and sudt amount when no ask order left', () => {
          expect.assertions(5)
          // traded 900 ckb and 90 sudt
          const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([90_000_000_000, 30_090_000_000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1_003_000_000, 9_000_000_000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 3_000_000_000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
        })

        describe('Skip bid order whose balance is not enough for cost and fee', () => {
          const bidOrderToSkip = {
            ...baseBidOrder,
            price: PRICE.TEN,
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90_269_999_999).toString(16)}`, // 902.69999999 ckb
              data: encodeOrderData({
                sudtAmount: BigInt('0'), // 0 sudt
                orderAmount: BigInt('12000000000'), // 120 sudt order amount
                price: PRICE.TEN,
                type: '00',
                version: '01',
              }),
            }),
          }

          it('continue the loop if the bid order is not a partially matched one', () => {
            expect.assertions(5)
            // traded 900 ckb and 90 sudt
            const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([90_000_000_000, 30_090_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1_003_000_000, 9_000_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 3_000_000_000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
          })

          it('break the loop if the bid order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher([bidOrderToSkip, bidOrder], [askOrder], dealMakerCell)
            matcher.bidOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
          })
        })
        describe('Skip ask order whose balance is not enough for cost and fee', () => {
          const askOrderToSkip = {
            ...baseAskOrder,
            price: PRICE.TEN,
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0', // 0 ckb
              data: encodeOrderData({
                sudtAmount: BigInt('9026999999'), // 90.26999999 sudt
                orderAmount: BigInt('90000000000'), // 900 ckb order amount
                price: PRICE.TEN,
                type: '01',
                version: '01',
              }),
            }),
          }

          it('continue the loop if the ask order is not a partially matched one', () => {
            expect.assertions(5)
            // traded 900 ckb and 90 sudt
            const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([90_000_000_000, 30_090_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1_003_000_000, 9_000_000_000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 3_000_000_000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(27_000_000)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(270_000_000)
          })

          it('break the loop if the ask order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher([bidOrder], [askOrderToSkip, askOrder], dealMakerCell)
            matcher.askOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
          })
        })
      })

      describe('2 Ask Order < 1 Bid Order', () => {
        const bidOrder = {
          ...baseBidOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(230_660_000_000).toString(16)}`, // 2306.6 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // 0 sudt
              orderAmount: BigInt('23000000000'), // 230 sudt order amount
              price: PRICE.TEN,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('12036000000'), // 120.36 sudt
              orderAmount: BigInt('108000000000'), // 1080 ckb order amount
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: PRICE.NINE_DOT_FIVE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // 100.3 sudt
              orderAmount: BigInt('95000000000'), // 950 ckb order amount
              price: PRICE.NINE_DOT_FIVE,
              type: '01',
              version: '01',
            }),
          }),
        }

        it('return correct capacity and sudt amount', () => {
          expect.assertions(5)
          const matcher = new Matcher([bidOrder], [askOrder_1, askOrder_2], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([
            107999999994,
            94999999965,
            27051000043,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([
            633473685,
            257179491,
            21112010792,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([6, 35, 1887989208])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(63336032)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(608999998)
        })
      })

      describe('2 Ask Order > 1 Bid Order', () => {
        const bidOrder = {
          ...baseBidOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(230690000000).toString(16)}`, // 2306.9 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // 0 sudt
              orderAmount: BigInt('23000000000'), // 230 sudt order amount / 2300 ckb
              price: PRICE.TEN,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('12036000000'), // 120.36 sudt
              orderAmount: BigInt('120000000000'), // 1200 ckb order amount / 120 sudt
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: PRICE.TEN,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: encodeOrderData({
              sudtAmount: BigInt('12036000000'), // 120.36 sudt
              orderAmount: BigInt('120000000000'), // 1200 ckb order amount / 120 sudt
              price: PRICE.TEN,
              type: '01',
              version: '01',
            }),
          }),
        }

        it('return correct capacity and sudt amount', () => {
          expect.assertions(5)
          const matcher = new Matcher([bidOrder], [askOrder_1, askOrder_2], dealMakerCell)
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([120000000000, 0, 110000000000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([0, 23000000000, 1003000000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 10000000000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(69000000)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(690000000)
        })
      })
    })

    describe("Ask price is greater than bid price, can't match", () => {
      const askOrder_7 = {
        ...baseAskOrder,
        price: PRICE.ELEVEN,
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
          data: encodeOrderData({
            sudtAmount: BigInt('10030000000'),
            orderAmount: BigInt('110000000000'),
            price: PRICE.ELEVEN,
            type: '01',
            version: '01',
          }),
        }),
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

    describe('Handle order whose balance is not enough', () => {
      const bidOrder = {
        ...baseBidOrder,
        output: JSON.stringify({
          ...baseScripts,
          capacity: `0x${(230660000000).toString(16)}`, // 2306.6 ckb
          data: encodeOrderData({
            sudtAmount: BigInt('0'), // 0 sudt
            orderAmount: BigInt('23000000000'), // 230 sudt order amount / 2300 ckb
            price: {
              effect: BigInt('1000000000000000000'),
              exponent: BigInt(-17),
            },
            type: '00',
            version: '01',
          }),
        }),
      }

      const askOrder_1 = {
        ...baseAskOrder,
        output: JSON.stringify({
          ...baseScripts,
          capacity: '0x0', // 0 ckb
          data: encodeOrderData({
            sudtAmount: BigInt('12036000000'), // 120.36 sudt
            orderAmount: BigInt('120000000000'), // 1200 ckb order amount / 120 sudt
            price: {
              effect: BigInt('1000000000000000000'),
              exponent: BigInt(-17),
            },
            type: '01',
            version: '01',
          }),
        }),
      }
      const askOrder_2 = {
        ...baseAskOrder,
        output: JSON.stringify({
          ...baseScripts,
          capacity: '0x0', // 0 ckb
          data: encodeOrderData({
            sudtAmount: BigInt('12036000000'), // 120.36 sudt
            orderAmount: BigInt('120000000000'), // 1200 ckb order amount / 120 sudt
            price: {
              effect: BigInt('1000000000000000000'),
              exponent: BigInt(-17),
            },
            type: '01',
            version: '01',
          }),
        }),
      }

      it('skip unmeeting order', () => {
        expect.assertions(5)
        const matcher = new Matcher([bidOrder], [askOrder_1, askOrder_2], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([120000000000, 110300000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([0, 12000000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 11000000000])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(36000000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(360000000)
      })
    })

    describe('Skip ask order whose order amount is 0', () => {
      it('Skip 1st ask order', () => {
        expect.assertions(5)
        const bidOrder = {
          ...baseBidOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)}`,
            data: encodeOrderData({
              sudtAmount: BigInt(0), // sudt 0
              orderAmount: BigInt('10000000000'), // order amount 100
              price: PRICE.NINE,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // sudt 100.3
              orderAmount: BigInt('0'), // order amount 0
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // sudt 100.3
              orderAmount: BigInt('90000000000'), // order amount 900
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        const matcher = new Matcher([bidOrder], [askOrder_1, askOrder_2], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
      })
    })

    describe('Skip bid order whose order amount is 0', () => {
      it('Skip 1st bid order', () => {
        expect.assertions(5)
        const bidOrder_1 = {
          ...baseBidOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)} `,
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // sudt 0
              orderAmount: BigInt('0'), // order amount 0
              price: PRICE.NINE,
              type: '00',
              version: '01',
            }),
          }),
        }

        const bidOrder_2 = {
          ...baseBidOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)} `,
            data: encodeOrderData({
              sudtAmount: BigInt('0'), // sudt 0
              orderAmount: BigInt('10000000000'), // order amount 100
              price: PRICE.NINE,
              type: '00',
              version: '01',
            }),
          }),
        }

        const askOrder = {
          ...baseAskOrder,
          price: PRICE.NINE,
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: encodeOrderData({
              sudtAmount: BigInt('10030000000'), // sudt 100.3
              orderAmount: BigInt('90000000000'), // order amount 900
              price: PRICE.NINE,
              type: '01',
              version: '01',
            }),
          }),
        }
        const matcher = new Matcher([bidOrder_1, bidOrder_2], [askOrder], dealMakerCell)
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity))).toEqual([0, 90000000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([10000000000, 0])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(30000000)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(270000000)
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
            sudtAmount: BigInt('10000000000'),
            orderAmount: BigInt('0'),
            price: PRICE.NINE,
            capacity: BigInt('0'),
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
            sudtAmount: BigInt('0'),
            orderAmount: BigInt('0'),
            price: PRICE.NINE,
            capacity: BigInt('90000000000'),
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
            capacity: '0x5e844a0',
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
          '0x00e40b54020000000000000000000000010000000000000000000000000000000009000000000000000000',
          '0x00000000000000000000000000000000010000000000000000000000000000000009000000000000000001',
        ],
      })
    })
  })
})
