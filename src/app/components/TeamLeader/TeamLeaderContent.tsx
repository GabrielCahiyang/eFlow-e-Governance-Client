import { MemberContent } from "../Member/MemberContent";

export function TeamLeaderContent({
  activeSection,
  activePage,
}: {
  activeSection?: string;
  activePage?: string;
}) {
  return (
    <MemberContent
      activeSection={activeSection || "tasks"}
      activePage={activePage}
    />
  );
}

export default TeamLeaderContent;
