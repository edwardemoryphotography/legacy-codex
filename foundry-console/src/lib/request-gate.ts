export interface RequestGate {
  begin: () => number;
  isCurrent: (token: number) => boolean;
  invalidate: () => void;
}

export function createRequestGate(): RequestGate {
  let current = 0;

  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(token) {
      return token === current;
    },
    invalidate() {
      current += 1;
    },
  };
}
