import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isSealPending,
  sealLabels,
} from "../../src/app/features/project-publication/presentation";
import {
  archiveAddress,
  loadPublicArchive,
  sha256,
} from "../../src/app/features/project-publication/services/publicRecordService";
import { checkAmoyProof } from "../../src/app/features/project-publication/services/amoyProof";
import type { PublicCertificate } from "../../src/app/features/project-publication/types";
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
const base =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ixnfphgjyelhckjwjkdv.supabase.co";
const certificate: PublicCertificate = {
  id: "10000000-0000-4000-8000-000000000001",
  project_id: "20000000-0000-4000-8000-000000000001",
  version: 1,
  title: "QA published record",
  manifest_hash: "a".repeat(64),
  archive_uri: `${base}/storage/v1/object/public/project-seal-public/${"a".repeat(64)}/manifest.json`,
  storage_kind: "supabase-content-addressed",
  chain_id: 80002,
  contract_address: "0x" + "1".repeat(40),
  tx_hash: "0x" + "2".repeat(64),
  block_number: 15,
  block_hash: "0x" + "3".repeat(64),
  publisher: "0x" + "4".repeat(40),
  sealed_at: "2026-11-03T00:00:00Z",
  previous_id: null,
};
afterEach(() => vi.unstubAllGlobals());
describe("project publication states", () => {
  it("does not call simulation or a pending receipt sealed", () => {
    expect(isSealPending("confirming")).toBe(true);
    expect(isSealPending("confirmed")).toBe(false);
    expect(sealLabels.simulation).not.toMatch(/sealed/i);
    expect(sealLabels.failed).toBe("Publication stopped");
  });
  it("rejects arbitrary archive destinations", () => {
    for (const uri of [
      "http://127.0.0.1/private",
      "javascript:alert(1)",
      "https://evil.test/manifest.json",
      `${base}/storage/v1/object/authenticated/budget-receipts/file`,
    ])
      expect(() => archiveAddress(uri)).toThrow();
    expect(archiveAddress(certificate.archive_uri)).toBe(
      certificate.archive_uri,
    );
    expect(archiveAddress("ipfs://bafyexample/manifest.json")).toBe(
      "https://ipfs.io/ipfs/bafyexample/manifest.json",
    );
  });
  it("rejects altered manifest bytes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"altered":true}')),
    );
    await expect(loadPublicArchive(certificate)).rejects.toThrow("fingerprint");
  });
  it("verifies exact bytes and certificate identity", async () => {
    const text = JSON.stringify({
        schema_version: 1,
        snapshot_id: certificate.id,
        project_id: certificate.project_id,
        records: {},
        files: [],
      }),
      hash = await sha256(new TextEncoder().encode(text));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response(text))),
    );
    expect(
      (await loadPublicArchive({ ...certificate, manifest_hash: hash })).text,
    ).toBe(text);
    await expect(
      loadPublicArchive({ ...certificate, id: "another", manifest_hash: hash }),
    ).rejects.toThrow("match this certificate");
  });
  it("verifies the real chain event and finality independently", async () => {
    const id =
        "0x" +
        (await sha256(
          new TextEncoder().encode(`eflow-certificate:${certificate.id}`),
        )),
      project =
        "0x" +
        (await sha256(
          new TextEncoder().encode(`eflow-project:${certificate.project_id}`),
        ));
    const uri = new TextEncoder().encode(certificate.archive_uri),
      hex = Array.from(uri, (b) => b.toString(16).padStart(2, "0")).join("");
    const data =
      "0x" +
      certificate.manifest_hash +
      (128).toString(16).padStart(64, "0") +
      "0".repeat(64) +
      "0".repeat(24) +
      certificate.publisher.slice(2) +
      uri.length.toString(16).padStart(64, "0") +
      hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
    const receipt = {
      status: "0x1",
      to: certificate.contract_address,
      from: certificate.publisher,
      blockNumber: "0xf",
      blockHash: certificate.block_hash,
      logs: [
        {
          address: certificate.contract_address,
          topics: [
            "0x5fdffb7c82b7d0a0334dc40c9941aec08662d1587984669015c494adce3a4911",
            id,
            project,
          ],
          data,
        },
      ],
    };
    const call = vi.fn(async (method: string, params: unknown[]) =>
      method === "eth_chainId"
        ? "0x13882"
        : method === "eth_getTransactionReceipt"
          ? receipt
          : params[0] === "finalized"
            ? { number: "0x10" }
            : { hash: certificate.block_hash },
    );
    await expect(
      checkAmoyProof(certificate, call, certificate.contract_address),
    ).resolves.toBe(true);
    await expect(
      checkAmoyProof(
        { ...certificate, publisher: "0x" + "9".repeat(40) },
        call,
        certificate.contract_address,
      ),
    ).rejects.toThrow("receipt");
    receipt.logs[0].data = "0x" + "0".repeat(64) + data.slice(66);
    await expect(
      checkAmoyProof(certificate, call, certificate.contract_address),
    ).rejects.toThrow("event");
  });
});
