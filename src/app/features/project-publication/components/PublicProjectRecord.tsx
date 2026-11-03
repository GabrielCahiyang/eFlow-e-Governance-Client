import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  loadPublicArchive,
  loadPublicCertificate,
  publicFile,
} from "../services/publicRecordService";
import { checkAmoyProof } from "../services/amoyProof";
import { saveFile } from "../services/publicationService";
import { sectionLabel } from "../presentation";
import type { ArchiveManifest, PublicCertificate } from "../types";
import "../publication.css";
import { RecordSections } from "./RecordSections";
export function PublicProjectRecord({
  certificateId,
}: {
  certificateId: string;
}) {
  const [certificate, setCertificate] = useState<PublicCertificate | null>(
      null,
    ),
    [archive, setArchive] = useState<{
      manifest: ArchiveManifest;
      text: string;
      url: string;
    } | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [proof, setProof] = useState(""),[proofValid,setProofValid]=useState(false),
    [verifying, setVerifying] = useState(false);
  useEffect(() => {
    let active = true;
    void loadPublicCertificate(certificateId)
      .then(async (c) => {
        if (active) setCertificate(c);
        const record = await loadPublicArchive(c);
        if (active) setArchive(record);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [certificateId]);
  return (
    <main className="public-project-record">
      <header>
        <ShieldCheck size={42} />
        <div>
          <small>eFlow · Public project archive · Polygon Amoy testnet</small>
          <h1>{certificate?.title || "Project certificate"}</h1>
          <p>
            A permanent reviewed project version. Operational accounts and
            private personnel records are not public.
          </p>
        </div>
      </header>
      {loading && <p role="status">Checking the published project record…</p>}
      {error && (
        <div role="alert" className="project-seal-error">
          <AlertTriangle size={22} />
          {error}
        </div>
      )}
      {certificate && (
        <>
          <div className="certificate-facts">
            <div>
              <small>Published version</small>
              <strong>Version {certificate.version}</strong>
            </div>
            <div>
              <small>Sealed</small>
              <strong>
                {new Date(certificate.sealed_at).toLocaleString()}
              </strong>
            </div>
            <div>
              <small>Manifest SHA-256</small>
              <code>{certificate.manifest_hash}</code>
            </div>
          </div>
          <nav>
            <a
              href={`https://amoy.polygonscan.com/tx/${certificate.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View blockchain transaction
            </a>
            {certificate.previous_id && (
              <a href={`/public/project-record/${certificate.previous_id}`}>
                Previous certificate
              </a>
            )}
            <button
              disabled={verifying}
              onClick={() => {
                setVerifying(true);
                setProof("");
                void checkAmoyProof(certificate)
                  .then(() => {setProofValid(true);return (
                    setProof(
                      "Amoy receipt, project fingerprint and finality verified.",
                    ));})
                  .catch((e) => {setProofValid(false);setProof(e.message);})
                  .finally(() => setVerifying(false));
              }}
            >
              {" "}
              {verifying ? "Checking Amoy…" : "Check Amoy proof"}
            </button>
          </nav>
          {proof && <div role={proofValid?'status':'alert'} className={proofValid?'project-seal-status is-sealed':'project-seal-error'}>{proof}</div>}
        </>
      )}
      {archive && (
        <>
          {archive.manifest.correction_note && (
            <section className="project-seal-note">
              <strong>Correction notice</strong>
              <p>{archive.manifest.correction_note}</p>
            </section>
          )}
          <div className="project-seal-status is-sealed">
            <CheckCircle2 size={25} />
            <div>
              <strong>Archive fingerprint matches</strong>
              <p>
                This copy matches the fingerprint in the published certificate.
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              saveFile(
                new Blob([archive.text], { type: "application/json" }),
                "project-record.json",
              )
            }
          >
            <Download size={15} /> Download full record
          </button>
          <RecordSections records={archive.manifest.records} />
          <h2>Evidence and files</h2>
          <ul className="project-seal-files">
            {archive.manifest.files.map((file, i) => (
              <li key={`${file.sha256}:${i}`}>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {sectionLabel(file.section)} ·{" "}
                    {(file.size / 1024).toFixed(1)} KB
                  </small>
                  {file.publication_copy_note && (
                    <small>
                      Publication copy: {file.publication_copy_note}
                    </small>
                  )}
                </div>
                <button
                  onClick={() =>
                    void publicFile(archive.url, file.path, file.sha256)
                      .then((blob) => saveFile(blob, file.name))
                      .catch((e) => setError(e.message))
                  }
                >
                  Verify and download
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
