/** One authenticated actor/Office/role scope. Late reads cannot repopulate an old scope. */
export interface ProjectCommandCacheScope { readonly identity: string }
export function createProjectCommandCache<T>() {
  let activeScope: ProjectCommandCacheScope = { identity: '' };
  const entries = new Map<string, T>();
  return {
    reset() {
      entries.clear();
      activeScope = { identity: '' };
    },
    selectScope(identity: string) {
      if (identity !== activeScope.identity) {
        entries.clear();
        activeScope = { identity };
      }
      return activeScope;
    },
    get(scope: ProjectCommandCacheScope, projectId: string) {
      return scope === activeScope ? entries.get(projectId) : undefined;
    },
    set(scope: ProjectCommandCacheScope, projectId: string, value: T) {
      if (scope === activeScope) entries.set(projectId, value);
    },
  };
}
