import Matcher from './matcher'
import type { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import { formatOrderData, MATCH_ORDERS_CELL_DEPS } from '../../utils'

// TODO: fix test cases
describe('Test Match', () => {
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
    price: BigInt(900_000_000_000_000_000_000), // 9
    blockNumber: 55,
    output: JSON.stringify({ ...baseScripts, capacity: ``, data: `` }),
  }
  const baseAskOrder: OrderDto = {
    id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
    tokenId: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
    type: OrderType.Ask,
    price: BigInt(900_000_000_000_000_000_000), // 9
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
        const bidOrder = {
          ...baseBidOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)}`,
            data: `${formatOrderData(
              BigInt(0), // sudt 0
              BigInt(10_000_000_000), // order amount 100
              BigInt(900_000_000_000_000_000_000), // price amount 9
              '00',
            )}`,
          }),
        }

        const askOrder = {
          ...baseAskOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_030_000_000), // sudt 100.3
              BigInt(90_000_000_000), // order amount 900
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            )}`,
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
          price: BigInt(1_000_000_000_000_000_000_000), // 10 price
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(220_660_000_000).toString(16)}`, // 2206.6 ckb
            data: `${formatOrderData(
              BigInt(0), // 0 sudt
              BigInt(22_000_000_000), // 220 sudt
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '00',
            )} `,
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10 price
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(12_036_000_000), // 120.36 sudt
              BigInt(120_000_000_000), // 1200 ckb order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '01',
            )}`,
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10 price
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_030_000_000), // 100.3 sudt
              BigInt(100_000_000_000), // 1000 ckb order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '01',
            )}`,
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
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90269999999).toString(16)}`,
            data: `${formatOrderData(
              BigInt(0), // sudt 0
              BigInt(10_000_000_000), // order amount 100
              BigInt(900_000_000_000_000_000_000), // price amount 9
              '00',
            )}`,
          }),
        }
        it('continue the loop if the bid order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = {
            ...baseBidOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: `${formatOrderData(
                BigInt(0), // sudt 0
                BigInt(10_000_000_000), // order amount 100
                BigInt(900_000_000_000_000_000_000), // price amount 9
                '00',
              )}`,
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: `${formatOrderData(
                BigInt(10_030_000_000), // sudt 100.3
                BigInt(90_000_000_000), // order amount 900
                BigInt(900_000_000_000_000_000_000), // 9
                '01',
              )}`,
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
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: `${formatOrderData(
                BigInt(0), // sudt 0
                BigInt(10_000_000_000), // order amount 100
                BigInt(900_000_000_000_000_000_000), // price amount 9
                '00',
              )}`,
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: `${formatOrderData(
                BigInt(10_030_000_000), // sudt 100.3
                BigInt(90_000_000_000), // order amount 900
                BigInt(900_000_000_000_000_000_000), // 9
                '01',
              )}`,
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
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_029_999_999), // sudt 100.29999999
              BigInt(90_000_000_000), // order amount 900
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            )}`,
          }),
        }
        it('continue the loop if the ask order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = {
            ...baseBidOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: `${formatOrderData(
                BigInt(0), // sudt 0
                BigInt(10_000_000_000), // order amount 100
                BigInt(900_000_000_000_000_000_000), // price amount 9
                '00',
              )}`,
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: `${formatOrderData(
                BigInt(10_030_000_000), // sudt 100.3
                BigInt(90_000_000_000), // order amount 900
                BigInt(900_000_000_000_000_000_000), // 9
                '01',
              )}`,
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
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90270000000).toString(16)}`,
              data: `${formatOrderData(
                BigInt(0), // sudt 0
                BigInt(10_000_000_000), // order amount 100
                BigInt(900_000_000_000_000_000_000), // price amount 9
                '00',
              )}`,
            }),
          }

          const askOrder = {
            ...baseAskOrder,
            price: BigInt(900_000_000_000_000_000_000), // 9
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0',
              data: `${formatOrderData(
                BigInt(10_030_000_000), // sudt 100.3
                BigInt(90_000_000_000), // order amount 900
                BigInt(900_000_000_000_000_000_000), // 9
                '01',
              )}`,
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
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(120_360_000_000).toString(16)}`, // 1203.6 ckb
            data: `${formatOrderData(
              BigInt(0), // 0 sudt
              BigInt(9_000_000_000), // 90 sudt order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '00',
            )}`,
          }),
        }
        const askOrder = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: `${formatOrderData(
              BigInt(10_030_000_000), // 100.3 sudt
              BigInt(120_000_000_000), // 1200 ckb order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '01',
            )}`,
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
            price: BigInt(1_000_000_000_000_000_000_000), // 10
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90_269_999_999).toString(16)}`, // 902.69999999 ckb
              data: `${formatOrderData(
                BigInt(0), // 0 sudt
                BigInt(9_000_000_000), // 90 sudt order amount
                BigInt(1_000_000_000_000_000_000_000), // 10 price
                '00',
              )}`,
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
            price: BigInt(1_000_000_000_000_000_000_000), // 10
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0', // 0 ckb
              data: `${formatOrderData(
                BigInt(9_026_999_999), // 90.26999999 sudt
                BigInt(120_000_000_000), // 1200 ckb order amount
                BigInt(1_000_000_000_000_000_000_000), // 10 price
                '01',
              )}`,
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
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(120_360_000_000).toString(16)}`, // 1203.6 ckb
            data: `${formatOrderData(
              BigInt(0), // 0 sudt
              BigInt(12_000_000_000), // 120 sudt order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '00',
            )}`,
          }),
        }
        const askOrder = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: `${formatOrderData(
              BigInt(10_030_000_000), // 100.3 sudt
              BigInt(90_000_000_000), // 900 ckb order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '01',
            )}`,
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
            price: BigInt(1_000_000_000_000_000_000_000), // 10
            output: JSON.stringify({
              ...baseScripts,
              capacity: `0x${(90_269_999_999).toString(16)}`, // 902.69999999 ckb
              data: `${formatOrderData(
                BigInt(0), // 0 sudt
                BigInt(12_000_000_000), // 120 sudt order amount
                BigInt(1_000_000_000_000_000_000_000), // 10 price
                '00',
              )}`,
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
            price: BigInt(1_000_000_000_000_000_000_000), // 10
            output: JSON.stringify({
              ...baseScripts,
              capacity: '0x0', // 0 ckb
              data: `${formatOrderData(
                BigInt(9_026_999_999), // 90.26999999 sudt
                BigInt(90_000_000_000), // 900 ckb order amount
                BigInt(1_000_000_000_000_000_000_000), // 10 price
                '01',
              )}`,
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
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(230_660_000_000).toString(16)}`, // 2306.6 ckb
            data: formatOrderData(
              BigInt(0), // 0 sudt
              BigInt(23_000_000_000), // 230 sudt order amount
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '00',
            ),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: formatOrderData(
              BigInt(12_036_000_000), // 120.36 sudt
              BigInt(108_000_000_000), // 1080 ckb order amount
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            ),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: BigInt(950_000_000_000_000_000_000), // 9.5
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: formatOrderData(
              BigInt(10_030_000_000), // 100.3 sudt
              BigInt(95_000_000_000), // 950 ckb order amount
              BigInt(950_000_000_000_000_000_000), // 9.5 price
              '01',
            ),
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
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(230690000000).toString(16)}`, // 2306.9 ckb
            data: formatOrderData(
              BigInt(0), // 0 sudt
              BigInt(23_000_000_000), // 230 sudt order amount / 2300 ckb
              BigInt(1_000_000_000_000_000_000_000), // 10 price
              '00',
            ),
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: formatOrderData(
              BigInt(12_036_000_000), // 120.36 sudt
              BigInt(120_000_000_000), // 1200 ckb order amount / 120 sudt
              BigInt(1_000_000_000_000_000_000_000), // 10
              '01',
            ),
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: BigInt(1_000_000_000_000_000_000_000), // 10
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0', // 0 ckb
            data: formatOrderData(
              BigInt(12_036_000_000), // 120.36 sudt
              BigInt(120_000_000_000), // 1200 ckb order amount / 120 sudt
              BigInt(1_000_000_000_000_000_000_000), // 10
              '01',
            ),
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
        price: BigInt(11 * 10 ** 20),
        output: `{"capacity":"0x0","lock":{"code_hash":"0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160","hash_type":"data","args":"0x688327ab52c054a99b30f2287de0f5ee67805ded"},"type":{"code_hash":"0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740","hash_type":"type","args":"0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7"},"data":"${formatOrderData(
          BigInt(10_030_000_000),
          BigInt(1100 * 10 ** 8),
          BigInt(1_100_000_000_000_000_000_000),
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

    describe('Handle order whose balance is not enough', () => {
      const bidOrder = {
        ...baseBidOrder,
        price: BigInt(1_000_000_000_000_000_000_000), // 10
        output: JSON.stringify({
          ...baseScripts,
          capacity: `0x${(230660000000).toString(16)}`, // 2306.6 ckb
          data: formatOrderData(
            BigInt(0), // 0 sudt
            BigInt(23_000_000_000), // 230 sudt order amount / 2300 ckb
            BigInt(1_000_000_000_000_000_000_000), // 10 price
            '00',
          ),
        }),
      }

      const askOrder_1 = {
        ...baseAskOrder,
        price: BigInt(1_000_000_000_000_000_000_000), // 10
        output: JSON.stringify({
          ...baseScripts,
          capacity: '0x0', // 0 ckb
          data: formatOrderData(
            BigInt(12_036_000_000), // 120.36 sudt
            BigInt(120_000_000_000), // 1200 ckb order amount / 120 sudt
            BigInt(1_000_000_000_000_000_000_000), // 10
            '01',
          ),
        }),
      }
      const askOrder_2 = {
        ...baseAskOrder,
        price: BigInt(1_000_000_000_000_000_000_000), // 10
        output: JSON.stringify({
          ...baseScripts,
          capacity: '0x0', // 0 ckb
          data: formatOrderData(
            BigInt(12_036_000_000), // 120.36 sudt
            BigInt(120_000_000_000), // 1200 ckb order amount / 120 sudt
            BigInt(1_000_000_000_000_000_000_000), // 10
            '01',
          ),
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
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)}`,
            data: `${formatOrderData(
              BigInt(0), // sudt 0
              BigInt(10_000_000_000), // order amount 100
              BigInt(900_000_000_000_000_000_000), // price amount 9
              '00',
            )}`,
          }),
        }

        const askOrder_1 = {
          ...baseAskOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_030_000_000), // sudt 100.3
              BigInt(0), // order amount 0
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            )}`,
          }),
        }
        const askOrder_2 = {
          ...baseAskOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_030_000_000), // sudt 100.3
              BigInt(90_000_000_000), // order amount 900
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            )}`,
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
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)}`,
            data: `${formatOrderData(
              BigInt(0), // sudt 0
              BigInt(0), // order amount 0
              BigInt(900_000_000_000_000_000_000), // price amount 9
              '00',
            )}`,
          }),
        }

        const bidOrder_2 = {
          ...baseBidOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: `0x${(90270000000).toString(16)}`,
            data: `${formatOrderData(
              BigInt(0), // sudt 0
              BigInt(10_000_000_000), // order amount 100
              BigInt(900_000_000_000_000_000_000), // price amount 9
              '00',
            )}`,
          }),
        }

        const askOrder = {
          ...baseAskOrder,
          price: BigInt(900_000_000_000_000_000_000), // 9
          output: JSON.stringify({
            ...baseScripts,
            capacity: '0x0',
            data: `${formatOrderData(
              BigInt(10_030_000_000), // sudt 100.3
              BigInt(90_000_000_000), // order amount 900
              BigInt(900_000_000_000_000_000_000), // 9
              '01',
            )}`,
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
            sudtAmount: BigInt(10000000000),
            orderAmount: BigInt(0),
            price: BigInt(900000000000000000000),
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
            price: BigInt(900000000000000000000),
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
            capacity: '0x5e815c0',
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
          '0x00e40b54020000000000000000000000000000000000000000000000000000000000907b984f02ca300000000000000000',
          '0x00000000000000000000000000000000000000000000000000000000000000000000907b984f02ca300000000000000001',
        ],
      })
    })
  })
})
