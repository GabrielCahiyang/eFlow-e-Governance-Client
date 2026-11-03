import type { PublicCertificate } from "../types";
import { sha256 } from "./publicRecordService";
const EVENT =
  "0x5fdffb7c82b7d0a0334dc40c9941aec08662d1587984669015c494adce3a4911";
type Receipt = {
  status: string;
  to: string;
  from: string;
  blockNumber: string;
  blockHash: string;
  logs: { address: string; topics: string[]; data: string }[];
};
function word(data: string, n: number) {
  return data.slice(2 + n * 64, 2 + (n + 1) * 64);
}
function eventUri(data: string) {
  const offset = Number(BigInt(`0x${word(data, 1)}`)) * 2,
    length = Number(BigInt(`0x${data.slice(2 + offset, 2 + offset + 64)}`));
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    length > 512
  )
    throw new Error("Invalid certificate event.");
  const hex = data.slice(2 + offset + 64, 2 + offset + 64 + length * 2);
  return new TextDecoder().decode(
    new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) || []),
  );
}
export async function checkAmoyProof(
  c: PublicCertificate,
  call = rpc,
  trustedRegistry = import.meta.env.VITE_PROJECT_SEAL_REGISTRY as
    string | undefined,
) {
  if (c.chain_id !== 80002) throw new Error("This certificate is not on Amoy.");
  if (!trustedRegistry)
    throw new Error(
      "The trusted Amoy registry is not configured on this website yet.",
    );
  if (trustedRegistry.toLowerCase() !== c.contract_address.toLowerCase())
    throw new Error(
      "This certificate does not use the trusted eFlow registry.",
    );
  const [chain, receipt, finalized] = (await Promise.all([
    call("eth_chainId", []),
    call("eth_getTransactionReceipt", [c.tx_hash]),
    call("eth_getBlockByNumber", ["finalized", false]),
  ])) as [string, Receipt | null, { number: string }];
  if (chain !== "0x13882")
    throw new Error("The verification provider returned the wrong network.");
  if (!receipt || BigInt(finalized.number) < BigInt(receipt.blockNumber))
    throw new Error("The transaction is not final yet.");
  const block = (await call("eth_getBlockByNumber", [
    receipt.blockNumber,
    false,
  ])) as { hash: string };
  if (
    receipt.status !== "0x1" ||
    receipt.to.toLowerCase() !== c.contract_address.toLowerCase() ||
    receipt.from.toLowerCase() !== c.publisher.toLowerCase() ||
    receipt.blockHash.toLowerCase() !== c.block_hash.toLowerCase() ||
    block.hash.toLowerCase() !== c.block_hash.toLowerCase() ||
    Number(BigInt(receipt.blockNumber)) !== c.block_number
  )
    throw new Error("The chain receipt does not match this certificate.");
  const cert =
      "0x" +
      (await sha256(new TextEncoder().encode(`eflow-certificate:${c.id}`))),
    project =
      "0x" +
      (await sha256(new TextEncoder().encode(`eflow-project:${c.project_id}`)));
  const previous = c.previous_id
    ? await sha256(
        new TextEncoder().encode(`eflow-certificate:${c.previous_id}`),
      )
    : "0".repeat(64);
  const matching = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === c.contract_address.toLowerCase() &&
      log.topics[0]?.toLowerCase() === EVENT &&
      log.topics[1]?.toLowerCase() === cert &&
      log.topics[2]?.toLowerCase() === project &&
      word(log.data, 0).toLowerCase() === c.manifest_hash &&
      word(log.data, 2).toLowerCase() === previous &&
      `0x${word(log.data, 3).slice(24)}`.toLowerCase() ===
        c.publisher.toLowerCase() &&
      eventUri(log.data) === c.archive_uri,
  );
  if (matching.length !== 1)
    throw new Error("The chain event does not match this project record.");
  return true;
}
async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch("https://polygon-amoy.drpc.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error("Amoy verification is unavailable. Try again later.");
  const body = await response.json();
  if (body.error)
    throw new Error("Amoy verification is unavailable. Try again later.");
  return body.result;
}
