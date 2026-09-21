// SPDX-License-Identifier: MIT
// submit.ts - Safe ERG transfer action

import {
    OutputBuilder,
    SAFE_MIN_BOX_VALUE,
    RECOMMENDED_MIN_FEE_VALUE,
    TransactionBuilder,
    type InputBox,
} from '@fleet-sdk/core';

type SignedTransaction = unknown;

type ErgoWalletApi = {
    get_change_address(): Promise<string>;
    get_current_height(): Promise<number>;
    get_utxos(): Promise<InputBox[]>;
    sign_tx(transaction: unknown): Promise<SignedTransaction>;
    submit_tx(transaction: SignedTransaction): Promise<string>;
};

// The wallet connector is injected by Nautilus/SAFEW in the browser.
declare const ergo: ErgoWalletApi;

export class ErgoTransferError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'ErgoTransferError';
    }
}

let submissionInProgress = false;

function getWallet(): ErgoWalletApi {
    if (typeof ergo === 'undefined' || !ergo) {
        throw new ErgoTransferError(
            'Conecte uma carteira Ergo antes de enviar ERG.',
            'WALLET_NOT_CONNECTED',
        );
    }

    return ergo;
}

function validateAddress(address: string): void {
    // Ergo addresses are Base58 encoded and start with 1 (P2PK), 2 (P2SH),
    // or 3 (P2S). The exact checksum is verified by the wallet when signing.
    const base58Address = /^[123][1-9A-HJ-NP-Za-km-z]{20,}$/;

    if (!address || address.trim() !== address || !base58Address.test(address)) {
        throw new ErgoTransferError(
            'O endereço de destino não é um endereço Ergo válido.',
            'INVALID_ADDRESS',
        );
    }
}

function validateAmount(amount: bigint, fee: bigint): void {
    if (typeof amount !== 'bigint' || amount <= 0n) {
        throw new ErgoTransferError(
            'O valor da transferência deve ser maior que zero.',
            'INVALID_AMOUNT',
        );
    }

    if (amount < SAFE_MIN_BOX_VALUE) {
        throw new ErgoTransferError(
            `O valor deve ser de pelo menos ${SAFE_MIN_BOX_VALUE} nanoERG.`,
            'AMOUNT_BELOW_MINIMUM',
        );
    }

    if (fee <= 0n) {
        throw new ErgoTransferError('A taxa deve ser maior que zero.', 'INVALID_FEE');
    }
}

/**
 * Selects the smallest practical set of UTXOs that covers the payment and fee.
 * If the remaining value would be a dust change box, one more UTXO is added.
 */
export function selectInputs(
    inputs: InputBox[],
    amount: bigint,
    fee: bigint,
): InputBox[] {
    const sorted = [...inputs].sort((a, b) => Number(BigInt(a.value) - BigInt(b.value)));
    const selected: InputBox[] = [];
    let selectedValue = 0n;

    for (const input of sorted) {
        selected.push(input);
        selectedValue += BigInt(input.value);

        const remaining = selectedValue - amount - fee;
        if (remaining >= 0n && (remaining === 0n || remaining >= SAFE_MIN_BOX_VALUE)) {
            return selected;
        }
    }

    throw new ErgoTransferError(
        'Saldo insuficiente para cobrir o valor e a taxa da transação.',
        'INSUFFICIENT_FUNDS',
    );
}

/**
 * Sends ERG to a target address.
 *
 * Errors are intentionally thrown so the UI can distinguish wallet rejection,
 * validation errors, and insufficient funds instead of receiving a generic null.
 */
export async function submit(
    targetAddress: string,
    amount: bigint,
    fee: bigint = RECOMMENDED_MIN_FEE_VALUE,
): Promise<string> {
    if (submissionInProgress) {
        throw new ErgoTransferError(
            'Já existe uma transferência em andamento.',
            'SUBMISSION_IN_PROGRESS',
        );
    }

    validateAddress(targetAddress);
    validateAmount(amount, fee);

    const wallet = getWallet();
    submissionInProgress = true;

    try {
        const [changeAddress, creationHeight, walletInputs] = await Promise.all([
            wallet.get_change_address(),
            wallet.get_current_height(),
            wallet.get_utxos(),
        ]);

        if (!changeAddress) {
            throw new ErgoTransferError(
                'A carteira não forneceu um endereço de troco.',
                'MISSING_CHANGE_ADDRESS',
            );
        }

        if (!walletInputs?.length) {
            throw new ErgoTransferError(
                'Nenhum UTXO disponível na carteira.',
                'NO_UTXOS',
            );
        }

        const inputs = selectInputs(walletInputs, amount, fee);
        const unsignedTx = new TransactionBuilder(creationHeight)
            .from(inputs)
            .to(new OutputBuilder(amount, targetAddress))
            .sendChangeTo(changeAddress)
            .payFee(fee)
            .build();

        const signedTx = await wallet.sign_tx(unsignedTx.toEIP12Object());
        const txId = await wallet.submit_tx(signedTx);

        if (!txId) {
            throw new ErgoTransferError(
                'A carteira não retornou o ID da transação.',
                'MISSING_TRANSACTION_ID',
            );
        }

        return txId;
    } catch (error) {
        if (error instanceof ErgoTransferError) throw error;

        // Do not log signed transactions or UTXOs. Wallet errors may contain a
        // useful user-facing message (for example, when signing is rejected).
        const message = error instanceof Error ? error.message : 'Falha ao enviar a transação.';
        throw new ErgoTransferError(message, 'TRANSACTION_FAILED', { cause: error });
    } finally {
        submissionInProgress = false;
    }
}
