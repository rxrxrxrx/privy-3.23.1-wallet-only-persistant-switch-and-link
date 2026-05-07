"use client";

import { useConnectWallet, usePrivy, type Wallet as PrivyWallet } from "@privy-io/react-auth";
import {
  type ConnectedStandardSolanaWallet,
  useSignAndSendTransaction,
  useSignMessage,
  useSignTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { FileSignature, MessageSquare, Send, Wallet } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ActionButton } from "@/components/actionButton";
import { AddWalletButton } from "@/components/addWalletButton";
import { AddWalletButtonModal } from "@/components/addWalletButtonModal";
import { DashboardSkeleton } from "@/components/dashboardSkeleton";
import LoginButton from "@/components/loginButton";
import { LogoutConfirmButton } from "@/components/logoutConfirmButton";
import { SendTransactionModal } from "@/components/modals/sendTransactionModal";
import { SignMessageModal } from "@/components/modals/signMessageModal";
import { SignTransactionModal } from "@/components/modals/signTransactionModal";
import { Badge } from "@/components/ui/badge";
import {
  WalletEntryCard,
  type WalletEntry,
} from "@/components/walletEntryCard";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export default function Dashboard() {
  const { user: userData, ready, authenticated } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { signTransaction } = useSignTransaction();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] =
    useState<ConnectedStandardSolanaWallet | null>(null);
  const [signMessageModalOpen, setSignMessageModalOpen] = useState(false);
  const [signTransactionModalOpen, setSignTransactionModalOpen] =
    useState(false);
  const [sendTransactionModalOpen, setSendTransactionModalOpen] =
    useState(false);
  const [, forceTick] = useReducer((x: number) => x + 1, 0);

  // Q1 fix part A: subscribe to wallet-standard change events so dashboard
  // re-renders when user switches accounts inside Phantom/Solflare/etc.
  useEffect(() => {
    const offs = wallets.map((w) => {
      const ev = w.standardWallet.features["standard:events"] as
        | { on: (kind: string, cb: () => void) => () => void }
        | undefined;
      return ev?.on?.("change", () => forceTick());
    });
    return () => {
      for (const off of offs) off?.();
    };
  }, [wallets]);

  // Q1 fix part B: visibilitychange catches the case where Phantom doesn't
  // emit `change` when user comes back from the extension popup.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") forceTick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Q1 fix part C: derive active wallet from useWallets() (live) instead of
  // user.wallet (which only updates on login/link/unlink).
  useEffect(() => {
    if (activeAddress && !wallets.some((w) => w.address === activeAddress)) {
      setActiveAddress(wallets[0]?.address ?? null);
    } else if (!activeAddress && wallets[0]) {
      setActiveAddress(wallets[0].address);
    }
  }, [wallets, activeAddress]);

  const activeWallet =
    wallets.find((w) => w.address === activeAddress) ?? null;

  // Merge connected (live wallet adapter) and linked (Privy user record)
  // wallets so we display both — debug-panel-style — instead of hiding
  // wallets that are linked but currently disconnected.
  const walletEntries = useMemo<WalletEntry[]>(() => {
    const map = new Map<string, WalletEntry>();
    const linkedSolana = (userData?.linkedAccounts ?? []).filter(
      (a) =>
        a.type === "wallet" &&
        "chainType" in a &&
        a.chainType === "solana",
    ) as Array<{
      address: string;
      walletClientType?: string;
      walletIndex?: number | null;
    }>;
    for (const linked of linkedSolana) {
      map.set(linked.address, {
        address: linked.address,
        displayName: linked.walletClientType
          ? linked.walletClientType.charAt(0).toUpperCase() +
            linked.walletClientType.slice(1)
          : "Wallet",
        isConnected: false,
        isLinked: true,
        walletIndex: linked.walletIndex ?? null,
      });
    }
    for (const w of wallets) {
      const existing = map.get(w.address);
      map.set(w.address, {
        address: w.address,
        displayName: w.standardWallet.name,
        isConnected: true,
        isLinked: existing?.isLinked ?? false,
        walletIndex: existing?.walletIndex ?? null,
        connectedWallet: w,
      });
    }
    return Array.from(map.values());
  }, [userData?.linkedAccounts, wallets]);

  const handleSignMessage = async (
    wallet: ConnectedStandardSolanaWallet,
    message: string,
  ) => {
    logger.debug(`Signing message "${message}" with wallet:`, wallet.address);
    const encodedMessage = new TextEncoder().encode(message);
    const result = (
      await signMessage({
        message: encodedMessage,
        wallet,
      })
    ).signature;
    logger.debug("Message signed:", result);
  };

  const handleSignTransaction = async (
    wallet: ConnectedStandardSolanaWallet,
    to: string,
  ) => {
    logger.debug(`Signing transaction to "${to}" with wallet:`, wallet.address);
    const LAMPORTS_PER_SOL = 1_000_000_000;

    const transferInstruction = getTransferSolInstruction({
      amount: LAMPORTS_PER_SOL * 1,
      destination: address(to),
      source: createNoopSigner(address(wallet.address)),
    });

    const { getLatestBlockhash } = createSolanaRpc(
      env.SOLANA_RPC_URL,
    );
    const { value: latestBlockhash } = await getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(address(wallet.address), tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([transferInstruction], tx),
      (tx) => compileTransaction(tx),
    );
    const encodedTx = getTransactionEncoder().encode(transaction);

    const signedTransaction = await signTransaction({
      transaction: new Uint8Array(encodedTx),
      wallet,
    });
    logger.debug("Transaction signed:", signedTransaction.signedTransaction);
  };

  const handleSendTransaction = async (
    wallet: ConnectedStandardSolanaWallet,
    toAddress: string,
    amount: string,
  ) => {
    logger.debug(
      `Sending ${amount} SOL to ${toAddress} from wallet:`,
      wallet.address,
    );

    const LAMPORTS_PER_SOL = 1_000_000_000;

    const transferInstruction = getTransferSolInstruction({
      amount: BigInt(parseFloat(amount) * LAMPORTS_PER_SOL),
      destination: address(toAddress),
      source: createNoopSigner(address(wallet.address)),
    });

    const { getLatestBlockhash } = createSolanaRpc(
      env.SOLANA_RPC_URL,
    );
    const { value: latestBlockhash } = await getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(address(wallet.address), tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([transferInstruction], tx),
      (tx) => compileTransaction(tx),
    );

    const foundWallet = wallets.find((v) => v.address === wallet.address);

    if (foundWallet) {
      const encodedTx = getTransactionEncoder().encode(transaction);
      const result = await signAndSendTransaction({
        transaction: new Uint8Array(encodedTx),
        wallet: foundWallet,
      });
      logger.debug("Transaction sent:", result.signature);
      return;
    }

    logger.warn("Wallet not found for sending transaction");
  };

  const getWalletDisplayName = (wallet: PrivyWallet) => {
    if (wallet.walletClientType === "privy") {
      return `Privy ${wallet.chainType === "ethereum" ? "ETH" : "SOL"}${
        wallet.walletIndex !== undefined && wallet.walletIndex !== null
          ? ` #${wallet.walletIndex + 1}`
          : ""
      }`;
    }
    return wallet.walletClientType ?? "Wallet";
  };

  const handleWalletSelect = (
    wallet: ConnectedStandardSolanaWallet,
    modalType: string,
  ) => {
    setSelectedWallet(wallet);
    switch (modalType) {
      case "signMessage":
        setSignMessageModalOpen(true);
        break;
      case "signTransaction":
        setSignTransactionModalOpen(true);
        break;
      case "sendTransaction":
        setSendTransactionModalOpen(true);
        break;
    }
  };

  if (!ready) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen text-white font-[family-name:var(--font-geist-mono)]">
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-2 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white">Wallet Dashboard</h1>
            <p className="text-gray-400">
              {authenticated
                ? "Manage your wallets and transactions"
                : "Browse freely. Connect to trade."}
            </p>
          </div>

          {authenticated ? (
            <LogoutConfirmButton />
          ) : (
            <LoginButton label="Connect wallet" />
          )}
        </div>

        {/* Active Wallet Card */}
        <div className="bg-gray-900 border-2 border-blue-500 rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Active Wallet
                </h2>
                <p className="text-gray-400">
                  {activeWallet
                    ? "Currently selected wallet for transactions"
                    : "No wallet connected"}
                </p>
              </div>
            </div>
            {activeWallet ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">
                    {activeWallet.standardWallet.name}
                  </p>
                  <p className="text-sm text-gray-400">{activeWallet.address}</p>
                  {userData?.wallet ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Privy primary: {getWalletDisplayName(userData.wallet)}
                    </p>
                  ) : null}
                </div>
                <Badge>SOL</Badge>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Click {`"Connect wallet"`} above to start.
              </p>
            )}
          </div>
        </div>

        {/* Wallets section: always visible when authed, even with zero wallets */}
        {authenticated ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Wallets</h2>
                <p className="text-sm text-gray-400">
                  In extension:{" "}
                  {walletEntries.filter((e) => e.isConnected).length} · Linked
                  to your account:{" "}
                  {walletEntries.filter((e) => e.isLinked).length}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap items-start">
                <AddWalletButton />
                <AddWalletButtonModal />
              </div>
            </div>
            {walletEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {walletEntries.map((entry, index) => (
                  <WalletEntryCard
                    key={`${entry.address}-${index}`}
                    entry={entry}
                    isActive={entry.address === activeAddress}
                    onSelect={() =>
                      entry.isConnected ? setActiveAddress(entry.address) : null
                    }
                    onReconnect={() =>
                      connectWallet({ walletChainType: "solana-only" })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-sm text-gray-400">
                No wallets yet. Click {`"Add wallet"`} to link your Phantom,
                Solflare, Backpack, or any other Solana wallet.
              </div>
            )}
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Actions</h2>
          {authenticated && wallets.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              <ActionButton
                icon={<MessageSquare className="h-4 w-4" />}
                label="Sign Message"
                wallets={wallets}
                onWalletSelect={(wallet) =>
                  handleWalletSelect(wallet, "signMessage")
                }
              />
              <ActionButton
                icon={<FileSignature className="h-4 w-4" />}
                label="Sign Transaction"
                wallets={wallets}
                onWalletSelect={(wallet) =>
                  handleWalletSelect(wallet, "signTransaction")
                }
              />
              <ActionButton
                icon={<Send className="h-4 w-4" />}
                label="Send Transaction"
                wallets={wallets}
                onWalletSelect={(wallet) =>
                  handleWalletSelect(wallet, "sendTransaction")
                }
              />
            </div>
          ) : authenticated ? (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-400">
                Connect a wallet to trade.
              </p>
              <AddWalletButton />
              <AddWalletButtonModal />
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-400">
                Sign in with your Solana wallet to start trading.
              </p>
              <LoginButton label="Connect to trade" />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SignMessageModal
        isOpen={signMessageModalOpen}
        onClose={() => setSignMessageModalOpen(false)}
        selectedWallet={selectedWallet}
        onSign={handleSignMessage}
      />
      <SignTransactionModal
        isOpen={signTransactionModalOpen}
        onClose={() => setSignTransactionModalOpen(false)}
        selectedWallet={selectedWallet}
        onSign={handleSignTransaction}
      />
      <SendTransactionModal
        isOpen={sendTransactionModalOpen}
        onClose={() => setSendTransactionModalOpen(false)}
        selectedWallet={selectedWallet}
        onSend={handleSendTransaction}
      />
    </div>
  );
}
