import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { downloadPreviewFile, saveFile } from "../services/publicationService";
import { sectionLabel } from "../presentation";
import type { ArchiveManifest, ProjectSeal, ArchiveFile } from "../types";
import { RecordSections } from "./RecordSections";
import { PublicationCopyDialog } from "./PublicationCopyDialog";
export function ArchivePreview({
  seal,
  onError,
  onUpdated,
  onBusy,
}: {
  seal: ProjectSeal;
  onError: (message: string) => void;
  onUpdated: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [copyFile, setCopyFile] = useState<ArchiveFile | null>(null);
  if (!seal.manifest) return null;
  const manifest = JSON.parse(seal.manifest) as ArchiveManifest;
  return (
    <section className="project-seal-preview">
      <div className="project-seal-section-heading">
        <h3>
          <FileText size={18} />
          Public project record
        </h3>
        <Button
          variant="outline"
          onClick={() =>
            saveFile(
              new Blob([seal.manifest!], { type: "application/json" }),
              "project-record.json",
            )
          }
        >
          <Download size={15} />
          Download full record
        </Button>
      </div>
      <p>
        Review every section and attachment. These are the exact records that
        will become public.
      </p>
      {manifest.correction_note && (
        <div className="project-seal-note">
          <strong>Correction notice</strong>
          <p>{manifest.correction_note}</p>
        </div>
      )}
      <RecordSections records={manifest.records} />
      <h3>Files ({manifest.files.length})</h3>
      {!manifest.files.length ? (
        <p>No project files are attached.</p>
      ) : (
        <ul className="project-seal-files">
          {manifest.files.map((file, i) => (
            <li key={`${file.sha256}:${i}`}>
              <div>
                <strong>{file.name}</strong>
                <small>
                  {sectionLabel(file.section)} · {(file.size / 1024).toFixed(1)}{" "}
                  KB
                </small>
                {file.publication_copy_note && (
                  <small>Publication copy: {file.publication_copy_note}</small>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  void downloadPreviewFile(
                    seal.id,
                    file.sha256,
                    file.name,
                  ).catch((e) => onError(e.message))
                }
              >
                <Download size={15} />
                Review file
              </Button>
              {seal.state === "review_ready" && (
                <Button variant="ghost" onClick={() => setCopyFile(file)}>
                  Use publication copy
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="project-seal-fingerprint">
        Record fingerprint <code>{seal.manifest_hash}</code>
      </p>
      {copyFile && (
        <PublicationCopyDialog
          id={seal.id}
          file={copyFile}
          onClose={() => setCopyFile(null)}
          onUpdated={onUpdated}
          onBusy={onBusy}
        />
      )}
    </section>
  );
}
