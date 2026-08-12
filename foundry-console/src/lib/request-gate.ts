export interface RequestGate {
  begin: () => number;
  isCurrent: (token: number, scope?: string | null) => boolean;
  isScopeCurrent: (scope: string | null) => boolean;
  setScope: (scope: string | null) => void;
  invalidate: () => void;
}

export function createRequestGate(): RequestGate {
  let current = 0;
  let activeScope: string | null = null;

  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(token, scope) {
      return token === current && (scope === undefined || scope === activeScope);
    },
    isScopeCurrent(scope) {
      return scope === activeScope;
    },
    setScope(scope) {
      if (scope === activeScope) return;
      activeScope = scope;
      current += 1;
    },
    invalidate() {
      current += 1;
    },
  };
}
