import { stringToBytes } from "@scure/base";
import {
    ErgoAddress, SByte, SColl, SConstant, SGroupElement,
    type Box,
    type InputBox,
    type Amount,
    type TokenEIP4 // <-- Importar TokenEIP4
} from '@fleet-sdk/core';
import type { GameContent } from "../common/game"; // <-- Importar GameContent

export function hexToUtf8(hexString: string): string | null {
    try {
        if (hexString.length % 2 !== 0) {
            return null;
        }
    
        const byteArray = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const decoder = new TextDecoder('utf-8');
        const utf8String = decoder.decode(byteArray);
    
        return utf8String;
    } catch {
        return null;
    }
  }

export function generate_pk_proposition(wallet_pk: string): string {
    const pk = ErgoAddress.fromBase58(wallet_pk).getPublicKeys()[0];
    const encodedProp = SGroupElement(pk);
    return encodedProp.toHex();
}

export function SString(value: string): string {
    return SConstant(SColl(SByte, stringToBytes('utf8', value)));
}

export function uint8ArrayToHex(array: Uint8Array): string { 
    return [...new Uint8Array(array)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export function parseLongColl(renderedValue: any): bigint[] | null {
    if (!Array.isArray(renderedValue)) {
        return null;
    }
    try {
        return renderedValue.map(item => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'bigint') {
                return BigInt(item);
            }
            throw new Error(`No se puede convertir el item '${item}' a BigInt.`);
        });
    } catch (e) {
        console.error("parseLongColl: Error convirtiendo items a BigInt:", renderedValue, e);
        return null;
    }
}

export function hexToBytes(hexString: string | undefined | null): Uint8Array | null {
    if (!hexString || typeof hexString !== 'string' || !/^[0-9a-fA-F]*$/.test(hexString)) {
        return null;
    }
    if (hexString.length % 2 !== 0) {
        return null; 
    }
    try {
        const byteArray = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < byteArray.length; i++) {
            const byte = parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
            if (isNaN(byte)) {
                throw new Error("Se encontró un carácter hexadecimal inválido durante el parseInt.");
            }
            byteArray[i] = byte;
        }
        return byteArray;
    } catch (e) {
        console.error("hexToBytes: Error convirtiendo hex a bytes:", hexString, e);
        return null;
    }
}

export function parseIntFromRendered(renderedValue: any): number | null {
    if (renderedValue === null || renderedValue === undefined) return null;

    if (typeof renderedValue === 'number') {
        return Number.isFinite(renderedValue) ? renderedValue : null;
    }
    if (typeof renderedValue === 'string') {
        const num = parseInt(renderedValue, 10);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

export function parseCollByteToHex(renderedValue: any): string | null {
    if (renderedValue === null || renderedValue === undefined) return null;

    if (Array.isArray(renderedValue) && renderedValue.every(item => typeof item === 'number' && item >= 0 && item <= 255)) {
        try {
            return uint8ArrayToHex(new Uint8Array(renderedValue));
        } catch (e) {
            console.error("parseCollByteToHex: Error convirtiendo array de bytes a hex:", renderedValue, e);
            return null;
        }
    }
    if (typeof renderedValue === 'string') {
        const cleanedHex = renderedValue.startsWith('0x') ? renderedValue.substring(2) : renderedValue;
        if (/^[0-9a-fA-F]*$/.test(cleanedHex) && cleanedHex.length % 2 === 0) {
            return cleanedHex;
        }
    }
    return null;
}

export function parseIntFromHex(renderedValue: any): number | null {
    if (typeof renderedValue !== 'string' && typeof renderedValue !== 'number') return null;
    try {
        if (typeof renderedValue === 'number') return renderedValue;
        const num = parseInt(renderedValue, 10);
        return isNaN(num) ? null : num;
    } catch (e) { return null; }
}

export function utf8StringToCollByteHex(inputString: string): string {
    const bytes = stringToBytes('utf8', inputString);
    return SColl(SByte, bytes).toHex();
}

export function bigintToLongByteArray(value: bigint): Uint8Array {
    const MIN_LONG = -(2n ** 63n);
    const MAX_LONG = (2n ** 63n) - 1n;

    if (value < MIN_LONG || value > MAX_LONG) {
        throw new Error(`Valor ${value} está fuera del rango para un Long de 64 bits con signo.`);
    }

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigInt64(0, value, false);

    return new Uint8Array(buffer);
}

export function parseBox(e: Box<Amount>): InputBox {
    return {
        boxId: e.boxId,
        value: e.value,
        assets: e.assets,
        ergoTree: e.ergoTree,
        creationHeight: e.creationHeight,
        additionalRegisters: Object.entries(e.additionalRegisters).reduce((acc, [key, value]) => {
            acc[key] = value.serializedValue;
            return acc;
        }, {} as { [key: string]: string; }),
        index: e.index,
        transactionId: e.transactionId
    };
}

/**
 * Parsea los detalles del contenido de un juego a partir de un string JSON.
 * @param rawJsonDetails String JSON con los detalles del juego (de R9).
 * @param gameBoxId El ID de la caja, usado como identificador de respaldo.
 * @param nft Datos opcionales del token EIP-4 del NFT del juego.
 * @returns El objeto GameContent parseado.
 */
export function parseGameContent(
    rawJsonDetails: string | undefined | null,
    gameBoxId: string, 
    nft?: TokenEIP4
): GameContent {
    const defaultImageUrl = [
        "https://images5.alphacoders.com/136/thumb-1920-1364878.png",
        "https://backiee.com/static/wallpapers/560x315/302851.jpg",
        "https://wallpaperaccess.com/full/5027932.png",
        "https://wallpaperaccess.com/full/6273500.jpg"
    ][rawJsonDetails?.length % 4];
    const defaultTitle = nft?.name || `Game ${gameBoxId.slice(0, 8)}`;
    const defaultDescription = nft?.description || "No description provided.";
    let content: GameContent = {
        rawJsonString: rawJsonDetails || "{}",
        title: defaultTitle,
        description: defaultDescription,
        serviceId: ""
    };

    if (rawJsonDetails) {
        try {
            const parsed = JSON.parse(rawJsonDetails);
            content = {
                ...content,
                title: parsed.title || defaultTitle,
                description: parsed.description || defaultDescription,
                serviceId: parsed.serviceId || "",
                imageURL: parsed.imageURL || parsed.image || defaultImageUrl,
                webLink: parsed.webLink || parsed.link || undefined,
                mirrorUrls: parsed.mirrorUrls || undefined,
            };
        } catch (error) {
            console.warn(`Error al parsear rawJsonDetails para el juego ${gameBoxId}. Usando valores por defecto. Error: ${error}`);
        }
    }
    
    return content;
}

export function pkHexToBase58Address(pkHex?: string): string {
    if (!pkHex) return "N/A";
    try {
        const pkBytes = hexToBytes(pkHex);
        if (!pkBytes) return "Invalid PK";
        return ErgoAddress.fromPublicKey(pkBytes).toString();
    } catch { return "Invalid PK"; }
}