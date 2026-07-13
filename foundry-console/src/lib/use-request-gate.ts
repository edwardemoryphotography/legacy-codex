"use client";

import { useEffect, useRef } from "react";
import { createRequestGate, type RequestGate } from "./request-gate";

export function useRequestGate(scope: string | null = null): RequestGate {
  const gateRef = useRef<RequestGate | null>(null);

  if (!gateRef.current) gateRef.current = createRequestGate();
  gateRef.current.setScope(scope);

  useEffect(() => {
    const gate = gateRef.current;
    return () => gate?.invalidate();
  }, []);

  return gateRef.current;
}
