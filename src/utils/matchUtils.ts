import { MATCH_ORDERS_CELL_DEPS, FEE, FEE_RATIO } from './conts'
import { formatOrderData } from './parser'
export const getMatchOrdersTx = (
  inputs: CKBComponents.CellInput[],
  outputs: CKBComponents.CellOutput[],
  witnesses: (CKBComponents.Witness | CKBComponents.WitnessArgs)[],
  outputsData: string[],
): CKBComponents.RawTransactionToSign => ({
  version: '0x0',
  headerDeps: [],
  cellDeps: MATCH_ORDERS_CELL_DEPS,
  inputs,
  witnesses,
  outputs,
  outputsData,
})

export const getMatchedOrder = (
  type: 'ask' | 'bid',
  { cost, spend, amount, base, price }: Record<'price' | 'cost' | 'spend' | 'base' | 'amount', bigint>,
) => {
  const fee = (cost * FEE) / FEE_RATIO
  const remain = spend - cost - fee
  const final = base + amount
  if (type === 'bid') {
    return { capacity: `0x${remain.toString(16)}`, data: formatOrderData(final, BigInt('0'), price, '00'), fee }
  }
  return { capacity: `0x${final.toString(16)}`, data: formatOrderData(remain, BigInt('0'), price, '01'), fee }
}
