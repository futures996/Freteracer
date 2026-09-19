// SPDX-License-Identifier: MIT
// submit.ts - Simple ERG transfer action

import {
    OutputBuilder,
    SAFE_MIN_BOX_VALUE,
    RECOMMENDED_MIN_FEE_VALUE,
    TransactionBuilder,
    type InputBox,
} from '@fleet-sdk/core';

// Ensure the global 'ergo' variable (from the wallet connector) is available.
declare var ergo: any;

/**
 * Sends ERG to a target address.
 * @param targetAddress - The Ergo address to receive the funds.
 * @param amount - Amount in nanoERG to send (must be >= SAFE_MIN_BOX_VALUE).
 * @returns Transaction ID if successful, otherwise null.
 */
export async function submit(
    targetAddress: string,
    amount: bigint,
): Promise<string | null> {
    console.log('🚀 Starting ERG transfer', { targetAddress, amount: amount.toString() });

    try {
        // 1. Gather wallet data
        console.log('Fetching wallet data...');
        const changeAddress = await ergo.get_change_address();
        if (!changeAddress) {
            throw new Error('Could not get the change address from the wallet.');
        }
        console.log(`Change address: ${changeAddress}`);

        const creationHeight = await ergo.get_current_height();
        console.log(`Current blockchain height: ${creationHeight}`);

        const inputs: InputBox[] = await ergo.get_utxos();
        if (!inputs || inputs.length === 0) {
            throw new Error('No UTXOs found in the wallet for the transaction.');
        }
        const totalInputValue = inputs.reduce((sum, box) => sum + BigInt(box.value), 0n);
        console.log(`Found ${inputs.length} UTXOs with total value ${totalInputValue} nanoERG.`);

        // 2. Build the output box for the transfer
        if (amount < SAFE_MIN_BOX_VALUE) {
            throw new Error(`Amount must be at least ${SAFE_MIN_BOX_VALUE} nanoERG (minimum box value).`);
        }
        const paymentOutput = new OutputBuilder(amount, targetAddress);
        console.log('Payment output built.');

        // 3. Build and sign the transaction
        const unsignedTx = new TransactionBuilder(creationHeight)
            .from(inputs)
            .to(paymentOutput)
            .sendChangeTo(changeAddress)
            .payFee(RECOMMENDED_MIN_FEE_VALUE)
            .build();
        console.log('Unsigned transaction (Fleet SDK):', unsignedTx);

        const txToSign = unsignedTx.toEIP12Object();
        console.log('Unsigned transaction (EIP-12):', txToSign);

        console.log('Requesting signature from wallet...');
        const signedTx = await ergo.sign_tx(txToSign);
        console.log('Transaction signed:', signedTx);

        console.log('Submitting transaction to network...');
        const txId = await ergo.submit_tx(signedTx);
        console.log(`✅ Transaction submitted! ID: ${txId}`);
        return txId;
    } catch (error) {
        console.error('❌ Error during ERG transfer');
        if (error instanceof Error) {
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
        console.error('Full error object:', error);
        return null;
    }
}
