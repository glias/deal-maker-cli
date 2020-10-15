import { injectable } from 'inversify'
import { EntityRepository, Repository } from 'typeorm'
import { Order } from './order.entity'

@injectable()
@EntityRepository(Order)
class OrderRepository extends Repository<Order> {}

export default OrderRepository
