// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataTable } from '../../src/app/components/ui/DataTable';
import { EmptyState } from '../../src/app/components/ui/EmptyState';
import { FeedbackState } from '../../src/app/components/ui/FeedbackState';

afterEach(cleanup);
const columns = [{ key:'name', header:'Name', render:(row:{name:string})=>row.name }];
describe('illustrated empty-state boundaries',()=>{
  it('keeps loading, read failures and populated tables distinct from empty collections',()=>{
    const retry=vi.fn();
    const view=render(<DataTable data={[]} columns={columns} keyExtractor={r=>r.name} loading/>);
    expect(view.container.querySelector('.eflow-empty-illustration')).toBeNull();
    view.rerender(<DataTable data={[]} columns={columns} keyExtractor={r=>r.name} error="Access changed" onRetry={retry}/>);
    expect(screen.getByRole('alert')).toHaveTextContent('Access changed');
    expect(view.container.querySelector('.eflow-empty-illustration')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Retry',exact:true}));expect(retry).toHaveBeenCalledOnce();
    view.rerender(<DataTable data={[{name:'Project record'}]} columns={columns} keyExtractor={r=>r.name}/>);
    expect(screen.getByText('Project record')).toBeVisible();
    expect(view.container.querySelector('.eflow-empty-illustration')).toBeNull();
  });
  it('retains search and lets the user recover the populated list from a no-match illustration',async()=>{
    const view=render(<DataTable data={[{name:'Meeting'}]} columns={columns} keyExtractor={r=>r.name} searchFilter={(r,q)=>r.name.toLowerCase().includes(q)} searchPlaceholder="Find records"/>);
    fireEvent.change(screen.getByPlaceholderText('Find records'),{target:{value:'absent'}});
    await waitFor(()=>expect(view.container.querySelector('img[data-illustration=search]')).not.toBeNull());
    const image=view.container.querySelector('img[data-illustration=search]');expect(image).toHaveAttribute('alt','');expect(image).toHaveAttribute('aria-hidden','true');
    fireEvent.change(screen.getByPlaceholderText('Find records'),{target:{value:''}});
    await waitFor(()=>expect(screen.getByText('Meeting')).toBeVisible());expect(view.container.querySelector('.eflow-empty-illustration')).toBeNull();
  });
  it('keeps custom visuals and action controls usable without decorating status feedback',()=>{
    const create=vi.fn();
    const view=render(<><EmptyState title="No projects" illustration="projects" action={<button onClick={create}>Create project</button>}/><FeedbackState tone="error" title="Projects unavailable">Retry loading</FeedbackState></>);
    fireEvent.click(screen.getByRole('button',{name:'Create project'}));expect(create).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').querySelector('img')).toBeNull();
    view.rerender(<EmptyState title="Choose a person" illustration={false} icon={<span data-testid="custom-visual"/>}/>);
    expect(screen.getByTestId('custom-visual')).toBeInTheDocument();expect(view.container.querySelector('img')).toBeNull();
  });
  it('offers a local still for reduced motion without repeating the shell credit under images',()=>{
    const view=render(<EmptyState title="No projects" illustration="projects"/>);
    expect(view.container.querySelector('source')).toHaveAttribute('media','(prefers-reduced-motion: reduce)');
    expect(view.container.querySelector('source')?.getAttribute('srcset')).toMatch(/storyset\/projects-amico\.still\.svg$/);
    expect(screen.queryByRole('link',{name:'Illustrations by Storyset'})).toBeNull();
  });
});
