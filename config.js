require('dotenv').config();
const { resolve } = require('path');
const privateKey = process.env.PRIV_KEY;
if(!privateKey) {
    console.error('Please set your private key in .env file');
    process.exit(1);
}

// We use the bitlayer test network and macaron test environment to configure the configuration. You need to change it to the mainnet environment.
const config = {
  rpc: 'https://rpc.bitlayer.org', // this is test rpc, you can change to mainnet
  chain_id: 200901, // this is test chainId, you can change to mainnet
  slipage: 50, // 0.5%
  router_address: '0xB0Cc30795f9E0125575742cFA8e73D20D9966f81', // this is test router address, you can change to mainnet
  amount_in: "0.000005", // amountIn: 0.000005 WBTC
  currency_in: {
      address: '0xfF204e2681A6fA0e2C3FaDe68a1B28fb90E4Fc5F', // the token you want to pay, this is test test token, you can change to mainnet token
      decimals: 18,
      symbol: "WBTC"
  },
  currency_out: {
      address: '0xa1e63CB2CE698CfD3c2Ac6704813e3b870FEDADf',  // the token you want to receive, this is test test token, you can change to mainnet token
      decimals: 18,
      symbol: "SAT"
  },
  swaptime: 1, // swap times
  intervalDurationSeconds: 10,
  logFilePath: resolve(__dirname, `./swap-token-${new Date().toLocaleTimeString()}.log`),
}

module.exports = {config, privateKey};