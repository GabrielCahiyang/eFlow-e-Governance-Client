import {describe, expect, it} from 'vitest';
import {buildWorkDisplayTree, expandWorkDisplayFocus, selectWorkCollapsedIds, selectWorkDisplayTree, updateWorkCollapsedIds} from '../../src/app/features/nested-work/selectors/displayTree';
import type {WorkNode} from '../../src/app/features/nested-work/types';
import {buildWorkNodeDisplayMetadata,buildSubtaskDisplayMetadata} from '../../src/app/features/nested-work';

const node = (id: string, parent: string | null = null, order = 0, patch: Partial<WorkNode> = {}): WorkNode => ({
  id, task_id: 'root', parent_subtask_id: parent, sibling_order: order, title: id,
  depth: 1, position: 0, lead_id: 'lead', assigned_to_ids: ['worker'], due_date: null,
  is_standalone: false, status: 'todo', percent_complete: 0,
  can_manage: false, can_appoint: false, can_order: false, can_work: false, can_review: false, ...patch,
});
const ids = (rows: readonly {id: string}[]) => rows.map(row => row.id);
const deepNodes = (count = 8) => Array.from({length: count}, (_, index) =>
  node(`level-${index + 1}`, index ? `level-${index}` : null, 0, {depth: index + 1}));

describe('NW9.1 authorized display adapters through the public API', () => {
  const scope={rootId:'root',rootTitle:'Task',people:[{id:'lead',name:'Appointed Lead'}]};
  it('keeps duplicate titles distinct by canonical parent and includes the permitted Task', () => {
    const nodes=[node('a',null,1,{title:'Same'}),node('b',null,0,{title:'Same'}),
      node('a-child','a',0,{title:'Same'}),node('b-child','b',0,{title:'Same'})];
    const contexts=buildWorkNodeDisplayMetadata(nodes,scope);
    expect([...contexts.keys()]).toEqual(['b','b-child','a','a-child']);
    expect(contexts.get('a-child')?.path.map(part=>part.id)).toEqual(['root','a','a-child']);
    expect(contexts.get('b-child')?.path.map(part=>part.id)).toEqual(['root','b','b-child']);
    expect(contexts.get('a-child')?.pathLabel).toBe('Task / Same / Same');
  });
  it('retains all eight item levels and the independently authorized root', () => {
    const nodes=deepNodes().map(item=>({...item,title:'Same'}));
    const last=buildWorkNodeDisplayMetadata(nodes.reverse(),scope).get('level-8');
    expect(last?.path.map(part=>part.id)).toEqual(['root',...deepNodes().map(item=>item.id)]);
    expect(last).toMatchObject({nodeId:'level-8',parentId:'level-7',context:null,pathTruncated:false});
  });
  it('never fills missing/denied ancestry from a foreign root, title or directory', () => {
    const contexts=buildWorkNodeDisplayMetadata([node('orphan','hidden'),node('child','orphan'),
      node('hidden',null,0,{task_id:'foreign',title:'SECRET ancestor'})],scope);
    expect([...contexts.keys()]).toEqual(['orphan','child']);
    expect(contexts.get('child')).toMatchObject({parentId:'orphan',context:'missing_parent',
      pathLabel:'Parent context unavailable / orphan / child'});
    expect(contexts.get('orphan')?.parentId).toBe('hidden');
    expect(contexts.get('child')?.path.map(part=>part.id)).toEqual(['orphan','child']);
    expect(JSON.stringify([...contexts.values()])).not.toContain('SECRET');
    expect(contexts.get('child')?.pathLabel).not.toContain('Task');
    expect(buildWorkNodeDisplayMetadata([node('leaf')],{rootId:'root',people:[]}).get('leaf')?.pathLabel).toBe('leaf');
  });
  it('bounds malformed cycles/over-depth paths and excludes ambiguous canonical IDs', () => {
    const cycle=buildWorkNodeDisplayMetadata([node('a','b'),node('b','a')],scope);
    expect(cycle.get('b')).toMatchObject({context:'cycle',pathLabel:'Cycle in hierarchy / a / b'});
    expect(cycle.get('b')?.path.map(part=>part.id)).toEqual(['a','b']);
    const long=buildWorkNodeDisplayMetadata(deepNodes(40),scope).get('level-40');
    expect(long?.path).toHaveLength(8);
    expect(long?.pathTruncated).toBe(true);
    expect(long?.pathLabel).toContain('Earlier context unavailable');
    expect(long?.path.map(part=>part.id)).not.toContain('root');
    const duplicate=buildWorkNodeDisplayMetadata([node('ambiguous'),node('ambiguous'),node('child','ambiguous')],scope);
    expect(duplicate.has('ambiguous')).toBe(false);
    expect(duplicate.get('child')?.context).toBe('missing_parent');
  });
  it('normalizes camelCase parentage without changing original records or inferring it from order', () => {
    const records=Object.freeze([
      Object.freeze({id:'child',taskId:'root',title:'Same',parentSubtaskId:'parent',leadId:'lead',assignedToIds:Object.freeze(['worker']),position:-99,siblingOrder:0,dueDate:'2026-10-20'}),
      Object.freeze({id:'parent',taskId:'root',title:'Same',assignedToIds:Object.freeze(['worker']),position:99}),
    ]);
    const contexts=buildSubtaskDisplayMetadata(records,scope);
    expect(contexts.get('child')).toMatchObject({parentId:'parent',leadId:'lead',leadName:'Appointed Lead',dueDate:'2026-10-20',pathLabel:'Task / Same / Same'});
    expect(contexts.get('parent')).toMatchObject({parentId:null,leadId:null,leadName:null,dueDate:null});
    expect(records[0].assignedToIds).toEqual(['worker']);
    expect(records[0].parentSubtaskId).toBe('parent');
    expect('parent_subtask_id' in records[0]).toBe(false);
  });
});

