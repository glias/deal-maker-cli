# Deal Maker CLI

![](https://img.shields.io/badge/Platform-MacOS%20%7C%20Linux-brightgreen)
![](https://img.shields.io/badge/Node.js-v12-brightgreen)
![Unit Tests](https://github.com/glias/deal-maker-cli/workflows/Unit%20Tests/badge.svg)
[![codecov](https://codecov.io/gh/glias/deal-maker-cli/branch/develop/graph/badge.svg)](https://codecov.io/gh/glias/deal-maker-cli)
![SNYK](https://github.com/glias/deal-maker-cli/workflows/SNYK/badge.svg)

## Docs

- [Developer Guide](./docs/Developer.md)
- [Match Engine Detail](https://github.com/glias/deal-maker-cli/wiki/Deal-Maker-Matching-Details)

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

## Initialize Project

```bash
npm run init
```

## Start Deal Maker

```bash
npm run start:prod
```

## Open Web UI

Visit `http://localhost:3000`.
