# Deal Maker CLI Manual for Developers

## Prerequisite

## Node.js

Follow the [guide](https://nodejs.org/en/download/) to install Node.js.

## How to start development

### Set environment variables

```bash
cp ormconfig.yml.example ormconfig.yml
cp .env.example .env
```

### Install Dependencies

```bash
npm install
```

### Start Watching Mode

```bash
npm run start:watch
```

### View Config

```bash
npm run start:config
```

### Start with any sub-command

```bash
npx cross-env NODE_ENV=development ts-node src/cli [sub-command]
# npx cross-env NODE_ENV=development ts-node src/cli config --url http://localhost:8115
```

## Modules

### CLI Controller

Cli configuration is set in the `src/cli` module

### Pool Service

Pool service has two main jobs:

1. Update liquidity orders;
2. Match providing/extracting liquidity orders.

### Orders Service

Orders service has two main jobs:

1. Update ask/bid orders;
2. Match ask/bid orders.

### Tasks Service

Tasks service handles cron jobs:

1. Synchronize blocks and call other services to update database;
2. Send transactions to match orders.

### Statistics Service

### Config Service

Config service is used to store configuration of the cli app, including:

1. remote url: the url of perkins-tent service;
2. token pairs: the target token pairs to match;
3. fee rate: the fee rate used in matching;
4. key file: the file storing private key which is used in sending transaction;

## Module Container

Deal Maker uses a Service Container `src/container` to manage services and each service can be injected as follows:

```typescript
class TasksService {
  constructor(
    @inject(new LazyServiceIdentifer(() => modules[PoolService.name])) poolService: PoolService,
    @inject(new LazyServiceIdentifer(() => modules[OrdersService.name])) ordersService: OrdersService,
  ) {
    this.#poolService = poolService
    this.#ordersService = ordersService
  }
}
```
