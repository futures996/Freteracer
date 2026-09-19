<script lang="ts">
    import { onMount } from "svelte";
    import { connected, balance, web_explorer_uri_addr, address, network, user_tokens } from "$lib/common/store";
    import { browser } from "$app/environment";
    import Theme from "./Theme.svelte";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { submit } from "$lib/ergo/actions/submit";
    import { explorer_uri } from "$lib/ergo/envs";

    // Import advanced wallet components
    import SettingsModal from "$lib/components/SettingsModal.svelte";
    import { walletAddress, walletBalance, WalletButton, walletConnected } from "wallet-svelte-component";
      import { WalletAddressChangeHandler } from 'wallet-svelte-component';
    import { get } from "svelte/store";

    // --- Estado de la UI ---
    let current_height: number | null = null;
    let balanceUpdateInterval: number;
    let showSettingsModal = false;

    // --- Estado del formulario de acuñación ---
    let targetAddress = "";
    let amountStr = "";

    // --- Estado de la transacción ---
    let isLoading = false;
    let transactionId: string | null = null;
    let errorMessage: string | null = null;

    // --- Lógica del KYA (Know Your Assumptions) ---
    // Reactive calculation of total token supply for user preview
    // No total supply preview needed for ERG transfer
    // $: totalSupply =
    //     amountStr && decimalsStr
    //         ? (Number(amountStr) / Math.pow(10, Number(decimalsStr))).toFixed(
    //               Number(decimalsStr),
    //           )
    //         : "";

    let showKyaModal = false;
    let isKyaButtonEnabled = false;
    let kyaContentDiv: HTMLDivElement;

    // --- Lógica del Footer ---
    const footerMessages = [
        "This app is a fully decentralized application. It runs locally in your browser.",
        "Your keys never leave your wallet. You are in full control of your assets.",
        "Powered by the Ergo Blockchain, ensuring security and no fees.",
    ];
    let activeMessageIndex = 0;
    let scrollingTextElement: HTMLElement;

    function handleAnimationIteration() {
        activeMessageIndex = (activeMessageIndex + 1) % footerMessages.length;
    }

    function checkKyaScroll(e: Event) {
        const element = e.target as HTMLDivElement;
        if (
            Math.abs(
                element.scrollHeight - element.clientHeight - element.scrollTop,
            ) < 5
        ) {
            isKyaButtonEnabled = true;
        }
    }

    async function get_current_height(): Promise<number> {
        try {
            return await ergo.get_current_height();
        } catch {
            try {
                const response = await fetch(
                    explorer_uri + "/api/v1/networkState",
                );
                if (!response.ok)
                    throw new Error(`API request failed: ${response.status}`);
                const data = await response.json();
                return data.height;
            } catch (error) {
                console.error(
                    "Could not get network height from the API:",
                    error,
                );
                throw new Error("Cannot get current height.");
            }
        }
    }

    async function get_balance(id?: string): Promise<Map<string, number>> {
        const balanceMap = new Map<string, number>();
        const addr = await ergo.get_change_address();
        if (!addr)
            throw new Error("An address is required to get the balance.");

        try {
            const response = await fetch(
                explorer_uri + `/api/v1/addresses/${addr}/balance/confirmed`,
            );
            if (!response.ok)
                throw new Error(`API request failed: ${response.status}`);
            const data = await response.json();
            balanceMap.set("ERG", data.nanoErgs);
            balance.set(data.nanoErgs);
            data.tokens.forEach(
                (token: { tokenId: string; amount: number }) => {
                    balanceMap.set(token.tokenId, token.amount);
                },
            );
        } catch (error) {
            console.error(`Could not get balance for address ${addr}:`, error);
            throw new Error("Cannot get balance.");
        }
        return balanceMap;
    }

    function handleOpenKyaModal() {
        showKyaModal = true;
        isKyaButtonEnabled = false;
        setTimeout(() => {
            if (
                kyaContentDiv &&
                kyaContentDiv.scrollHeight <= kyaContentDiv.clientHeight
            ) {
                isKyaButtonEnabled = true;
            }
        }, 0);
    }

    function handleCloseKyaModal() {
        showKyaModal = false;
        localStorage.setItem("acceptedTokenMinterKYA", "true");
    }

    onMount(async () => {
        if (!browser) return;

        const alreadyAccepted =
            localStorage.getItem("acceptedTokenMinterKYA") === "true";
        if (!alreadyAccepted) {
            handleOpenKyaModal();
        }

        // The new wallet system handles auto-reconnection automatically

        balanceUpdateInterval = setInterval(updateWalletInfo, 30000);

        scrollingTextElement?.addEventListener(
            "animationiteration",
            handleAnimationIteration,
        );

        return () => {
            if (balanceUpdateInterval) clearInterval(balanceUpdateInterval);
            scrollingTextElement?.removeEventListener(
                "animationiteration",
                handleAnimationIteration,
            );
        };
    });

    connected.subscribe(async (isConnected) => {
        if (isConnected) {
            await updateWalletInfo();
        }
    });

    // Subscribe to new wallet system instead of old connected store
    walletConnected.subscribe(async (isConnected) => {
        console.log("Wallet connection state changed:", isConnected);
        if (isConnected) {
            // Sync old stores with new wallet system for backward compatibility
            const walletAddr = get(walletAddress);
            const walletBal = get(walletBalance);

            address.set(walletAddr);
            connected.set(true);
            balance.set(Number(walletBal.nanoErgs));
            network.set("ergo-mainnet"); // Set appropriate network

            // Update the balance information whenever connection state changes
            await updateWalletInfo();
        } else {
            // Clear old stores when disconnected
            address.set(null);
            connected.set(false);
            balance.set(null);
            network.set(null);

            // Clear cached token data to ensure fresh data on next connection
            user_tokens.set(new Map());
        }
    });

    async function updateWalletInfo() {
        if (typeof ergo === "undefined" || !$connected) return;
        try {
            const walletBalance = await get_balance();
            balance.set(walletBalance.get("ERG") || 0);
            current_height = await get_current_height();
        } catch (error) {
            console.error("Error updating wallet information:", error);
        }
    }

    async function handleAction() {
        isLoading = true;
        transactionId = null;
        errorMessage = null;

        try {
            let amount = 0n;
            if (!amountStr) throw new Error("Amount is required");

            const parts = amountStr.split(".");
            if (parts.length > 2) throw new Error("Invalid amount format");

            const whole = BigInt(parts[0] || "0") * 1_000_000_000n;
            let fraction = 0n;
            if (parts.length === 2) {
                const fractionStr = parts[1].padEnd(9, "0").slice(0, 9);
                fraction = BigInt(fractionStr);
            }
            amount = whole + fraction;

            if (amount <= 0) {
                throw new Error("Amount must be greater than zero.");
            }
            if (!targetAddress) {
                throw new Error("Recipient address is required.");
            }
            const txId = await submit(targetAddress, amount);
            if (txId) {
                transactionId = txId;
                await updateWalletInfo();
            } else {
                throw new Error("The transaction did not return an ID.");
            }
        } catch (err: any) {
            errorMessage =
                err.info || err.message || "An unknown error occurred.";
        } finally {
            isLoading = false;
        }
    }
