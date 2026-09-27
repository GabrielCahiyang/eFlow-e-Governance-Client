import {
  Award,
  BriefcaseBusiness,
  FileSpreadsheet,
  GraduationCap,
  Mail,
  Phone,
  Tags,
  UserRound,
} from "lucide-react";
import type { ParsedPdsImport } from "../../../employees";

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{label}</div>
      <div className="mt-0.5 break-words text-[11px] font-medium text-neutral-800">{value || "Not provided"}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-neutral-900">
        <span className="text-teal-700">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PdsImportReview({ parsed }: { parsed: ParsedPdsImport }) {
  const { details } = parsed;
  const personal = details.personal;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5">
        <FileSpreadsheet className="mt-0.5 shrink-0 text-teal-700" size={18} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-teal-950">{details.sourceFileName || "PDS workbook"}</div>
          <p className="mt-0.5 text-[10px] leading-4 text-teal-800">
            Review the extracted information below. Nothing is added to the new user until you choose “Use these details”.
          </p>
        </div>
      </div>

      <Section icon={<UserRound size={15} />} title="Personal and contact information">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Detail label="Full name" value={parsed.profile.fullName} />
          <Detail label="Date of birth" value={personal.birthDate} />
          <Detail label="Place of birth" value={personal.placeOfBirth} />
          <Detail label="Email" value={personal.email} />
          <Detail label="Mobile" value={personal.mobile} />
          <Detail label="Employee number" value={personal.employeeNumber} />
        </div>
        {(personal.telephone || personal.email || personal.mobile) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-neutral-500">
            {personal.email && <span className="inline-flex items-center gap-1"><Mail size={11} />{personal.email}</span>}
            {(personal.mobile || personal.telephone) && <span className="inline-flex items-center gap-1"><Phone size={11} />{personal.mobile || personal.telephone}</span>}
          </div>
        )}
      </Section>

      <Section icon={<BriefcaseBusiness size={15} />} title="Current employment">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Position" value={details.currentWork?.position} />
          <Detail label="Office / department" value={details.currentWork?.office} />
          <Detail label="Inclusive dates" value={details.currentWork ? `${details.currentWork.from || "—"} to ${details.currentWork.to || "—"}` : ""} />
          <Detail label="Appointment" value={details.currentWork?.appointmentStatus} />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Section icon={<GraduationCap size={15} />} title={`Education (${details.education.length})`}>
          <div className="space-y-2.5">
            {details.education.length ? details.education.map((item, index) => (
              <div key={`${item.level}-${item.degree}-${index}`} className="border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <div className="text-[10px] font-semibold text-neutral-800">{item.degree}</div>
                <div className="mt-0.5 text-[9.5px] leading-4 text-neutral-500">{item.level}{item.school ? ` · ${item.school}` : ""}</div>
              </div>
            )) : <div className="text-[10px] text-neutral-400">No education rows found.</div>}
          </div>
        </Section>

        <Section icon={<Award size={15} />} title="Eligibility and training">
          <Detail label="Civil service eligibility" value={details.eligibility?.title} />
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Training records</div>
            <div className="mt-1 text-[11px] font-medium text-neutral-800">{details.trainings.length} extracted</div>
            {details.trainings.slice(0, 3).map((training, index) => (
              <div key={`${training.title}-${index}`} className="mt-1.5 line-clamp-2 text-[9.5px] leading-4 text-neutral-500">{training.title}</div>
            ))}
            {details.trainings.length > 3 && <div className="mt-1 text-[9.5px] font-medium text-teal-700">+{details.trainings.length - 3} more records</div>}
          </div>
        </Section>
      </div>

      <Section icon={<Tags size={15} />} title={`Skills to import (${parsed.employeeNotes.tags.length})`}>
        {parsed.employeeNotes.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {parsed.employeeNotes.tags.map((skill) => (
              <span key={skill} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-800">{skill}</span>
            ))}
          </div>
        ) : <div className="text-[10px] text-neutral-400">No usable skill keywords were found.</div>}
      </Section>
    </div>
  );
}
