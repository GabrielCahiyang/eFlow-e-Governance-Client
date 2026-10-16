// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ load: vi.fn(), open:vi.fn() }));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'me'},userProfile:{id:'me',role:'member'}})}));
vi.mock('../../src/app/features/subtasks',async()=>({
  ...await vi.importActual<typeof import('../../src/app/features/subtasks')>('../../src/app/features/subtasks'),
  SubitemInspector:(props:{itemId:string;rootTask:{id:string};readOnly?:boolean})=>{
    api.open(props);
    return <section aria-label="Canonical item"><output>{props.itemId}</output><textarea aria-label="Retained item draft" readOnly={props.readOnly}/></section>;
  },
}));
vi.mock(
  "../../src/app/features/personal-work/services/workFeedService",
  () => ({ loadWorkFeed: api.load }),
);
vi.mock("../../src/app/features/project-access", () => ({
  ACCESS_CHANGED_EVENT: "eflow-project-access-changed",
}));
import { useWorkFeed } from "../../src/app/features/personal-work/hooks/useWorkFeed";
import { WorkInspector } from '../../src/app/features/personal-work/components/WorkInspector';
import { WorkList } from '../../src/app/features/personal-work/components/WorkList';
import { buildSubtaskDisplayMetadata } from '../../src/app/features/nested-work';
import type { WorkRow } from '../../src/app/features/personal-work/types';
const data = {
  rows: [{ key: "old" }],
  projects: [],
  workspaces: [],
  issues: [],
  unavailable: [],
  loadedAt: 1,
};
function pending() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("R10 access-sensitive feed lifecycle", () => {
  const item=():WorkRow=>({key:'office-node:deep',id:'deep',rootId:'root',title:'Same',kind:'office-node',projectTitle:'Project',workspaceName:'Office',
    timezone:'Asia/Singapore',status:'todo',due:'2026-10-21',progress:10,mine:true,leading:true,actionable:true,history:false,relation:'Subitem Lead',
    task:{id:'root',title:'Root',status:'todo',linkedProjectId:'project',orgId:'office',assigneeId:'other',createdAt:1,updatedAt:1}});
  it('NW9.2 opens canonical Office identity without a fabricated Subtask and retains drafts when feed access is revoked',()=>{
    const row=item(),selected={row,element:document.createElement('button')};
    const view=render(<WorkInspector selected={selected} current={[row]} onClose={()=>{}}/>);
    expect(api.open.mock.lastCall?.[0]).toMatchObject({itemId:'deep',rootTask:{id:'root'},readOnly:false,origin:{view:'My Work',returnFocus:selected.element}});
    fireEvent.change(screen.getByLabelText('Retained item draft'),{target:{value:'Retain draft'}});
    view.rerender(<WorkInspector selected={selected} current={[]} onClose={()=>{}}/>);
    expect(api.open.mock.lastCall?.[0]).toMatchObject({itemId:'deep',readOnly:true});
    expect((screen.getByLabelText('Retained item draft') as HTMLTextAreaElement).value).toBe('Retain draft');
    view.rerender(<WorkInspector selected={selected} current={[{...row,actionable:false}]} onClose={()=>{}}/>);
    expect(api.open.mock.lastCall?.[0].readOnly).toBe(true);
    view.rerender(<WorkInspector selected={selected} current={[{...row,mine:false,actionable:true}]} onClose={()=>{}}/>);
    expect(api.open.mock.lastCall?.[0].readOnly).toBe(true);
    expect(row.subtask).toBeUndefined();
  });
  it('NW9.2 displays permitted path, explicit Lead/count and item date instead of technical Depth',()=>{
    const row=item();
    row.workContext=buildSubtaskDisplayMetadata([
      {id:'ancestor',taskId:'root',title:'Permitted ancestor',position:0,assignedToIds:[]},
      {id:'deep',taskId:'root',title:'Same',parentSubtaskId:'ancestor',leadId:'me',position:0,assignedToIds:['worker','worker'],dueDate:'2026-10-21'},
    ],{rootId:'root',rootTitle:'Root',people:[{id:'me',name:'Current Lead'},{id:'worker',name:'Contributor'}]}).get('deep');
    const open=vi.fn();render(<WorkList rows={[row]} onOpen={open}/>);
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByLabelText('Work path').textContent).toBe('Root / Permitted ancestor / Same');
    expect(screen.getByText(/Lead: Current Lead · Contributors \(1\)/)).toBeTruthy();
    expect(screen.getByText('21 Oct 2026')).toBeTruthy();
    expect(screen.getByText('Contributor')).toBeTruthy();
    expect(screen.getByText(row.timezone)).toBeTruthy();
    expect(screen.queryByText(/Depth \d/)).toBeNull();
    const button=screen.getByRole('button');fireEvent.click(button);expect(open).toHaveBeenCalledWith(row,button);
  });
  it("does not confuse an empty selected project scope with an unrestricted fallback", async () => {
    const workspace = {
      id: "office",
      name: "Office",
      kind: "office" as const,
      office_id: "office",
      owner_id: null,
      state: "active" as const,
      timezone: "Asia/Singapore",
    };
    api.load.mockResolvedValueOnce(data);
    const next = pending();
    const view = renderHook(
      ({ ids }: { ids?: string[] }) =>
        useWorkFeed("me", { workspace, projectIds: ids }),
      { initialProps: { ids: undefined } },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockReturnValue(next.promise);
    view.rerender({ ids: [] });
    expect(view.result.current.data).toBeUndefined();
    await act(async () => next.resolve({ ...data, rows: [] }));
    expect(view.result.current.data?.rows).toEqual([]);
  });
  it("allows a slow source refresh to finish without overlapping polling", async () => {
    vi.useFakeTimers();
    const next = pending();
    api.load.mockReturnValue(next.promise);
    const view = renderHook(() => useWorkFeed("me"));
    await act(async () => vi.advanceTimersByTime(45000));
    expect(api.load).toHaveBeenCalledTimes(1);
    await act(async () => next.resolve(data));
    expect(view.result.current.data).toEqual(data);
    await act(async () => vi.advanceTimersByTime(15000));
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  it("clears rows during actor changes and ignores late responses from the old actor", async () => {
    api.load.mockResolvedValueOnce(data);
    const old = pending(),
      next = pending();
    const view = renderHook(({ user }) => useWorkFeed(user), {
      initialProps: { user: "one" },
    });
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    act(() => {
      void view.result.current.refresh();
    });
    view.rerender({ user: "two" });
    expect(view.result.current.data).toBeUndefined();
    await act(async () => old.resolve(data));
    expect(view.result.current.data).toBeUndefined();
    await act(async () => next.resolve({ ...data, rows: [] }));
    expect(view.result.current.data?.rows).toEqual([]);
  });
  it("rechecks access events, clears denied data, and unregisters on unmount", async () => {
    api.load.mockResolvedValue(data);
    const view = renderHook(() => useWorkFeed("me"));
    await waitFor(() => expect(view.result.current.data).toEqual(data));
    api.load.mockRejectedValue(new Error("Expired access"));
    act(() => window.dispatchEvent(new Event("eflow-project-access-changed")));
    await waitFor(() =>
      expect(view.result.current.error).toBe("Expired access"),
    );
    expect(view.result.current.data).toBeUndefined();
    const count = api.load.mock.calls.length;
    view.unmount();
    act(() => window.dispatchEvent(new Event("eflow-project-access-changed")));
    expect(api.load).toHaveBeenCalledTimes(count);
  });
});
