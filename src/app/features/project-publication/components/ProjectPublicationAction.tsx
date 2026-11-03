import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui/button";
import { ProjectSealDialog } from "./ProjectSealDialog";
import { supabase } from "../../../../lib/supabase";
import { publicRecordUrl } from "../presentation";
interface PublicationActionProps {
  projectId: string;
  title: string;
  status: string;
  officeId?: string;
}
export function ProjectPublicationAction(props: PublicationActionProps) {
  return props.status === "archived" ? (
    <ArchivedPublicationAction {...props} />
  ) : null;
}
function ArchivedPublicationAction({
  projectId,
  title,
  status,
  officeId,
}: PublicationActionProps) {
  const { userProfile } = useAuth(),
    [open, setOpen] = useState(false),
    [certificate, setCertificate] = useState("");
  useEffect(() => {
    if (status !== "archived") return;
    let active = true;
    void supabase
      .from("project_seal_certificates")
      .select("id")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setCertificate(typeof data?.id === "string" ? data.id : "");
      },()=>{});
    return () => {
      active = false;
    };
  }, [projectId, status, open]);
  if (
    status !== "archived" ||
    userProfile?.role !== "head" ||
    userProfile.org_id !== officeId
  )
    return certificate ? (
      <a
        className="project-publication-action"
        href={publicRecordUrl(certificate)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ShieldCheck size={16} />
        Sealed on Amoy
      </a>
    ) : null;
  return (
    <>
      <Button
        className="project-publication-action"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <ShieldCheck size={16} />
        {certificate ? "View blockchain seal" : "Seal on blockchain"}
      </Button>
      {open && (
        <ProjectSealDialog
          projectId={projectId}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
