# Deal Maker Cli

![](https://img.shields.io/badge/Platform-MacOS%20%7C%20Linux-brightgreen)
![](https://img.shields.io/badge/Node.js-v12-brightgreen)
![Unit Tests](https://github.com/glias/deal-maker-cli/workflows/Unit%20Tests/badge.svg)
[![codecov](https://codecov.io/gh/glias/deal-maker-cli/branch/develop/graph/badge.svg)](https://codecov.io/gh/glias/deal-maker-cli)
![SNYK](https://github.com/glias/deal-maker-cli/workflows/SNYK/badge.svg)

## Node.js

Node.js 12 is required

```bash
nvm use 12
```

## Install Dependencies

```bash
npm install
```

## Set Database Configuration

```bash
cp ormconfig.yml.example ormconfig.yml
```

## Generate Migration

```bash
npm run db:init
```

A migration named `CreateDatabase` should be created in `src/migrations`.

## Compile

```bash
npm run build
```

## Start Deal Maker

```bash
npm run start:prod
```

## Open Web UI

Visit `http://localhost:3000`.
