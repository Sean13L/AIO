"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { api } from "./api";

export interface UploadResult {
  courseId: string;
  itemsCreated: number;
  lecturesCreated: number;
  usedMock: boolean;
}

export interface UploadInput {
  files?: File[];
  text?: string;
  courseId?: string;
}

interface UploadState {
  status: "idle" | "uploading" | "done" | "error";
  result: UploadResult | null;
  error: string | null;
}

interface UploadManagerValue extends UploadState {
  startUpload: (input: UploadInput) => void;
  dismiss: () => void;
}

const UploadManagerContext = createContext<UploadManagerValue | null>(null);

// Owns the syllabus-upload request's lifecycle independently of whatever
// page happens to be mounted. Rendered once in the root layout (which never
// unmounts on client-side navigation, unlike a route's own page component),
// so starting an upload on /upload and then switching to /calendar doesn't
// lose track of it — the fetch was never actually tied to /upload's
// lifecycle anyway (a plain fetch() isn't cancelled by a component
// unmounting), but without this the UI had nowhere to show the result once
// the user had navigated away. See UploadStatusBanner for the cross-page
// indicator this state powers.
export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>({ status: "idle", result: null, error: null });
  // Guards against a slow-to-resolve previous upload's response landing
  // after a newer one has already started and clobbering its state.
  const requestIdRef = useRef(0);

  const startUpload = useCallback((input: UploadInput) => {
    const requestId = ++requestIdRef.current;
    setState({ status: "uploading", result: null, error: null });

    api
      .uploadSyllabus(input)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: "done", result, error: null });
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: "error", result: null, error: (err as Error).message });
      });
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: "idle", result: null, error: null });
  }, []);

  return (
    <UploadManagerContext.Provider value={{ ...state, startUpload, dismiss }}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager(): UploadManagerValue {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used within UploadManagerProvider");
  return ctx;
}