describe('display-only work hierarchy traversal', () => {
  it('handles an empty supplied tree', () => {
    expect(buildWorkDisplayTree([])).toEqual([]);
    expect(selectWorkDisplayTree([], new Set(['absent']), 'absent')).toEqual({rows: [], collapsedIds: new Set(['absent'])});
  });

  it('orders parents before children, with sibling_order then stable ID ties', () => {
    const input = [node('z', 'root-a', 2), node('root-b', null, 2), node('leaf', 'a'),
      node('b', 'root-a'), node('root-a', null, 1), node('a', 'root-a'), node('early', 'root-a', -1)];
    expect(ids(buildWorkDisplayTree(input))).toEqual(['root-a', 'early', 'a', 'leaf', 'b', 'z', 'root-b']);
    expect(buildWorkDisplayTree([...input].reverse())).toEqual(buildWorkDisplayTree(input));
  });

  it('uses canonical parent IDs rather than position, stored depth or input adjacency', () => {
    const rows = buildWorkDisplayTree([node('child', 'parent', 0, {position: -999, depth: 8}),
      node('other', null, 1, {position: -100}), node('parent', null, 0, {depth: 8})]);
    expect(ids(rows)).toEqual(['parent', 'child', 'other']);
    expect(rows[1]).toMatchObject({parentId: 'parent', displayParentId: 'parent', parentLabel: 'parent', depth: 2, indentLevel: 1});
    expect(rows[1].path).toEqual([{id: 'parent', title: 'parent'}, {id: 'child', title: 'child'}]);
  });

  it('retains depth-eight paths while capping indentation after three levels', () => {
    const rows = buildWorkDisplayTree(deepNodes().reverse());
    expect(rows.map(row => row.depth)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.map(row => row.indentLevel)).toEqual([0, 1, 2, 3, 3, 3, 3, 3]);
    expect(rows[7].path).toHaveLength(8);
    expect(rows[7].pathLabel).toBe(deepNodes().map(item => item.title).join(' / '));
    expect(rows[7]).toMatchObject({context: null, pathTruncated: false, parentLabel: 'level-7'});
  });

  it('preserves duplicate titles as distinct canonical IDs and branches', () => {
    const rows = buildWorkDisplayTree([node('a', null, 0, {title: 'Same'}), node('b', null, 1, {title: 'Same'}),
      node('a-child', 'a', 0, {title: 'Same'}), node('b-child', 'b', 0, {title: 'Same'})]);
    expect(ids(rows)).toEqual(['a', 'a-child', 'b', 'b-child']);
    expect(rows[1].path.map(part => part.id)).toEqual(['a', 'a-child']);
    expect(rows[3].path.map(part => part.id)).toEqual(['b', 'b-child']);
    expect(rows[1].pathLabel).toBe('Same / Same');
    expect(ids(selectWorkDisplayTree(rows.map(row => node(row.id, row.parentId, 0, {title: row.title})), new Set(['a'])).rows))
      .toEqual(['a', 'b', 'b-child']);
  });

  it('marks a missing parent and inherited unknown context without inventing ancestors', () => {
    const rows = buildWorkDisplayTree([node('child', 'orphan'), node('orphan', 'protected-parent', 0, {depth: 7})]);
    expect(ids(rows)).toEqual(['orphan', 'child']);
    expect(rows[0]).toMatchObject({parentId: 'protected-parent', displayParentId: null,
      parentLabel: 'Parent unavailable', context: 'missing_parent', pathLabel: 'Parent context unavailable / orphan'});
    expect(rows[1]).toMatchObject({parentLabel: 'orphan', context: 'missing_parent', pathLabel: 'Parent context unavailable / orphan / child'});
    expect(rows.flatMap(row => row.path.map(part => part.id))).not.toContain('protected-parent');
  });

  it('bounds a self-cycle and keeps its canonical parent explicit', () => {
    const rows = buildWorkDisplayTree([node('self', 'self')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({parentId: 'self', displayParentId: null, parentLabel: 'self',
      depth: 1, context: 'cycle', pathLabel: 'Cycle in hierarchy / self', hasChildren: false});
  });

  it('breaks one stable cycle edge for display, retains attached descendants and other roots', () => {
    const input = [node('b', 'a', 2), node('a', 'b', 1), node('attached', 'b'), node('normal', null, 3)];
    const rows = buildWorkDisplayTree(input);
    expect(ids(rows)).toEqual(['a', 'b', 'attached', 'normal']);
    expect(rows[0]).toMatchObject({parentId: 'b', displayParentId: null, context: 'cycle'});
    expect(rows[2]).toMatchObject({parentLabel: 'b', context: 'cycle', pathLabel: 'Cycle in hierarchy / a / b / attached'});
    expect(rows[3].context).toBeNull();
    expect(buildWorkDisplayTree([...input].reverse())).toEqual(rows);
  });

  it('resolves multiple disconnected cycles and missing-parent branches once each', () => {
    const input = [node('b', 'a'), node('a', 'b'), node('self', 'self'), node('orphan', 'missing'), node('leaf', 'orphan')];
    const rows = buildWorkDisplayTree(input);
    expect(ids(rows)).toEqual(['a', 'b', 'orphan', 'leaf', 'self']);
    expect(new Set(ids(rows)).size).toBe(input.length);
    expect(rows.map(row => row.context)).toEqual(['cycle', 'cycle', 'missing_parent', 'missing_parent', 'cycle']);
  });

  it('bounds malformed over-depth paths and avoids recursive stack overflow', () => {
    const rows = buildWorkDisplayTree(deepNodes(2000).reverse());
    expect(rows).toHaveLength(2000);
    expect(rows[1999]).toMatchObject({depth: 2000, indentLevel: 3, pathTruncated: true});
    expect(rows[1999].path.map(part => part.id)).toEqual(deepNodes(2000).slice(-8).map(item => item.id));
    expect(rows[1999].pathLabel).toMatch(/^Earlier context unavailable \/ level-1993/);
    expect(rows.every(row => row.path.length <= 8)).toBe(true);
  });

  it('is immutable and has identical display output for any work-authority flags', () => {
    const original = [node('child', 'parent'), node('parent')];
    const before = structuredClone(original);
    for (const item of original) Object.freeze(item);
    Object.freeze(original);
    const rows = buildWorkDisplayTree(original);
    expect(original).toEqual(before);
    expect(rows).toEqual(buildWorkDisplayTree(before.map(item => ({...item, lead_id: null, assigned_to_ids: [],
      can_manage: true, can_appoint: true, can_order: true, can_work: true, can_review: true}))));
  });
});

describe('controlled collapse and focus selectors', () => {
  const input = [node('root-a'), node('child-a', 'root-a'), node('leaf-a', 'child-a'),
    node('sibling-a', 'root-a', 1), node('root-b', null, 1), node('child-b', 'root-b')];

  it('hides whole collapsed branches and restores stable traversal when expanded', () => {
    expect(ids(selectWorkDisplayTree(input, new Set(['root-a'])).rows)).toEqual(['root-a', 'root-b', 'child-b']);
    expect(ids(selectWorkDisplayTree(input, new Set(['child-a'])).rows)).toEqual(['root-a', 'child-a', 'sibling-a', 'root-b', 'child-b']);
    expect(ids(selectWorkDisplayTree(input, new Set()).rows)).toEqual(ids(buildWorkDisplayTree(input)));
  });

  it('focus expands only the hidden descendant chain, retaining unrelated/own collapse state', () => {
    const collapsed = new Set(['root-a', 'child-a', 'leaf-a', 'root-b', 'stale-id']);
    const result = selectWorkDisplayTree(input, collapsed, 'leaf-a');
    expect(ids(result.rows)).toEqual(['root-a', 'child-a', 'leaf-a', 'sibling-a', 'root-b']);
    expect(result.collapsedIds).toEqual(new Set(['leaf-a', 'root-b', 'stale-id']));
    expect(collapsed).toEqual(new Set(['root-a', 'child-a', 'leaf-a', 'root-b', 'stale-id']));
    expect(ids(selectWorkDisplayTree(input, result.collapsedIds).rows)).toContain('leaf-a');
  });

  it('reaches a focused depth-eight node with duplicate titles', () => {
    const nodes = deepNodes().map(item => ({...item, title: 'Same'}));
    const result = selectWorkDisplayTree(nodes, new Set(nodes.map(item => item.id)), 'level-8');
    expect(result.rows).toHaveLength(8);
    expect(result.collapsedIds).toEqual(new Set(['level-8']));
  });

  it('leaves collapse state unchanged for absent focus or focused root', () => {
    const collapsed = new Set(['root-a', 'root-b']);
    for (const focused of [undefined, 'absent', 'root-a']) {
      expect(expandWorkDisplayFocus(buildWorkDisplayTree(input), collapsed, focused)).toEqual(collapsed);
    }
  });

  it('focuses an authorized orphan descendant without resolving its missing ancestor', () => {
    const result = selectWorkDisplayTree([node('orphan', 'unreadable'), node('child', 'orphan')], new Set(['orphan', 'unreadable', 'other']), 'child');
    expect(ids(result.rows)).toEqual(['orphan', 'child']);
    expect(result.collapsedIds).toEqual(new Set(['unreadable', 'other']));
    expect(result.rows[1].context).toBe('missing_parent');
  });

  it('focus remains reachable in a cycle without clearing unrelated collapse state', () => {
    const result = selectWorkDisplayTree([node('a', 'b'), node('b', 'a'), node('leaf', 'b'), node('other')],
      new Set(['a', 'b', 'other']), 'leaf');
    expect(ids(result.rows)).toEqual(['a', 'b', 'leaf', 'other']);
    expect(result.collapsedIds).toEqual(new Set(['other']));
  });

  it('bounds malformed focused ancestor loops supplied to the expansion helper', () => {
    const rows = buildWorkDisplayTree([node('a'), node('b')]);
    rows[0].displayParentId = 'b'; rows[1].displayParentId = 'a';
    expect(expandWorkDisplayFocus(rows, new Set(['a', 'b', 'unrelated']), 'a')).toEqual(new Set(['a', 'unrelated']));
  });

  it('keeps focused malformed over-depth work reachable through its entire supplied chain', () => {
    const nodes = deepNodes(2000);
    const result = selectWorkDisplayTree(nodes, new Set(nodes.map(item => item.id)), 'level-2000');
    expect(result.rows).toHaveLength(2000);
    expect(result.collapsedIds).toEqual(new Set(['level-2000']));
  });
});

describe('actor/root collapse state', () => {
  it('retains independent roots for the same actor and copies caller/read sets', () => {
    const collapsed = new Set(['a']);
    const first = updateWorkCollapsedIds(undefined, 'actor', 'root-a', collapsed);
    const second = updateWorkCollapsedIds(first, 'actor', 'root-b', new Set(['b']));
    collapsed.add('changed');
    expect(selectWorkCollapsedIds(second, 'actor', 'root-a')).toEqual(new Set(['a']));
    expect(selectWorkCollapsedIds(second, 'actor', 'root-b')).toEqual(new Set(['b']));
    expect(selectWorkCollapsedIds(first, 'actor', 'root-b')).toEqual(new Set());
    const read = selectWorkCollapsedIds(second, 'actor', 'root-a');
    read.clear();
    expect(selectWorkCollapsedIds(second, 'actor', 'root-a')).toEqual(new Set(['a']));
  });

  it('isolates actor switches and logout, including switching back to the old actor', () => {
    const first = updateWorkCollapsedIds(undefined, 'actor-a', 'root', new Set(['a']));
    expect(selectWorkCollapsedIds(first, 'actor-b', 'root')).toEqual(new Set());
    expect(selectWorkCollapsedIds(first, null, 'root')).toEqual(new Set());
    const second = updateWorkCollapsedIds(first, 'actor-b', 'root', new Set(['b']));
    expect(selectWorkCollapsedIds(second, 'actor-a', 'root')).toEqual(new Set());
    const logout = updateWorkCollapsedIds(second, null, 'root', new Set(['b']));
    expect(logout.roots.size).toBe(0);
    expect(selectWorkCollapsedIds(logout, 'actor-b', 'root')).toEqual(new Set());
    const back = updateWorkCollapsedIds(second, 'actor-a', 'different-root', new Set());
    expect(selectWorkCollapsedIds(back, 'actor-a', 'root')).toEqual(new Set());
  });

  it('records focused expansion only in its actor/root while preserving other roots', () => {
    let state = updateWorkCollapsedIds(undefined, 'actor', 'root-a', new Set(['parent', 'other']));
    state = updateWorkCollapsedIds(state, 'actor', 'root-b', new Set(['parent']));
    const result = selectWorkDisplayTree([node('parent'), node('child', 'parent'), node('other')],
      selectWorkCollapsedIds(state, 'actor', 'root-a'), 'child');
    const next = updateWorkCollapsedIds(state, 'actor', 'root-a', result.collapsedIds);
    expect(selectWorkCollapsedIds(next, 'actor', 'root-a')).toEqual(new Set(['other']));
    expect(selectWorkCollapsedIds(next, 'actor', 'root-b')).toEqual(new Set(['parent']));
    expect(selectWorkCollapsedIds(state, 'actor', 'root-a')).toEqual(new Set(['parent', 'other']));
  });
});
