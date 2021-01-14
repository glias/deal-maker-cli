import Matcher from './matcher'
import type { OrderDto } from '../orders/order.dto'
import { OrderType } from '../orders/order.entity'
import { encodeOrderData, MATCH_ORDERS_CELL_DEPS, ORDER_CELL_SIZE, SHANNONS_RATIO } from '../../utils'
import { PRICE, BASE_SCRIPTS, BASE_BID_ORDER, BASE_ASK_ORDER } from '../../mock/orders'

const getOrder = (order: {
  type: 'bid' | 'ask'
  capacity: bigint
  price: Record<'effect' | 'exponent', bigint>
  sudtAmount: bigint
  orderAmount: bigint
}): OrderDto => {
  const base = order.type === 'ask' ? BASE_ASK_ORDER : BASE_BID_ORDER
  return {
    ...base,
    price: order.price,
    output: JSON.stringify({
      ...BASE_SCRIPTS,
      capacity: `0x${(order.capacity + ORDER_CELL_MIN_CAPACITY).toString(16)}`,
      data: encodeOrderData({
        sudtAmount: order.sudtAmount,
        orderAmount: order.orderAmount,
        price: order.price,
        type: order.type === 'ask' ? '01' : '00',
        version: '01',
      }),
    }),
  }
}

const getMockLock = ({ ownerLockHash }: { ownerLockHash: string }) => ({
  args: BASE_SCRIPTS.lock.args,
  hashType: BASE_SCRIPTS.lock.hash_type as CKBComponents.ScriptHashType,
  codeHash: BASE_SCRIPTS.lock.code_hash,
  lockHash: ownerLockHash,
})

const ORDER_CELL_MIN_CAPACITY = BigInt(ORDER_CELL_SIZE) * BigInt(SHANNONS_RATIO)

