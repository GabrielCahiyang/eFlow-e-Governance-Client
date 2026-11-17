import '@vibe/core/tokens';
import '@fontsource-variable/figtree/wght.css';
import '../../../src/styles/index.css';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { IconButton } from '@vibe/core';
import { Add } from '@vibe/icons';
import { Bell, Ellipsis, Star } from 'lucide-react';
import { EflowVibeThemeProvider } from '../../../src/app/shared/vibe';
import { WorkspaceTooltip } from '../../../src/app/components/ui/workspace/WorkspaceTooltip';
import { ActionMenu } from '../../../src/app/components/ui/workspace/ActionMenu';
import { WorkspacePopover } from '../../../src/app/components/ui/workspace/WorkspacePopover';
import { ContextRailHeader } from '../../../src/app/features/app-shell/components/ContextRailHeader';
import { FeatureDialog } from '../../../src/app/components/ui/FeatureDialog';
import { RichTextEditor } from '../../../src/app/components/ui/RichTextEditor';
import { TableColumnResizer } from '../../../src/app/components/ui/workspace/TableColumnResizer';

function Proof() {
  const [dark, setDark] = useState(false), [favorite, setFavorite] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [dialog, setDialog] = useState(false), [value, setValue] = useState('<p>Completion note</p>'), [width, setWidth] = useState(300), [count, setCount] = useState(0);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const iconStyle = { display: 'inline-grid', placeItems: 'center', width: 44, height: 44, border: '1px solid var(--eflow-border)', borderRadius: 6, color: 'var(--eflow-text)', background: 'var(--eflow-surface)' };
  return <EflowVibeThemeProvider preference={dark ? 'dark' : 'light'}><main style={{ padding: 24, minHeight: '100dvh', background: 'var(--eflow-canvas)', color: 'var(--eflow-text)' }}>
    <h1>eFlow tooltip interaction coverage</h1>
    <p>Navigation, action menus, editor controls and dialogs use the shared Vibe tooltip behavior.</p>
    <button type="button" onClick={() => setDark(!dark)}>Switch theme</button>
    <section aria-label="Tooltip controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBlock: 24 }}>
      <WorkspaceTooltip content="Notifications"><button type="button" style={iconStyle} aria-label="Open notifications" onClick={() => setCount(count + 1)}><Bell size={18}/></button></WorkspaceTooltip>
      <WorkspaceTooltip content={favorite ? 'Remove from favorites' : 'Add to favorites'}><button type="button" style={iconStyle} aria-label="Favorite Road repair" aria-pressed={favorite} onClick={() => setFavorite(!favorite)}><Star size={18} fill={favorite ? 'currentColor' : 'none'}/></button></WorkspaceTooltip>
      <ActionMenu tooltip="Project actions" trigger={<button type="button" style={iconStyle} aria-label="Actions for Road repair"><Ellipsis size={18}/></button>} actions={[{ id: 'count', label: 'Open project', onSelect: () => setCount(count + 1) }, { id: 'blocked', label: 'Archive project', disabled: true, disabledReason: 'A review is pending.', onSelect: () => { throw Error('Disabled action ran'); } }]} />
      <WorkspacePopover tooltip="Choose people" trigger={<button type="button" style={iconStyle} aria-label="Choose task people">+</button>}><button type="button">Jordan Diaz</button></WorkspacePopover>
      <IconButton aria-label="Add task" icon={Add}/>
      <button type="button" onClick={() => setDialog(true)}>Open dialog</button>
    </section>
    <div style={{ maxWidth: 240, marginBlock: 24 }}><ContextRailHeader title="Workspace" collapsed={collapsed} mobile={false} onCollapse={() => setCollapsed(!collapsed)} /></div>
    <div style={{ maxWidth: 600, border: '1px solid var(--eflow-border)' }}><RichTextEditor value={value} onChange={setValue}/></div>
    <table style={{ marginBlock: 24 }}><thead><tr><th style={{ position: 'relative', width, padding: 16 }}>Task<TableColumnResizer label="Task" width={width} defaultWidth={300} min={180} max={500} onResize={setWidth}/></th></tr></thead></table>
    <output aria-label="Action count">{count}</output>
    <FeatureDialog open={dialog} title="Task details" onClose={() => setDialog(false)}><div style={{ padding: 24 }}><h2>Task details</h2><ActionMenu tooltip="Dialog task actions" trigger={<button type="button" style={iconStyle} aria-label="Task actions in dialog">…</button>} actions={[{ id: 'keep', label: 'Keep editing', onSelect: () => setCount(count + 1) }]} /></div></FeatureDialog>
  </main></EflowVibeThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Proof/>);
