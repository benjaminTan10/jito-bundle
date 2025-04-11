require("dotenv").config();

import * as Fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { SystemProgram } from "@solana/web3.js";
import axios from "axios";

const jitoUrl = process.env.BLOCK_ENGINE_URL || "";

async function queryJitoBundles(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/bundles`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function queryInflightBundleStatuses(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/getInflightBundleStatuses`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function queryBundleStatuses(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/getBundleStatuses`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function getJitoTipAccount() {
  const accounts = await queryJitoBundles("getTipAccounts", []);
  const jitoTipAddress = new PublicKey(
    accounts?.result[Math.floor(Math.random() * accounts?.result.length)]
  );

  return jitoTipAddress;
}

const main = async () => {
  const blockEngineUrl = process.env.BLOCK_ENGINE_URL || "";
  console.log("BLOCK_ENGINE_URL:", blockEngineUrl);

  const keypair = Keypair.fromSecretKey(bs58.decode(""));
  const jitoTipAddress = await getJitoTipAccount();
  console.log("jitoTipAddress:", jitoTipAddress.toBase58());

  const rpcUrl = process.env.RPC_URL || "";
  console.log("RPC_URL:", rpcUrl);

  // get the latest blockhash
  const connection = new Connection(rpcUrl, "confirmed");

  // Build and sign a tip transaction
  const transfer1Ix = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("CMfPj4buBfD4XEuDa6NHHL3FHbXTaUWwe7K52YmcjaLn"),
    lamports: 1000000,
  });
  const transaction_1 = new Transaction().add(transfer1Ix);
  transaction_1.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction_1.feePayer = keypair.publicKey;
  await transaction_1.sign(keypair);
  const transfer2Ix = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("DfHhcLw2yX9i3bTtA7CU9XTE2fsNTH4VSi1GeRMdcyEK"),
    lamports: 1000000,
  });
  const transaction_2 = new Transaction().add(transfer2Ix);
  transaction_2.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction_2.feePayer = keypair.publicKey;
  await transaction_2.sign(keypair);

  const tipIx = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: jitoTipAddress,
    lamports: 1000000, // tip amount
  });

  const transaction_jitoTip = new Transaction().add(tipIx);
  transaction_jitoTip.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction_jitoTip.feePayer = keypair.publicKey;
  await transaction_jitoTip.sign(keypair);

  const bunldeSentResult = await queryJitoBundles("sendBundle", [
    bs58.encode(transaction_1.serialize()),
    bs58.encode(transaction_2.serialize()),
    bs58.encode(transaction_jitoTip.serialize()),
  ]);

  console.log(`✅ Bundle sent: ${bunldeSentResult?.result}`);

  let retryCount = 0;
  const timeBetweenRetries = 5000;
  const maxRetries = 50;

  do {
    const inflightBundleStatus = await queryInflightBundleStatuses(
      "getInflightBundleStatuses",
      [bunldeSentResult?.result]
    );

    const bundleStatus = inflightBundleStatus?.result.value?.[0].status;

    if (bundleStatus === "Failed") {
      console.log("❌ JITO bundle failed");
      return "Failed";
    }

    if (bundleStatus === "Landed") {
      console.log("✅ JITO bundle landed");
      const bundle = await queryBundleStatuses("getBundleStatuses", [
        bunldeSentResult?.result,
      ]);
      console.log(`📝 Transactions: ${bundle?.result.value?.[0].transactions}`);

      return bundle?.result.value?.[0].transactions;
    }

    console.log(`🔄 JITO bundle status: ${bundleStatus}`);
    retryCount++;
    await new Promise((resolve) => setTimeout(resolve, timeBetweenRetries));
  } while (retryCount < maxRetries);
};

main().catch((e) => {
  throw e;
});
