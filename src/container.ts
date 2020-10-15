import { Container } from 'inversify'
export const modules: Record<string, symbol> = {}
export const container = new Container({ defaultScope: 'Singleton' })
