import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
    DEFAULT_EXPLORER_URI_TX,
    DEFAULT_EXPLORER_URI_TOKEN,
    DEFAULT_EXPLORER_URI_ADDR
} from './constants';

export interface UserToken {
    address: string;
    symbol: string;
    name?: string;
    decimals?: number;
    balance?: string;
}

// Wallet stores
export const address = writable<string | null>(null);
export const network = writable<string | null>(null);
export const connected = writable(false);
export const balance = writable<number | null>(null);

// Token cache for user tokens
export const user_tokens = writable<Map<string, UserToken>>(new Map());

// Helper function to create a persistent store
function createPersistentStore<T>(
    key: string,
    defaultValue: T
): Writable<T> {
    let initialValue = defaultValue;

    if (browser) {
        try {
            const storedValue = localStorage.getItem(key);

            if (
                storedValue &&
                storedValue !== 'undefined' &&
                storedValue !== 'null'
            ) {
                initialValue = JSON.parse(storedValue) as T;
            }
        } catch (error) {
            console.warn(
                `Não foi possível ler o valor persistido para "${key}".`,
                error
            );

            localStorage.removeItem(key);
        }
    }

    const store = writable<T>(initialValue);

    if (browser) {
        store.subscribe((value) => {
            try {
                if (value === undefined) {
                    localStorage.removeItem(key);
                    return;
                }

                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn(
                    `Não foi possível salvar o valor persistido para "${key}".`,
                    error
                );
            }
        });
    }

    return store;
}

// Web Explorer URI stores with persistence
export const web_explorer_uri_tx = createPersistentStore(
    'web_explorer_uri_tx',
    DEFAULT_EXPLORER_URI_TX
);

export const web_explorer_uri_token = createPersistentStore(
    'web_explorer_uri_token',
    DEFAULT_EXPLORER_URI_TOKEN
);

export const web_explorer_uri_addr = createPersistentStore(
    'web_explorer_uri_addr',
    DEFAULT_EXPLORER_URI_ADDR
);
