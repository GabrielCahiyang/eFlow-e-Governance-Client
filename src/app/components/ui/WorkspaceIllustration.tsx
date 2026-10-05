import './workspaceIllustration.css';

/** Decorative first-run workspace preview. No project data or controls. */
export function WorkspaceIllustration({ dark = false, title = 'Your Office, together.' }: { dark?: boolean; title?: string }) {
  return <div className={`workspace-illustration ${dark ? 'workspace-illustration--dark' : ''}`} aria-hidden="true">
    <div className="workspace-illustration__board"><div className="workspace-illustration__brand">eFlow<span>.</span></div><strong>{title}</strong><div className="workspace-illustration__tabs"><span>Team</span><span>My Work</span></div>
      {[0, 1, 2, 3].map(i => <div className="workspace-illustration__row" key={i}><span className={`workspace-illustration__avatar avatar-${i}`}>{['JD', 'AS', 'ML', 'RK'][i]}</span><span className="workspace-illustration__line" /><span className={`workspace-illustration__status status-${i}`}>{['Working on it', 'Done', 'In review', 'Done'][i]}</span></div>)}
      <div className="workspace-illustration__foot"><span /><span /><span /></div>
    </div><div className="workspace-illustration__float float-one">JD</div><div className="workspace-illustration__float float-two">AS</div><div className="workspace-illustration__float float-three">ML</div><div className="workspace-illustration__done">✓ &nbsp; Better work. Together.</div>
  </div>;
}
