/**
 * This test suite uses the logic from contracts
 */
import Matcher from './matcher'
import { OrderType } from '../orders/order.entity'
type OrderInfo = Record<'capacity' | 'sudtAmount' | 'orderAmount' | 'price', bigint> & { type: OrderType }

describe('Test with validator', () => {
  const FEE = BigInt(3)
  const FEE_DECIMAL = BigInt(1000)
  const PRICE_DECIMAL = BigInt(100000000000000000000)
  let matcher: Matcher
  let originOrders: Array<{ info: OrderInfo; id: string }> = []
  describe('Partially Matched Bid', () => {
    beforeAll(() => {
      const bidOrder = {
        id: '0x39780d830a6fc914acf3f6ef280ab21b9b6e894d00b402db6fd81ec50646354d-0x0',
        tokenId: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        type: 0,
        price: BigInt(50000000000),
        blockNumber: 526420,
        output:
          '{"capacity":"0x7080f6e00","lock":{"codeHash":"0xc8f9ffa3de3171006d5c499b77624f815072f21a047ebaf38dfeeee980dde500","hashType":"type","args":"0x9fe3c3ef6b4a3415d58799c29b84ba05611e2944aedb39caa21e89ca93b03f85"},"type":{"codeHash":"0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419","hashType":"data","args":"0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947"},"data":"0x000000000000000000000000000000001959309200000000000000000000000000743ba40b00000000"}',
      }
      const askOrder = {
        id: '0x07dee385d00d2eab3b5f0bffde5f97b6d103514352f3bc169dd0a13b16bc29d9-0x2',
        tokenId: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        type: 1,
        price: BigInt(50000000000),
        blockNumber: 516279,
        output:
          '{"capacity":"0x5be4d55cd","lock":{"codeHash":"0xc8f9ffa3de3171006d5c499b77624f815072f21a047ebaf38dfeeee980dde500","hashType":"type","args":"0xc07b294df4873625d2c97d904a6cd91ff68c8d68e6b343b0b2490e15d79c094f"},"type":{"codeHash":"0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419","hashType":"data","args":"0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947"},"data":"0x7f787e59000000000000000000000000b37743c100000000000000000000000000743ba40b00000001"}',
      }
      const dealMakerCell = {
        data: '0xde2d780b000000000000000000000000',
        lock: {
          codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
          hashType: 'type' as CKBComponents.ScriptHashType,
          args: '0x921e55249a7072f945a8adae259a8665196289bc',
        },
        type: {
          codeHash: '0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419',
          hashType: 'data' as CKBComponents.ScriptHashType,
          args: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        },
        capacity: '0x38d7ec64b907c',
        outPoint: {
          txHash: '0x07dee385d00d2eab3b5f0bffde5f97b6d103514352f3bc169dd0a13b16bc29d9',
          index: '0x0',
        },
      }
      matcher = new Matcher([bidOrder], [askOrder], dealMakerCell)
      originOrders.push(...matcher.askOrderList, ...matcher.bidOrderList)
      matcher.match()
    })

    it('Should output partially matched bid and fully matched ask', () => {
      for (let i = 0; i < matcher.matchedOrderList.length; i++) {
        const inputOrder = originOrders[i].info
        const outputOrder = matcher.matchedOrderList[i].info
        if (inputOrder.type === 0) {
          // bid
          const diffSudtAmount = outputOrder.sudtAmount - inputOrder.sudtAmount
          const diffOrderAmount = inputOrder.orderAmount - outputOrder.orderAmount
          const diffCapacity = inputOrder.capacity - outputOrder.capacity
          const diffCapacityDecimal = diffCapacity * FEE_DECIMAL * PRICE_DECIMAL
          const diffSudtDecimal = diffSudtAmount * (FEE_DECIMAL + FEE) * inputOrder.price

          expect(inputOrder.capacity).toBeGreaterThan(outputOrder.capacity)
          expect(outputOrder.sudtAmount).toBeGreaterThan(BigInt(0))
          expect(inputOrder.sudtAmount).toBeLessThan(outputOrder.sudtAmount)
          expect(diffSudtAmount).toBe(diffOrderAmount)
          expect(diffCapacityDecimal).toBeLessThanOrEqual(diffSudtDecimal)
        } else {
          // ask
          const diffSudtAmount = inputOrder.sudtAmount - outputOrder.sudtAmount
          const diffOrderAmount = inputOrder.orderAmount - outputOrder.orderAmount
          const diffCapacity = outputOrder.capacity - inputOrder.capacity
          const diffCapacityDecimal = diffCapacity * (FEE_DECIMAL + FEE) * PRICE_DECIMAL
          const diffSudtDecimal = diffSudtAmount * FEE_DECIMAL * inputOrder.price

          expect(inputOrder.capacity).toBeLessThan(outputOrder.capacity)
          expect(inputOrder.sudtAmount).toBeGreaterThan(BigInt(0))
          expect(inputOrder.sudtAmount).toBeGreaterThan(outputOrder.sudtAmount)
          expect(diffCapacity).toBe(diffOrderAmount)
          expect(diffCapacityDecimal).toBeGreaterThanOrEqual(diffSudtDecimal)
        }
      }
    })
  })
  describe('Partial Matched Ask', () => {
    beforeAll(() => {
      const bidOrder = {
        id: '0x39780d830a6fc914acf3f6ef280ab21b9b6e894d00b402db6fd81ec50646354d-0x0',
        tokenId: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        type: 0,
        price: BigInt(50000000000),
        blockNumber: 526420,
        output:
          '{"capacity":"0x7080f6e00","lock":{"codeHash":"0xc8f9ffa3de3171006d5c499b77624f815072f21a047ebaf38dfeeee980dde500","hashType":"type","args":"0x9fe3c3ef6b4a3415d58799c29b84ba05611e2944aedb39caa21e89ca93b03f85"},"type":{"codeHash":"0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419","hashType":"data","args":"0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947"},"data":"0x000000000000000000000000000000001959309200000000000000000000000000743ba40b00000000"}',
      }
      const askOrder = {
        id: '0x07dee385d00d2eab3b5f0bffde5f97b6d103514352f3bc169dd0a13b16bc29d9-0x2',
        tokenId: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        type: 1,
        price: BigInt(50000000000),
        blockNumber: 516279,
        output:
          '{"capacity":"0x5be4d55cd","lock":{"codeHash":"0xc8f9ffa3de3171006d5c499b77624f815072f21a047ebaf38dfeeee980dde500","hashType":"type","args":"0xc07b294df4873625d2c97d904a6cd91ff68c8d68e6b343b0b2490e15d79c094f"},"type":{"codeHash":"0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419","hashType":"data","args":"0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947"},"data":"0x7f787e59000000000000000000000000b37743c100000000000000000000000000743ba40b00000001"}',
      }
      const dealMakerCell = {
        data: '0xde2d780b000000000000000000000000',
        lock: {
          codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
          hashType: 'type' as CKBComponents.ScriptHashType,
          args: '0x921e55249a7072f945a8adae259a8665196289bc',
        },
        type: {
          codeHash: '0xe1e354d6d643ad42724d40967e334984534e0367405c5ae42a9d7d63d77df419',
          hashType: 'data' as CKBComponents.ScriptHashType,
          args: '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947',
        },
        capacity: '0x38d7ec64b907c',
        outPoint: {
          txHash: '0x07dee385d00d2eab3b5f0bffde5f97b6d103514352f3bc169dd0a13b16bc29d9',
          index: '0x0',
        },
      }
      matcher = new Matcher([bidOrder], [askOrder], dealMakerCell)
      originOrders.push(...matcher.askOrderList, ...matcher.bidOrderList)
      matcher.match()
    })

    it('Should output partially matched ask and fully matched bid', () => {
      for (let i = 0; i < matcher.matchedOrderList.length; i++) {
        const inputOrder = originOrders[i].info
        const outputOrder = matcher.matchedOrderList[i].info
        if (inputOrder.type === 0) {
          // bid
          const diffSudtAmount = outputOrder.sudtAmount - inputOrder.sudtAmount
          const diffOrderAmount = inputOrder.orderAmount - outputOrder.orderAmount
          const diffCapacity = inputOrder.capacity - outputOrder.capacity
          const diffCapacityDecimal = diffCapacity * FEE_DECIMAL * PRICE_DECIMAL
          const diffSudtDecimal = diffSudtAmount * (FEE_DECIMAL + FEE) * inputOrder.price

          expect(inputOrder.capacity).toBeGreaterThan(outputOrder.capacity)
          expect(outputOrder.sudtAmount).toBeGreaterThan(BigInt(0))
          expect(inputOrder.sudtAmount).toBeLessThan(outputOrder.sudtAmount)
          expect(diffSudtAmount).toBe(diffOrderAmount)
          expect(diffCapacityDecimal).toBeLessThanOrEqual(diffSudtDecimal)
        } else {
          // ask
          // if input_capacity > output_capacity {
          //   return Err(Error:: WrongDiffCapacity)
          // }
          // if input_order.sudt_amount == 0 {
          //   return Err(Error:: WrongSUDTInputAmount)
          // }
          // if input_order.sudt_amount < output_order.sudt_amount {
          //   return Err(Error:: WrongSUDTDiffAmount)
          // }
          // let diff_order_amount = input_order.order_amount - output_order.order_amount
          // let diff_capacity = (output_capacity - input_capacity) as u128
          // // The capacity increase value should to be equal to the order_amount decrease value
          // if diff_capacity != diff_order_amount {
          //   return Err(Error:: WrongDiffCapacity)
          // }
          // let diff_capacity_decimal = diff_capacity * (1000 + FEE) * PRICE_DECIMAL
          // let diff_sudt_amount = input_order.sudt_amount - output_order.sudt_amount
          // let diff_sudt_decimal = diff_sudt_amount * (input_order.price as u128) * FEE_DECIMAL
          // if diff_capacity_decimal < diff_sudt_decimal {
          //   return Err(Error:: WrongSwapAmount)
          // }
        }
      }
    })
  })
})
