import { stringToBytes } from "@scure/base";
import {
    ErgoAddress, SByte, SColl, SConstant, SGroupElement,
    type Box,
    type InputBox,
    type Amount,
    type TokenEIP4
} from '@fleet-sdk/core';
import type { GameContent } from "../common/game";

const HEX_PATTERN = /^[0-9a-fA-F]*$/;
const LONG_MIN = -(2n ** 63n);
const LONG_MAX = (2n ** 63n) - 1n;
const DEFAULT_GAME_IMAGES = [
    "https://images5.alphacoders.com/136/thumb-1920-1364878.png",
    "https://backiee.com/static/wallpapers/560x315/302851.jpg",
    "https://wallpaperaccess.com/full/5027932.png",
    "https://wallpaperaccess.com/full/6273500.jpg"
] as const;

function normalizeHex(value: string, allowPrefix = false): string | null {
    const normalized = allowPrefix && value.startsWith('0x') ? value.slice(2) : value;

    if (normalized.length % 2 !== 0 || !HEX_PATTERN.test(normalized)) {
        return null;
    }

    return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function hexToUtf8(hexString: string): string | null {
    const bytes = hexToBytes(hexString);
    if (bytes === null) return null;

    try {
        // fatal evita aceitar silenciosamente sequências UTF-8 inválidas.
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
}

export function generate_pk_proposition(wallet_pk: string): string {
    const publicKey = ErgoAddress.fromBase58(wallet_pk).getPublicKeys()[0];
    if (!publicKey) {
        throw new Error('A carteira não contém uma chave pública.');
    }

    return SGroupElement(publicKey).toHex();
}

export function SString(value: string): string {
    return SConstant(SColl(SByte, stringToBytes('utf8', value)));
}

export function uint8ArrayToHex(array: Uint8Array): string {
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function parseLongColl(renderedValue: unknown): bigint[] | null {
    if (!Array.isArray(renderedValue)) return null;

    const result: bigint[] = [];
    for (const item of renderedValue) {
        if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'bigint') {
            return null;
        }

        try {
            result.push(BigInt(item));
        } catch {
            return null;
        }
    }

    return result;
}

export function hexToBytes(hexString: string | undefined | null): Uint8Array | null {
    if (typeof hexString !== 'string') return null;

    const normalized = normalizeHex(hexString);
    if (normalized === null) return null;

    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
    }

    return bytes;
}

export function parseIntFromRendered(renderedValue: unknown): number | null {
    if (typeof renderedValue === 'number') {
        return Number.isSafeInteger(renderedValue) ? renderedValue : null;
    }

    if (typeof renderedValue !== 'string' || !/^[+-]?\d+$/.test(renderedValue.trim())) {
        return null;
    }

    const number = Number(renderedValue);
    return Number.isSafeInteger(number) ? number : null;
}

export function parseCollByteToHex(renderedValue: unknown): string | null {
    if (Array.isArray(renderedValue)) {
        if (!renderedValue.every(
            (item): item is number => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 255
        )) {
            return null;
        }

        return uint8ArrayToHex(new Uint8Array(renderedValue));
    }

    if (typeof renderedValue !== 'string') return null;
    return normalizeHex(renderedValue, true);
}

/**
 * Parses the decimal representation used by rendered Ergo values.
 * The 0x prefix is also accepted for compatibility with hexadecimal inputs.
 */
export function parseIntFromHex(renderedValue: unknown): number | null {
    if (typeof renderedValue === 'number') {
        return Number.isSafeInteger(renderedValue) ? renderedValue : null;
    }
    if (typeof renderedValue !== 'string') return null;

    const value = renderedValue.trim();
    const number = /^0x[0-9a-f]+$/i.test(value)
        ? Number.parseInt(value.slice(2), 16)
        : /^[+-]?\d+$/.test(value)
            ? Number(value)
            : Number.NaN;

    return Number.isSafeInteger(number) ? number : null;
}

export function utf8StringToCollByteHex(inputString: string): string {
    const bytes = stringToBytes('utf8', inputString);
    return SColl(SByte, bytes).toHex();
}

export function bigintToLongByteArray(value: bigint): Uint8Array {
    if (value < LONG_MIN || value > LONG_MAX) {
        throw new Error(`Valor ${value} está fuera del rango para un Long de 64 bits con signo.`);
    }

    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, value, false); // big-endian, conforme ao protocolo.
    return new Uint8Array(buffer);
}

export function parseBox(e: Box<Amount>): InputBox {
    return {
        boxId: e.boxId,
        value: e.value,
        assets: e.assets,
        ergoTree: e.ergoTree,
        creationHeight: e.creationHeight,
        additionalRegisters: Object.fromEntries(
            Object.entries(e.additionalRegisters).map(([key, value]) => [key, value.serializedValue])
        ),
        index: e.index,
        transactionId: e.transactionId
    };
}

/** Parses game metadata from the R9 JSON register, applying safe defaults. */
export function parseGameContent(
    rawJsonDetails: string | undefined | null,
    gameBoxId: string,
    nft?: TokenEIP4
): GameContent {
    const rawJsonString = rawJsonDetails || "{}";
    const defaultImageUrl = DEFAULT_GAME_IMAGES[rawJsonString.length % DEFAULT_GAME_IMAGES.length];
    const defaultTitle = nft?.name || `Game ${gameBoxId.slice(0, 8)}`;
    const defaultDescription = nft?.description || "No description provided.";

    const content: GameContent = {
        rawJsonString,
        title: defaultTitle,
        description: defaultDescription,
        serviceId: ""
    };

    if (!rawJsonDetails) return content;

    try {
        const parsed: unknown = JSON.parse(rawJsonDetails);
        if (!isRecord(parsed)) return content;

        const title = nonEmptyString(parsed.title);
        const description = nonEmptyString(parsed.description);
        const serviceId = nonEmptyString(parsed.serviceId);
        const imageURL = nonEmptyString(parsed.imageURL) || nonEmptyString(parsed.image);
        const webLink = nonEmptyString(parsed.webLink) || nonEmptyString(parsed.link);
        const mirrorUrls = Array.isArray(parsed.mirrorUrls)
            ? parsed.mirrorUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
            : undefined;

        return {
            ...content,
            title: title || defaultTitle,
            description: description || defaultDescription,
            serviceId: serviceId || "",
            imageURL: imageURL || defaultImageUrl,
            webLink,
            mirrorUrls
        };
    } catch {
        return content;
    }
}

export function pkHexToBase58Address(pkHex?: string): string {
    if (!pkHex) return "N/A";

    const pkBytes = hexToBytes(pkHex);
    if (!pkBytes) return "Invalid PK";

    try {
        return ErgoAddress.fromPublicKey(pkBytes).toString();
    } catch {
        return "Invalid PK";
    }
}
