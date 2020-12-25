import BigNumber from 'bignumber.js'
import { parseOrderCell, parseOrderData, parsePlaceOrderTx, formatDealInfo, encodeOrderData, getPrice } from './parser'

describe('Test parser', () => {
  it('parse order data', () => {
    const fixture = {
      version: '01',
      sudtAmount: '00743ba40b0000000000000000000000',
      orderAmount: '00e87648170000000000000000000000',
      price: '00000000000000050a',
      type: '01',
    }
    const DATA = `0x${fixture.sudtAmount}${fixture.version}${fixture.orderAmount}${fixture.price}${fixture.type}`

    expect(parseOrderData(DATA)).toEqual({
      sudtAmount: BigInt(50000000000),
      orderAmount: BigInt(100000000000),
      price: {
        effect: BigInt('5000000000000000000'),
        exponent: BigInt(-8),
      },
      type: '01',
      version: '01',
    })
  })

  it('parse order cell', () => {
    const data = {
      version: '01',
      sudtAmount: '00743ba40b0000000000000000000000',
      orderAmount: '00e87648170000000000000000000000',
      price: '00000000000000050a',
      type: '01',
    }
    const CELL = {
      cell_output: {
        capacity: '0x12a05f2000',
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
      },
      out_point: {
        tx_hash: '0x64f2586de4d3861d8b9a6d43a21752006b5b7b0991ad7735d8b93d596f516dee',
        index: '0x0',
      },
      block_hash: '0xaaeee4a93a1d79ccdf50f9e2e6c688f9d935bb8c21aeaf2c09508f8070b1bd89',
      block_number: '0x13',
      data: `0x${data.sudtAmount}${data.version}${data.orderAmount}${data.price}${data.type}`,
    }
    expect(parseOrderCell(CELL as any)).toEqual({
      id: `${CELL.out_point.tx_hash}-${CELL.out_point.index}`,
      tokenId: CELL.cell_output.type.args,
      blockNumber: +CELL.block_number,
      type: '01',
      price: {
        effect: BigInt('5000000000000000000'),
        exponent: BigInt(-8),
      },
      orderAmount: BigInt(100000000000),
      sudtAmount: BigInt(50000000000),
      output: { ...CELL.cell_output, data: CELL.data },
    })
  })

  it('encode order data', () => {
    const fixture = {
      sudtAmount: BigInt('20000000000'),
      orderAmount: BigInt('100000000000'),
      version: '01' as '01',
      price: {
        effect: BigInt('10000000000000000000'),
        exponent: BigInt(-9),
      },
      type: '01' as '00' | '01',
    }

    expect(encodeOrderData(fixture)).toBe(
      '0x00c817a80400000000000000000000000100e8764817000000000000000000000000000000000000010a01',
    )
  })

  it('parse place order tx', () => {
    const fixture: any = {
      inputs: {
        miner: { capacity: BigInt(1000000031979808), sudtAmount: BigInt(149551) },
        orders: [
          {
            sudtAmount: BigInt(300000000),
            orderAmount: BigInt(897308075),
            price: BigInt(30000000000),
            type: '01',
            capacity: BigInt(17910000000),
          },
          {
            sudtAmount: BigInt(49850448),
            orderAmount: BigInt(4037886341),
            price: BigInt(30000000000),
            type: '00',
            capacity: BigInt(30100000001),
          },
        ],
      },
      outputs: {
        miner: { capacity: BigInt(1000000033612732), sudtAmount: BigInt(897308) },
        orders: [
          {
            sudtAmount: BigInt(1),
            orderAmount: BigInt(0),
            price: BigInt(30000000000),
            type: '01',
            capacity: BigInt(18807308075),
          },
          {
            sudtAmount: BigInt(348953139),
            orderAmount: BigInt(3738783650),
            price: BigInt(30000000000),
            type: '00',
            capacity: BigInt(29200000002),
          },
        ],
      },
    }

    expect(parsePlaceOrderTx(fixture.inputs, fixture.outputs)).toEqual({
      askLogs: [
        {
          'capacity:after': BigInt(18807308075),
          'capacity:before': BigInt(17910000000),
          'capacity:delta': BigInt(897308075),
          'name': 'ask 0',
          'sudt:after': BigInt(1),
          'sudt:before': BigInt(300000000),
          'sudt:delta': BigInt(-299999999),
        },
      ],
      bidLogs: [
        {
          'capacity:after': BigInt(29200000002),
          'capacity:before': BigInt(30100000001),
          'capacity:delta': BigInt(-899999999),
          'name': 'bid 0',
          'sudt:after': BigInt(348953139),
          'sudt:before': BigInt(49850448),
          'sudt:delta': BigInt(299102691),
        },
      ],
      delta: {
        capacity: BigInt(-1059000),
        sudt: BigInt(-149551),
      },
      minerLog: {
        'capacity:after': BigInt(1000000033612732),
        'capacity:before': BigInt(1000000031979808),
        'capacity:delta': BigInt(1632924),
        'name': 'miner',
        'sudt:after': BigInt(897308),
        'sudt:before': BigInt(149551),
        'sudt:delta': BigInt(747757),
      },
    })
  })

  describe('format deal info', () => {
    const PRICE = {
      FIVE: {
        effect: BigInt(500000000000000000),
        exponent: BigInt(-17),
      },
    }
    it('imperfect price for order amount', () => {
      const fixture = {
        askOrderInfo: {
          capacity: BigInt(24_667_575_757),
          sudtAmount: BigInt(1_501_460_607),
          orderAmount: BigInt(3_242_424_243),
          price: PRICE.FIVE,
          type: 1,
        },
        bidOrderInfo: {
          capacity: BigInt(30_200_000_000),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(2_452_642_073),
          price: PRICE.FIVE,
          type: 0,
        },
      }
      const { askAmount, bidAmount, price } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(askAmount).toEqual({
        balance: BigInt(1_501_460_607),
        costAmount: BigInt(648_484_848),
        orderAmount: BigInt(3_242_424_240),
        targetAmount: BigInt(27_909_999_997),
      })
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()
      expect(bidAmount).toEqual({
        balance: BigInt(30_200_000_000),
        costAmount: BigInt(12_263_210_365),
        orderAmount: BigInt(2_452_642_073),
        targetAmount: BigInt(2_452_642_073),
      })
      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
      expect(price).toBe('5')
    })

    it('perfect price for order amount', () => {
      const fixture = {
        askOrderInfo: {
          capacity: BigInt(24_667_575_757),
          sudtAmount: BigInt(1_501_460_607),
          orderAmount: BigInt(3_242_424_240),
          price: PRICE.FIVE,
          type: 1,
        },
        bidOrderInfo: {
          capacity: BigInt(30_200_000_000),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(2_452_642_073),
          price: PRICE.FIVE,
          type: 0,
        },
      }
      const { askAmount, bidAmount, price } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(askAmount).toEqual({
        balance: BigInt(1_501_460_607),
        costAmount: BigInt(648_484_848),
        orderAmount: BigInt(3_242_424_240),
        targetAmount: BigInt(27_909_999_997),
      })
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()
      expect(bidAmount).toEqual({
        balance: BigInt(30_200_000_000),
        costAmount: BigInt(12_263_210_365),
        orderAmount: BigInt(2_452_642_073),
        targetAmount: BigInt(2_452_642_073),
      })
      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
      expect(price).toBe('5')
    })

    it('decimal price', () => {
      const fixture = {
        askOrderInfo: {
          capacity: BigInt(24_667_575_757),
          sudtAmount: BigInt(1_501_460_607),
          orderAmount: BigInt(3_242_424_240),
          price: {
            effect: BigInt(5),
            exponent: BigInt(-10),
          },
          type: 1,
        },
        bidOrderInfo: {
          capacity: BigInt(30_200_000_000),
          sudtAmount: BigInt(0),
          orderAmount: BigInt(2_452_642_073),
          price: {
            effect: BigInt(5),
            exponent: BigInt(-10),
          },
          type: 0,
        },
      }
      const { askAmount, bidAmount, price } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(askAmount).toEqual({
        balance: BigInt(1_501_460_607),
        costAmount: BigInt(648_484_848_0_000_000_000),
        orderAmount: BigInt(3_242_424_240),
        targetAmount: BigInt(27_909_999_997),
      })
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()
      expect(bidAmount).toEqual({
        balance: BigInt(30_200_000_000),
        costAmount: BigInt(1),
        orderAmount: BigInt(2_000_000_000),
        targetAmount: BigInt(2_000_000_000),
      })
      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
      expect(price).toBe('0.0000000005')
    })

    it('edge case 1', () => {
      const fixture = {
        bidOrderInfo: {
          capacity: BigInt('9558252428399'),
          sudtAmount: BigInt('399473149999248054'),
          orderAmount: BigInt('7292834542308444253'),
          price: {
            effect: BigInt(13),
            exponent: BigInt(-7),
          },
          type: 0,
        },
        askOrderInfo: {
          capacity: BigInt('411836398338'),
          sudtAmount: BigInt('703739388052129823'),
          orderAmount: BigInt('906863601662'),
          price: {
            effect: BigInt(13),
            exponent: BigInt(-7),
          },
          type: 1,
        },
      }
      const { askAmount, bidAmount } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()

      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
    })

    it('omit some pricision on order amount of ask order', () => {
      const fixture = {
        bidOrderInfo: {
          capacity: BigInt('499999998871'),
          sudtAmount: BigInt('0'),
          orderAmount: BigInt('216554814'),
          price: {
            effect: BigInt(221558),
            exponent: BigInt(-2),
          },
          type: 0,
        },
        askOrderInfo: {
          capacity: BigInt('28616478064'),
          sudtAmount: BigInt('3595730'),
          orderAmount: BigInt('7759274960'),
          price: {
            effect: BigInt(221558),
            exponent: BigInt(-2),
          },
          type: 1,
        },
      }
      const { askAmount, bidAmount } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()

      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
    })

    it('edge case of trivial price', () => {
      const fixture = {
        bidOrderInfo: {
          capacity: BigInt('902700000000000000'),
          sudtAmount: BigInt('0'),
          orderAmount: BigInt('2001000000000'),
          price: { effect: BigInt('1111111110000000000'), exponent: BigInt(-20) },

          type: 0,
        },
        askOrderInfo: {
          capacity: BigInt('0'),
          sudtAmount: BigInt('10030000000'),
          orderAmount: BigInt('90000000000'),
          price: { effect: BigInt('1111111110000000000'), exponent: BigInt(-20) },
          type: 1,
        },
      }
      const { askAmount, bidAmount } = formatDealInfo(fixture.bidOrderInfo, fixture.askOrderInfo)
      expect(
        new BigNumber(askAmount.orderAmount.toString())
          .div(askAmount.costAmount.toString())
          .isEqualTo(getPrice(fixture.askOrderInfo.price)),
      ).toBeTruthy()

      expect(
        new BigNumber(bidAmount.costAmount.toString())
          .div(bidAmount.orderAmount.toString())
          .isEqualTo(getPrice(fixture.bidOrderInfo.price)),
      ).toBeTruthy()
    })
  })
})