describe('Test Match', () => {
  const dealMakerCell: RawTransactionParams.Cell = {
    data: '0x',
    lock: { codeHash: '0x', hashType: 'data', args: '0x' },
    type: { codeHash: '0x', hashType: 'data', args: '0x' },
    capacity: '0x0',
    outPoint: { txHash: '0x0', index: '0x0' },
  }

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Match orders', () => {
    describe('Full match', () => {
      it('1 Ask 1 Bid', () => {
        expect.assertions(5)
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(81_24373120),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(9 * 10 ** 8),
        })
        const askOrder = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(9_02708125),
          orderAmount: BigInt(81 * 10 ** 8),
        })
        const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell, [bidOrder, askOrder].map(getMockLock))
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
          1,
          8100000000,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([900000000, 1])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
      })

      it('2 Ask 1 Bid', () => {
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(81_24373120),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(9 * 10 ** 8),
        })
        const askOrder_1 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(4_51354063),
          orderAmount: BigInt(40.5 * 10 ** 8),
        })
        const askOrder_2 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(4_51354063),
          orderAmount: BigInt(40.5 * 10 ** 8),
        })

        expect.assertions(5)
        const matcher = new Matcher(
          [bidOrder],
          [askOrder_1, askOrder_2],
          dealMakerCell,
          [bidOrder, askOrder_1, askOrder_2].map(getMockLock),
        )
        matcher.match()
        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
          40_50000000,
          2,
          40_50000000,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 900000000, 1])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373118)
      })

      describe('Skip bid order whose balance is not enough for cost and fee', () => {
        const bidOrderToSkip = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(81_24373119),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(9 * 10 ** 8),
        })
        it('continue the loop if the bid order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = getOrder({
            type: 'bid',
            price: PRICE.NINE,
            capacity: BigInt(81_24373120),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(9 * 10 ** 8),
          })
          const askOrder = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(9_02708125),
            orderAmount: BigInt(81 * 10 ** 8),
          })
          const matcher = new Matcher(
            [bidOrderToSkip, bidOrder],
            [askOrder],
            dealMakerCell,
            [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
          )
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            1,
            8100000000,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([900000000, 1])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
        })

        it('break the loop if the bid order is a partially matched one', () => {
          expect.assertions(2)
          const bidOrder = getOrder({
            type: 'bid',
            price: PRICE.NINE,
            capacity: BigInt(902.7 * 10 ** 8),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(100 * 10 ** 8),
          })

          const askOrder = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(100.3 * 10 ** 8),
            orderAmount: BigInt(900 * 10 ** 8),
          })

          const matcher = new Matcher(
            [bidOrderToSkip, bidOrder],
            [askOrder],
            dealMakerCell,
            [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
          )
          matcher.bidOrderList[0].part = true
          matcher.match()
          expect(matcher.matchedOrderList).toHaveLength(1)
          expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
        })
      })

      describe('Skip ask order whose balance is not enough for cost and fee', () => {
        const askOrderToSkip = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(9_02708124),
          orderAmount: BigInt(81 * 10 ** 8),
        })
        it('continue the loop if the ask order is not a partially matched one', () => {
          expect.assertions(5)
          const bidOrder = getOrder({
            type: 'bid',
            price: PRICE.NINE,
            capacity: BigInt(81_24373120),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(9 * 10 ** 8),
          })
          const askOrder = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(9_02708125),
            orderAmount: BigInt(81 * 10 ** 8),
          })

          const matcher = new Matcher(
            [bidOrder],
            [askOrderToSkip, askOrder],
            dealMakerCell,
            [bidOrder, askOrderToSkip, askOrder].map(getMockLock),
          )
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            1,
            8100000000,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([900000000, 1])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
        })

        it('break the loop if the ask order is a partially matched one', () => {
          expect.assertions(2)
          const bidOrder = getOrder({
            type: 'bid',
            price: PRICE.NINE,
            capacity: BigInt(902.7 * 10 ** 8),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(100 * 10 ** 8),
          })

          const askOrder = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(100.3 * 10 ** 8),
            orderAmount: BigInt(900 * 10 ** 8),
          })
          const matcher = new Matcher(
            [bidOrder],
            [askOrderToSkip, askOrder],
            dealMakerCell,
            [bidOrder, askOrderToSkip, askOrder].map(getMockLock),
          )
          matcher.askOrderList[0].part = true
          matcher.match()
          expect(matcher.matchedOrderList).toHaveLength(1)
          expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
        })
      })
    })

    describe('Partial match', () => {
      describe('Ask Order > Bid Order', () => {
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(81_24373120),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(9 * 10 ** 8),
        })

        const askOrder = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(12 * 10 ** 8),
          orderAmount: BigInt(100 * 10 ** 8),
        })

        it('return correct capacity and sudt amount when no bid order left', () => {
          expect.assertions(5)
          const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell, [bidOrder, askOrder].map(getMockLock))
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            1,
            81_00000000,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9_00000000, 2_97291876])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 19_00000000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
        })

        describe('Skip bid order whose balance is not enough for cost and fee', () => {
          const bidOrderToSkip = getOrder({
            type: 'bid',
            price: PRICE.TEN,
            capacity: BigInt(0),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(90 * 10 ** 8),
          })

          it('continue the loop if the bid order is not a partially matched one', () => {
            expect.assertions(5)
            const matcher = new Matcher(
              [bidOrderToSkip, bidOrder],
              [askOrder],
              dealMakerCell,
              [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
            )
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
              1,
              81_00000000,
            ])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9_00000000, 2_97291876])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 19_00000000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
          })

          it('break the loop if the bid order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher(
              [bidOrderToSkip, bidOrder],
              [askOrder],
              dealMakerCell,
              [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
            )
            matcher.bidOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
          })
        })

        describe('Skip ask order whose balance is not enough for cost and fee', () => {
          const askOrderToSkip = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(9 * 10 ** 8),
            orderAmount: BigInt(81 * 10 ** 8),
          })

          it('continue the loop if the ask order is not a partially matched one', () => {
            expect.assertions(5)
            const matcher = new Matcher(
              [bidOrder],
              [askOrderToSkip, askOrder],
              dealMakerCell,
              [bidOrder, askOrderToSkip, askOrder].map(getMockLock),
            )
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
              1,
              81_00000000,
            ])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([9 * 10 ** 8, 297291876])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 19_00000000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
          })

          it('break the loop if the ask order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher(
              [bidOrder],
              [askOrderToSkip, askOrder],
              dealMakerCell,
              [bidOrder, askOrderToSkip, askOrder].map(getMockLock),
            )
            matcher.askOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
          })
        })
      })

      describe('Ask Order < Bid Order', () => {
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(100 * 10 ** 8),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(10 * 10 ** 8),
        })

        const askOrder = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(9_02708125),
          orderAmount: BigInt(81 * 10 ** 8),
        })

        it('return correct capacity and sudt amount when no ask order left', () => {
          expect.assertions(5)
          const matcher = new Matcher([bidOrder], [askOrder], dealMakerCell, [bidOrder, askOrder].map(getMockLock))
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            8100000000,
            1875626881,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 9_00000000])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 1_00000000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
        })

        describe('Skip bid order whose balance is not enough for cost and fee', () => {
          const bidOrderToSkip = getOrder({
            type: 'bid',
            price: PRICE.NINE,
            capacity: BigInt(81_00000000),
            sudtAmount: BigInt(0),
            orderAmount: BigInt(10 * 10 ** 8),
          })

          it('continue the loop if the bid order is not a partially matched one', () => {
            expect.assertions(5)
            const matcher = new Matcher(
              [bidOrderToSkip, bidOrder],
              [askOrder],
              dealMakerCell,
              [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
            )
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
              8100000000,
              1875626881,
            ])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 9_00000000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 1_00000000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
          })

          it('break the loop if the bid order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher(
              [bidOrderToSkip, bidOrder],
              [askOrder],
              dealMakerCell,
              [bidOrderToSkip, bidOrder, askOrder].map(getMockLock),
            )
            matcher.bidOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(bidOrderToSkip.id)
          })
        })

        describe('Skip ask order whose balance is not enough for cost and fee', () => {
          const askOrderToSkip = getOrder({
            type: 'ask',
            price: PRICE.NINE,
            capacity: BigInt(0),
            sudtAmount: BigInt(1 * 10 ** 8),
            orderAmount: BigInt(9 * 10 ** 8),
          })
          it('continue the loop if the ask order is not a partially matched one', () => {
            expect.assertions(5)
            const matcher = new Matcher(
              [bidOrder],
              [askOrderToSkip, askOrder],
              dealMakerCell,
              [bidOrder, askOrderToSkip, askOrder].map(getMockLock),
            )
            matcher.match()

            expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
              81_00000000,
              1875626881,
            ])
            expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 9_00000000])
            expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 1_00000000])

            expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
            expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
          })

          it('break the loop if the ask order is a partially matched one', () => {
            expect.assertions(2)
            const matcher = new Matcher(
              [bidOrder],
              [askOrderToSkip, askOrder],
              dealMakerCell,
              [bidOrder, askOrderToSkip, askOrderToSkip].map(getMockLock),
            )
            matcher.askOrderList[0].part = true
            matcher.match()

            expect(matcher.matchedOrderList).toHaveLength(1)
            expect(matcher.matchedOrderList[0].id).toBe(askOrderToSkip.id)
          })
        })
      })

      describe('2 Ask Order < 1 Bid Order', () => {
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(200 * 10 ** 8),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(30 * 10 ** 8),
        })

        const askOrder_1 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(100 * 10 ** 8),
          orderAmount: BigInt(81 * 10 ** 8),
        })

        const askOrder_2 = getOrder({
          type: 'ask',
          price: PRICE.EIGHT,
          capacity: BigInt(0),
          sudtAmount: BigInt(1000 * 10 ** 8),
          orderAmount: BigInt(72 * 10 ** 8),
        })

        it('return correct capacity and sudt amount', () => {
          expect.assertions(5)
          const matcher = new Matcher(
            [bidOrder],
            [askOrder_1, askOrder_2],
            dealMakerCell,
            [bidOrder, askOrder_1, askOrder_2].map(getMockLock),
          )
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            81_00000000,
            71_99999987,
            46_53961900,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([
            90_97291876,
            991_50392356,
            17_47058822,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 13, 12_52941178])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(5256946)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(46038113)
        })
      })

      describe('2 Ask Order > 1 Bid Order', () => {
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(200 * 10 ** 8),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(15 * 10 ** 8),
        })

        const askOrder_1 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(100 * 10 ** 8),
          orderAmount: BigInt(81 * 10 ** 8),
        })

        const askOrder_2 = getOrder({
          type: 'ask',
          price: PRICE.EIGHT,
          capacity: BigInt(0),
          sudtAmount: BigInt(1000 * 10 ** 8),
          orderAmount: BigInt(72 * 10 ** 8),
        })

        it('return correct capacity and sudt amount', () => {
          expect.assertions(5)
          const matcher = new Matcher(
            [bidOrder],
            [askOrder_1, askOrder_2],
            dealMakerCell,
            [bidOrder, askOrder_1, askOrder_2].map(getMockLock),
          )
          matcher.match()

          expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
            81_00000000,
            67_60280843,
            51_00000000,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([
            9097291876,
            1500000000,
            99398194584,
          ])
          expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0, 2100000000])

          expect(Number(matcher.dealMakerSudtAmount)).toBe(4513540)
          expect(Number(matcher.dealMakerCapacityAmount)).toBe(39719157)
        })
      })
    })

    describe("Ask price is greater than bid price, can't match", () => {
      const askOrderWithHigherPrice = getOrder({
        type: 'ask',
        price: PRICE.ELEVEN,
        capacity: BigInt(0),
        sudtAmount: BigInt(100 * 10 ** 8),
        orderAmount: BigInt(1100 * 10 ** 8),
      })

      it('returns empty array', () => {
        expect.assertions(3)
        const matcher = new Matcher(
          [BASE_BID_ORDER],
          [askOrderWithHigherPrice],
          dealMakerCell,
          [BASE_BID_ORDER, askOrderWithHigherPrice].map(getMockLock),
        )
        matcher.match()

        expect(matcher.matchedOrderList).toHaveLength(0)

        expect(Number(matcher.dealMakerSudtAmount)).toBe(0)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(0)
      })
    })

    describe('Handle order whose balance is not enough', () => {
      const bidOrder = getOrder({
        type: 'bid',
        price: PRICE.NINE,
        capacity: BigInt(100 * 10 ** 8),
        sudtAmount: BigInt(0),
        orderAmount: BigInt(18 * 10 ** 8),
      })

      const askOrder_1 = getOrder({
        type: 'ask',
        price: PRICE.NINE,
        capacity: BigInt(0),
        sudtAmount: BigInt(9 * 10 ** 8),
        orderAmount: BigInt(81 * 10 ** 8),
      })
      const askOrder_2 = getOrder({
        type: 'ask',
        price: PRICE.NINE,
        capacity: BigInt(0),
        sudtAmount: BigInt(9_02708125),
        orderAmount: BigInt(81 * 10 ** 8),
      })

      it('skip unmet order', () => {
        expect.assertions(5)
        const matcher = new Matcher(
          [bidOrder],
          [askOrder_1, askOrder_2],
          dealMakerCell,
          [bidOrder, askOrder_1, askOrder_2].map(getMockLock),
        )
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
          81_00000000,
          1875626881,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 9_00000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 9_00000000])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
      })
    })

    describe('Skip ask order whose order amount is 0', () => {
      it('Skip 1st ask order', () => {
        expect.assertions(5)
        const bidOrder = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(100 * 10 ** 8),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(18 * 10 ** 8),
        })

        const askOrder_1 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(100 * 10 ** 8),
          orderAmount: BigInt(0),
        })
        const askOrder_2 = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(9_02708125),
          orderAmount: BigInt(81 * 10 ** 8),
        })

        const matcher = new Matcher(
          [bidOrder],
          [askOrder_1, askOrder_2],
          dealMakerCell,
          [bidOrder, askOrder_1, askOrder_2].map(getMockLock),
        )
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
          81_00000000,
          1875626881,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([1, 9_00000000])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 9_00000000])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
      })
    })

    describe('Skip bid order whose order amount is 0', () => {
      it('Skip 1st bid order whose order amount is 0', () => {
        expect.assertions(5)
        const bidOrder_1 = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(100 * 10 ** 8),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(0),
        })

        const bidOrder_2 = getOrder({
          type: 'bid',
          price: PRICE.NINE,
          capacity: BigInt(81_24373120),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(9 * 10 ** 8),
        })

        const askOrder = getOrder({
          type: 'ask',
          price: PRICE.NINE,
          capacity: BigInt(0),
          sudtAmount: BigInt(9_02708125),
          orderAmount: BigInt(81 * 10 ** 8),
        })
        const matcher = new Matcher(
          [bidOrder_1, bidOrder_2],
          [askOrder],
          dealMakerCell,
          [bidOrder_1, bidOrder_2, askOrder].map(getMockLock),
        )
        matcher.match()

        expect(matcher.matchedOrderList.map(o => Number(o.info.capacity - ORDER_CELL_MIN_CAPACITY))).toEqual([
          1,
          8100000000,
        ])
        expect(matcher.matchedOrderList.map(o => Number(o.info.sudtAmount))).toEqual([900000000, 1])
        expect(matcher.matchedOrderList.map(o => Number(o.info.orderAmount))).toEqual([0, 0])

        expect(Number(matcher.dealMakerSudtAmount)).toBe(2708124)
        expect(Number(matcher.dealMakerCapacityAmount)).toBe(24373119)
      })
    })
  })

  describe('Transaction', () => {
    it('should return null is no matched orders', () => {
      const matcher = new Matcher([], [], dealMakerCell, [])
      expect(matcher.rawTx).toBeNull()
    })
    it('should return tx when orders matched', () => {
      const matcher = new Matcher([], [], dealMakerCell, [])
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
            orderAmount: BigInt('10000000'),
            price: PRICE.NINE,
            capacity: BigInt('1000000000000000000000000'),
            type: OrderType.Bid,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
          scripts: {
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
            },
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          info: {
            sudtAmount: BigInt('100000000000000000'),
            orderAmount: BigInt('10000000000'),
            price: PRICE.NINE,
            capacity: BigInt('90000000000'),
            type: OrderType.Ask,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
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
            capacity: '0xd3c21bcecceda1000000',
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
              args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
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
          '0x00e40b54020000000000000000000000018096980000000000000000000000000009000000000000000000',
          '0x00008a5d7845630100000000000000000100e40b5402000000000000000000000009000000000000000001',
        ],
      })
    })

    it('should claim orders', () => {
      const matcher = new Matcher([], [], dealMakerCell, [])
      matcher.dealMakerCell = dealMakerCell
      const ownerLock = {
        codeHash: BASE_SCRIPTS.lock.code_hash,
        hashType: BASE_SCRIPTS.lock.hash_type,
        args: BASE_SCRIPTS.lock.args,
      }
      const ORDER_SCRIPTS = {
        lock: {
          codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
          hashType: 'data' as CKBComponents.ScriptHashType,
          args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
        type: {
          codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
          hashType: 'type' as CKBComponents.ScriptHashType,
          args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
        },
      }
      const orders = {
        bidOrderWithEmptyOrderAmount: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x0',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('10000000000'),
            orderAmount: BigInt('0'),
            price: PRICE.NINE,
            capacity: BigInt('1000000000000000000000000'),
            type: OrderType.Bid,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        bidOrderWithLowBalance: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x1',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('10000000000'),
            orderAmount: BigInt('10000000'),
            price: PRICE.NINE,
            capacity: BigInt('15400000000'),
            type: OrderType.Bid,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        bidOrderWithLowBalanceAndPositivePriceExponent: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x1',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('1'),
            orderAmount: BigInt('10000000'),
            price: {
              effect: BigInt(1),
              exponent: BigInt(10),
            },
            capacity: BigInt('15400000000'),
            type: OrderType.Bid,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        askOrderWithEmptyOrderAmount: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x2',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('0'),
            orderAmount: BigInt('0'),
            price: PRICE.NINE,
            capacity: BigInt('90000000000'),
            type: OrderType.Ask,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        askOrderWithLowBalance: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x3',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('0'),
            orderAmount: BigInt('10000000000'),
            price: PRICE.NINE,
            capacity: BigInt('90000000000'),
            type: OrderType.Ask,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
        askOrderWithSudtBalance: {
          id: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee-0x4',
          scripts: ORDER_SCRIPTS,
          info: {
            sudtAmount: BigInt('100000000000000000'),
            orderAmount: BigInt('0'),
            price: PRICE.NINE,
            capacity: BigInt('90000000000'),
            type: OrderType.Ask,
          },
          ownerLock: getMockLock({ ownerLockHash: '' }),
        },
      }
      matcher.matchedOrderList = [
        orders.bidOrderWithEmptyOrderAmount,
        orders.bidOrderWithLowBalance,
        orders.bidOrderWithLowBalanceAndPositivePriceExponent,
        orders.askOrderWithEmptyOrderAmount,
        orders.askOrderWithLowBalance,
        orders.askOrderWithSudtBalance,
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
              index: '0x1',
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
          {
            previousOutput: {
              txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
              index: '0x3',
            },
            since: '0x0',
          },
          {
            previousOutput: {
              txHash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
              index: '0x4',
            },
            since: '0x0',
          },
        ],
        witnesses: [{ lock: '', inputType: '', outputType: '' }, '0x', '0x', '0x', '0x', '0x', '0x'],
        outputs: [
          {
            capacity: '0x5dcdac0',
            lock: { codeHash: '0x', hashType: 'data', args: '0x' },
            type: { codeHash: '0x', hashType: 'data', args: '0x' },
          },
          {
            capacity: '0xd3c21bcecceda1000000',
            lock: ownerLock,
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          {
            capacity: '0x395e95a00',
            lock: ownerLock,
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          {
            capacity: '0x395e95a00',
            lock: ownerLock,
            type: {
              codeHash: '0xc68fb287d8c04fd354f8332c3d81ca827deea2a92f12526e2f35be37968f6740',
              hashType: 'type',
              args: '0xbe7e812b85b692515a21ea3d5aed0ad37dccb3fcd86e9b8d6a30ac24808db1f7',
            },
          },
          {
            capacity: '0x14f46b0400',
            lock: ownerLock,
            type: null,
          },
          {
            capacity: '0x14f46b0400',
            lock: ownerLock,
            type: null,
          },
          {
            capacity: '0x14f46b0400',
            lock: {
              codeHash: '0x04878826e4bf143a93eb33cb298a46f96e4014533d98865983e048712da65160',
              hashType: 'data',
              args: '0x688327ab52c054a99b30f2287de0f5ee67805ded',
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
          '0x00e40b54020000000000000000000000',
          '0x00e40b54020000000000000000000000',
          '0x01000000000000000000000000000000',
          '0x',
          '0x',
          '0x00008a5d784563010000000000000000',
        ],
      })
    })
  })
})
