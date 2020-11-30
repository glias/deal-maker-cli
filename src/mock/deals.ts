import { DealStatus, Deal } from '../modules/orders/deal.entity'

type MockDeal = Omit<Deal, 'createdAt'>

export const pendingDeal: MockDeal = {
  txHash: '0x0000',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  orderIds: '0x00-0x0,0x00-0x1,0x00-0x2',
  fee: '10',
  dealMakerCell: '0x0:0x0',
  ckbProfit: '10',
  sudtProfit: '10',
  status: DealStatus.Pending,
}

export const pendingDeal_1: MockDeal = {
  txHash: '0x0001',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  orderIds: '0x00-0x3,0x00-0x4,0x00-0x5',
  fee: '10',
  dealMakerCell: '0x0:0x0',
  ckbProfit: '10',
  sudtProfit: '10',
  status: DealStatus.Pending,
}

export const doneDeal: MockDeal = {
  txHash: '0x1111',
  tokenId: '0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902',
  orderIds: '0x01-0x0,0x01-0x1,0x02-0x2',
  fee: '20',
  dealMakerCell: '0x0:0x0',
  ckbProfit: '10',
  sudtProfit: '10',
  status: DealStatus.Done,
}
