export interface WorkspacePerson { id: string; name: string; avatarUrl?: string; }
export function PeopleAvatarStack({people, limit = 4}: {people: WorkspacePerson[]; limit?: number}) {
  const shown = people.slice(0,Math.max(0,limit));
  return <span className="eflow-avatar-stack" aria-label={people.map(p=>p.name).join(", ")}>{shown.map(person => <span key={person.id} title={person.name}>{person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} /> : person.name.split(/\s+/).map(p=>p[0]).join("").slice(0,2).toUpperCase()}</span>)}{people.length>shown.length && <span title={people.slice(shown.length).map(p=>p.name).join(", ")}>+{people.length-shown.length}</span>}</span>;
}
