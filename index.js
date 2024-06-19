const { Pair, Token, TokenAmount, Trade, JSBI, Percent } = require('@macarom/swap-sdk')
const { ethers } = require('ethers');
const fs = require('fs');
const { config, privateKey } = require('./config');
const { routerABI, pairABI, erc20ABI } = require('./lib/abi');
const { resolve } = require('path');
const { readFileOrCreate } = require('./lib/helper');
BigInt.prototype.toJSON = function() {
    return this.toString();
}
const logFile = fs.createWriteStream(config.logFilePath, { flags: 'a' });
const amountFilePath = resolve(__dirname, './amount.txt');
const provider = new ethers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(privateKey, provider);
const routerContract = new ethers.Contract(config.router_address, routerABI, wallet);

async function getAmountsOut(tokenIn, tokenOut, currencyAmountIn, currencyOut) {
    const pairAddress = tokenIn && tokenOut && !tokenIn.equals(tokenOut) ? Pair.getAddress(tokenIn, tokenOut) : undefined
    const pairContract = new ethers.Contract(pairAddress, pairABI, wallet);
    const reserves = await pairContract.getReserves()
    const [token0, token1] = tokenIn.sortsBefore(tokenOut) ? [tokenIn, tokenOut] : [tokenOut, tokenIn]
    const token0Reserve = reserves[0]
    const token1Reserve = reserves[1]
    // get pair
    const pair = new Pair(new TokenAmount(token0, token0Reserve), new TokenAmount(token1, token1Reserve))
    // get best trade info
    const trade = Trade.bestTradeExactIn([pair], currencyAmountIn, currencyOut, { maxHops: 1, maxNumResults: 1 })
    // computes the minimum amount out in for a trade given a user specified allowed slippage in bips
    const pct = new Percent(JSBI.BigInt(config.slipage), JSBI.BigInt(10000))
    const minAmountOut = trade[0].outputAmount.raw.toString() // before you set a slippage tolerance
    const minimumAmountOut = trade[0].minimumAmountOut(pct).raw.toString() // after you set a slippage tolerance
    return minimumAmountOut
}

async function approveToken(spender, currencyIn) {
    if(currencyIn.symbol === 'WBTC') {
        const tokenContract = new ethers.Contract(config.currency_in.address, erc20ABI, wallet);
        const allowance = await tokenContract.allowance(wallet.address, spender);
        if(allowance < 1) {
            const tx = await tokenContract.approve(spender, ethers.MaxUint256);
            await tx.wait();
            log(`Approved ${ethers.formatUnits(ethers.MaxUint256, config.currency_in.decimals)} ${config.currency_in.symbol} to ${spender}`);
        }
    } else {
        const tokenContract = new ethers.Contract(currencyIn.address, erc20ABI, wallet);
        const allowance = await tokenContract.allowance(wallet.address, spender);
        if(allowance < 1) {
            const tx = await tokenContract.approve(spender, ethers.MaxUint256);
            await tx.wait();
            log(`Approved ${ethers.formatUnits(ethers.MaxUint256, currencyIn.decimals)} ${currencyIn.symbol} to ${spender}`);
        }
    }
}

async function swapTokens() {
    //
    const balance = await provider.getBalance(wallet.address);
    log(`Your BTC balance: ${ethers.formatUnits(balance, 18)}`);
    if(ethers.formatUnits(balance, 18) < 0.00003) {
        log('Not enough BTC gas');
        return;
    }
    //
    const tokenAmount = Number(readFileOrCreate(amountFilePath, '0')) || 0;
    log(`Your token balance: ${tokenAmount}`);
    const { address: address1, decimals: decimals1, symbol: symbol1 } = config.currency_in
    const { address: address2, decimals: decimals2, symbol: symbol2 } = config.currency_out
    let amountIn = undefined
    let currencyIn = undefined
    let currencyOut = undefined
    if(tokenAmount > 0) { // sell token buy btc
        amountIn = ethers.parseUnits(tokenAmount, 18); // amountIn: token0 amount
        currencyIn = new Token(config.chain_id, address2, decimals2, symbol2, symbol2)
        currencyOut = new Token(config.chain_id, address1, decimals1, symbol1, symbol1)
    } else { // sell btc buy token
        const tokenContract = new ethers.Contract(config.currency_in.address, erc20ABI, wallet);
        const balance = await tokenContract.balanceOf(wallet.address);
        if(ethers.formatUnits(balance, 18) < config.amount_in) {
            log(`Not enough WBTC, Your WBTC balance: ${ethers.formatUnits(balance, 18)}`);
            return;
        }
        const amount = ethers.formatUnits(balance, 18) > config.amount_in ? config.amount_in : ethers.formatUnits(balance, 18);
        amountIn = ethers.parseUnits(amount); // amountIn: token0 amount
        currencyIn = new Token(config.chain_id, address1, decimals1, symbol1, symbol1)
        currencyOut = new Token(config.chain_id, address2, decimals2, symbol2, symbol2)
    }
    // Note: the second parameter of parseUnits represents the token's precision. Please confirm the precision values of the two tokens you are trading.
    const currencyInAmount = new TokenAmount(currencyIn, amountIn)
    const minAmountsOut = await getAmountsOut(currencyIn, currencyOut, currencyInAmount, currencyOut); // amountOutMin: the minimum amount of token1 you expect to receive
    // Parameter settings
    log("You will pay", ethers.formatUnits(amountIn, currencyIn.decimals), currencyIn.symbol);
    log("You will get at least ", ethers.formatUnits(minAmountsOut, currencyOut.decimals), currencyOut.symbol);

    const to = wallet.address; // recipient address (You can set it as your other address)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // Set transaction valid time (20 minutes later)
    await approveToken(config.router_address, currencyIn)

    const gas_limit = await routerContract.swapExactTokensForTokensSupportingFeeOnTransferTokens.estimateGas(
        amountIn,
        minAmountsOut,
        [
            currencyIn.address,
            currencyOut.address
        ],
        to,
        deadline
    );
    // Execute the transaction
    const tx = await routerContract.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        minAmountsOut,
        [
            currencyIn.address,
            currencyOut.address
        ],
        to,
        deadline,
        {
            gasLimit: gas_limit + 2133n
        }
    );

    log('Transaction hash:', tx.hash);

    // Wait for the transaction to complete
    const receipt = await tx.wait(1);
    // log('Transaction was mined in block', receipt.blockNumber);
    if(currencyOut.symbol === 'WBTC') {
        fs.writeFileSync(amountFilePath, '0');
    } else {
        fs.writeFileSync(amountFilePath, ethers.formatUnits(minAmountsOut, currencyOut.decimals));
    }
}

// Call the function to swap tokens
const times =  new Array(config.swaptime).fill(1).map((item, index) => { return index })
async function swap() {
    log(`Your address: ${wallet.address}`)
    log(`Config:`, config)
    log(`Start swapping tokens ${config.swaptime} times`)
    for(const time of times) {
        log(`==================== ${time + 1} ====================`)
        log(`Start swapping (${time + 1} / ${config.swaptime})...`)
        await swapTokens().catch((error) => {
            logError('Error swapping tokens:', error);
        });
        log(`Swap completed (${time + 1} / ${config.swaptime})`);
        log('Waiting for the next swap');
        await sleep(config.intervalDurationSeconds * 1000);
    }
}
swap()

function log(...args) {
    console.log(...args);
    args.forEach(arg => logFile.write(`${parseToString(arg)}\n`));
}

function logError(...args) {
    console.error(...args);
    logFile.write(`ERROR: ${args.map(v => v.toString()).join('\n')}\n`);
}

function parseToString(value) {
    if(typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