</script>

<header class="navbar-container">
    <div class="navbar-content">
        <a href="#" class="logo-container"> ERG Sender </a>

        <div class="flex-1"></div>

        <div class="user-section">
            <WalletButton explorerUrl={$web_explorer_uri_addr} />
            <button
                class="settings-button"
                on:click={() => (showSettingsModal = true)}
                aria-label="Settings"
                title="Configuración"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                    />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
            <div class="theme-toggle">
                <Theme />
            </div>
        </div>
    </div>
</header>

<Dialog.Root bind:open={showKyaModal}>
    <Dialog.Content class="w-[700px] max-w-[85vw] sm:max-w-[70vw]">
        <Dialog.Header>
            <Dialog.Title
                >Know Your Assumptions - Ergo Token Minter</Dialog.Title
            >
        </Dialog.Header>
        <div
            bind:this={kyaContentDiv}
            on:scroll={checkKyaScroll}
            class="max-h-[50vh] overflow-y-auto pr-4 text-sm"
        >
            <p class="mb-3">
                This application operates locally in your browser, does not rely
                on any centralized server, and interacts directly with the Ergo
                blockchain through your wallet.
            </p>

            <h3 class="font-bold text-md mt-4 mb-2">Fundamental Assumptions</h3>
            <ul class="list-disc ml-6 space-y-2">
                <li>
                    <strong>Wallet Compatibility:</strong> It is assumed that you
                    have Nautilus wallet installed, configured, and unlocked. The
                    application is entirely dependent on your wallet to sign and
                    submit transactions.
                </li>
                <li>
                    <strong>Direct Blockchain Interaction:</strong> This tool runs
                    entirely on your machine. All operations are transactions that
                    you must sign and are sent directly to the Ergo network. There
                    are no intermediary servers.
                </li>
                <li>
                    <strong>User Responsibility:</strong> You are responsible for
                    the information you input (token name, amount, etc.). Transactions
                    on the blockchain are irreversible.
                </li>
                <li>
                    <strong>Network Fees:</strong> It is assumed that you have enough
                    ERG in your wallet to cover network transaction fees and the
                    minimum value required to create a new box. Without this, transactions
                    will fail.
                </li>
            </ul>

            <h3 class="font-bold text-md mt-4 mb-2">Risks and Disclaimers</h3>
            <ul class="list-disc ml-6 space-y-2">
                <li>
                    <strong>"As-Is" Software:</strong> This tool is provided "as
                    is," without warranties of any kind. There is no guarantee against
                    errors or bugs. Use it at your own risk.
                </li>
                <li>
                    <strong>Irreversible Transactions:</strong> Once you sign and
                    submit a transaction to mint tokens, it cannot be undone. Double-check
                    all parameters before confirming.
                </li>
                <li>
                    <strong>Wallet Security:</strong> You are solely responsible
                    for the security of your wallet, private keys, and any assets.
                    This application never has access to your keys.
                </li>
                <li>
                    <strong>No Central Authority:</strong> As a decentralized tool,
                    there is no central entity to appeal to for lost funds or failed
                    transactions. You are interacting directly with a permissionless
                    blockchain.
                </li>
            </ul>
            <p class="italic mt-6">
                Do you understand and accept these assumptions and the
                associated risks of using this tool?
            </p>
        </div>
        <Dialog.Footer class="mt-4">
            <Button
                on:click={handleCloseKyaModal}
                disabled={!isKyaButtonEnabled}
                class="w-full sm:w-auto"
            >
                I Understand and Accept
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<main class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
        <h1 class="text-3xl font-bold mb-2">Send ERG</h1>
        <p class="text-muted-foreground mb-6">
            Complete the details below to send ERG on the Ergo blockchain.
        </p>

        {#if $connected}
            <form on:submit|preventDefault={handleAction} class="space-y-4">
                <div>
                    <Label for="address">Recipient Address</Label>
                    <Input
                        id="address"
                        bind:value={targetAddress}
                        placeholder="Ergo address"
                        required
                    />
                </div>
                <div>
                    <Label for="amount">Amount (ERG)</Label>
                    <Input
                        id="amount"
                        type="number"
                        bind:value={amountStr}
                        placeholder="E.g., 1.5"
                        step="any"
                        required
                    />
                </div>
                <Button type="submit" class="w-full" disabled={isLoading}>
                    {#if isLoading}
                        Sending...
                    {:else}
                        Send ERG
                    {/if}
                </Button>
            </form>

            <div class="mt-6 text-center">
                {#if isLoading}
                    <p class="text-blue-500">
                        Processing transaction. Please check your wallet to
                        sign...
                    </p>
                {/if}
                {#if transactionId}
                    <div
                        class="p-4 bg-green-100 dark:bg-green-900 border border-green-400 rounded-md"
                    >
                        <p
                            class="font-semibold text-green-800 dark:text-green-200"
                        >
                            Transfer successful!
                        </p>
                        <p class="text-sm">Transaction ID:</p>
                        <a
                            href={`https://explorer.ergoplatform.com/en/transactions/${transactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-blue-600 dark:text-blue-400 break-all"
                            >{transactionId}</a
                        >
                    </div>
                {/if}
                {#if errorMessage}
                    <div
                        class="p-4 bg-red-100 dark:bg-red-900 border border-red-400 rounded-md"
                    >
                        <p class="font-semibold text-red-800 dark:text-red-200">
                            Error
                        </p>
                        <p>{errorMessage}</p>
                    </div>
                {/if}
            </div>
        {:else}
            <p class="text-center text-lg font-semibold p-8 border rounded-md">
                Please connect your wallet to send ERG.
            </p>
        {/if}
    </div>
</main>

<footer class="page-footer">
    <div class="footer-left">
        <span
            class="cursor-pointer hover:underline"
            on:click={handleOpenKyaModal}
            on:keydown={(e) => e.key === "Enter" && handleOpenKyaModal()}
            role="button"
            tabindex="0"
        >
            KYA
        </span>
    </div>

    <div class="footer-center">
        <div bind:this={scrollingTextElement} class="scrolling-text-wrapper">
            {footerMessages[activeMessageIndex]}
        </div>
    </div>

    <div class="footer-right">
        <svg
            width="14"
            height="14"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            ><path
                d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z"
                fill="currentColor"
            ></path></svg
        >
        {#if current_height}
            <span>{current_height}</span>
        {/if}
    </div>
</footer>

<!-- Wallet Address Change Handler -->
<WalletAddressChangeHandler />

<!-- Settings Modal -->
<SettingsModal bind:open={showSettingsModal} />

<style lang="postcss">
    :global(body) {
        background-color: hsl(var(--background));
    }

    .navbar-container {
        @apply sticky top-0 z-50 w-full border-b backdrop-blur-lg;
        background-color: hsl(var(--background) / 0.8);
        border-bottom-color: hsl(var(--border));
    }

    .navbar-content {
        @apply container flex h-16 items-center;
    }

    .logo-container {
        @apply mr-4 flex items-center;
    }

    .user-section {
        @apply flex items-center gap-4;
    }

    .settings-button {
        @apply flex items-center justify-center;
        @apply w-9 h-9 rounded-md;
        @apply border border-border;
        @apply bg-background hover:bg-accent;
        @apply text-foreground hover:text-accent-foreground;
        @apply transition-colors cursor-pointer;
    }

    .settings-button:hover {
        @apply shadow-sm;
    }

    .page-footer {
        @apply fixed bottom-0 left-0 right-0 z-40;
        @apply flex items-center;
        @apply h-12 px-6 gap-6;
        @apply border-t text-sm text-muted-foreground;
        background-color: hsl(var(--background) / 0.8);
        border-top-color: hsl(var(--border));
        backdrop-filter: blur(4px);
    }

    .footer-left,
    .footer-right {
        @apply flex items-center gap-2 flex-shrink-0;
    }

    .footer-center {
        @apply flex-1 overflow-hidden;
        -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
        );
        mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
        );
    }

    .scrolling-text-wrapper {
        @apply inline-block whitespace-nowrap;
        animation: scroll-left 30s linear infinite;
    }

    @keyframes scroll-left {
        from {
            transform: translateX(100vw);
        }
        to {
            transform: translateX(-100%);
        }
    }
</style>
