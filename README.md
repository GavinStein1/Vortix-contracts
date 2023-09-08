# zkSync Hardhat project

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

## Project structure

- `/contracts`: smart contracts.
- `/deploy`: deployment and contract interaction scripts.
- `/test`: test files
- `hardhat.config.ts`: configuration file.

## Commands

- `npx hardhat compile` will compile the contracts.
- `npm run test` will test the contracts against a locally running node. Make sure you have ran the `era_test_node run` command in a separate console prior to running this command.
- `npm run testnet` will test the contracts on a public testnet.

### Environment variables

In order to prevent users to leak private keys, this project includes the `dotenv` package which is used to load environment variables. It's used to load the wallet private key, and contract addresses.

```
WALLET_PRIVATE_KEY=123cde574ccff.... (this is jsut an example)
```

## Official Links

- [Website](https://zksync.io/)
- [Documentation](https://v2-docs.zksync.io/dev/)
- [GitHub](https://github.com/matter-labs)
- [Twitter](https://twitter.com/zksync)
- [Discord](https://discord.gg/nMaPGrDDwk)
