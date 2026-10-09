import { WorkspacePopover } from "./WorkspacePopover";
import { WorkspaceTooltip } from "./WorkspaceTooltip";
import { useState } from 'react';

export interface WorkspacePerson { id: string; name: string; avatarUrl?: string; }
function PersonAvatar({ person }: { person: WorkspacePerson }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <span className="eflow-avatar" role="img" tabIndex={0} aria-label={person.name || "Name unavailable"}>
    {person.avatarUrl && failedUrl !== person.avatarUrl ? <img src={person.avatarUrl} alt="" onError={() => setFailedUrl(person.avatarUrl)} /> : (person.name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "?")}
  </span>;
}
export function PeopleAvatarStack({ people, limit = 4 }: { people: WorkspacePerson[]; limit?: number }) {
  const shown = people.slice(0, Math.max(0, limit));
  if (!people.length) return <span className="eflow-avatar-empty">No people assigned</span>;
  return <div className="eflow-people">
    <span className="eflow-avatar-stack" aria-label="People">
      {shown.map(person => <WorkspaceTooltip key={person.id} content={person.name || "Name unavailable"}>
        <PersonAvatar person={person} />
      </WorkspaceTooltip>)}
    </span>
    <WorkspacePopover trigger={<button type="button" className="eflow-people__list-trigger" aria-label="Show all people">{people.length > shown.length ? `+${people.length - shown.length} · ` : ""}People ({people.length})</button>}>
      <div className="eflow-people__list"><strong>People</strong><ul>{people.map(person => <li key={person.id}>{person.name || "Name unavailable"}</li>)}</ul></div>
    </WorkspacePopover>
  </div>;
}
