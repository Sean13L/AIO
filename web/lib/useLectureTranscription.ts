"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLectureTranscriptionOptions {
  // Seeds the running transcript (e.g. from a previously-saved lecture.transcript)
  // and re-syncs it whenever this changes while not recording — so navigating
  // away and back, or another tab's save, doesn't get silently overwritten.
  initialTranscript: string;
  // Called with the full accumulated transcript periodically while recording,
  // on stop, and (with null) on explicit clear — the caller owns persistence.
  onSave: (transcript: string | null) => void;
  saveIntervalMs?: number;
}

// Wraps the browser's (still non-standard, vendor-prefixed) SpeechRecognition
// API for continuous, live transcription. Chosen over a server-side
// streaming-audio pipeline specifically because it's free and built into the
// browser already shipping this app (Chrome/Edge) — no extra paid service,
// no audio-streaming infra, consistent with the project's "free tier first"
// stack choices elsewhere (Gemini, Neon, Vercel Blob).
export function useLectureTranscription({
  initialTranscript,
  onSave,
  saveIntervalMs = 20000,
}: UseLectureTranscriptionOptions) {
  const [finalTranscript, setFinalTranscript] = useState(initialTranscript);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef(initialTranscript);
  const lastSavedRef = useRef(initialTranscript);
  const shouldBeRecordingRef = useRef(false);
  const newSegmentPendingRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  // Re-syncs from outside changes (a fresh page load, another tab) but never
  // while actively recording, which would clobber in-progress speech.
  useEffect(() => {
    if (!isRecording) {
      setFinalTranscript(initialTranscript);
      finalTranscriptRef.current = initialTranscript;
      lastSavedRef.current = initialTranscript;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTranscript]);

  const save = useCallback(() => {
    if (finalTranscriptRef.current !== lastSavedRef.current) {
      lastSavedRef.current = finalTranscriptRef.current;
      onSave(finalTranscriptRef.current);
    }
  }, [onSave]);

  const start = useCallback(() => {
    if (isRecording || !isSupported) return;
    setError(null);
    setInterimTranscript("");

    const Ctor = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    newSegmentPendingRef.current = finalTranscriptRef.current.length > 0;

    recognition.onresult = (event) => {
      let interim = "";
      let addedFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) addedFinal += text + " ";
        else interim += text;
      }
      if (addedFinal.trim()) {
        setFinalTranscript((prev) => {
          const separator = newSegmentPendingRef.current ? "\n\n" : prev ? " " : "";
          newSegmentPendingRef.current = false;
          return prev + separator + addedFinal.trim();
        });
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return; // benign — recognition keeps listening
      const fatal =
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture";
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was denied. Allow microphone access for this site and try again."
          : event.error === "audio-capture"
            ? "No microphone was found."
            : `Speech recognition error: ${event.error}`
      );
      if (fatal) {
        shouldBeRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Chrome ends recognition on its own periodically even in continuous
      // mode — restart transparently unless the user actually asked to stop.
      if (shouldBeRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Already starting, or a transient failure — next onend retries.
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    shouldBeRecordingRef.current = true;
    setIsRecording(true);
    try {
      recognition.start();
    } catch {
      shouldBeRecordingRef.current = false;
      setIsRecording(false);
      setError("Couldn't start the microphone. Try again.");
    }
  }, [isRecording, isSupported]);

  const stop = useCallback(() => {
    shouldBeRecordingRef.current = false;
    recognitionRef.current?.stop();
    setInterimTranscript("");
    save();
  }, [save]);

  const clear = useCallback(() => {
    shouldBeRecordingRef.current = false;
    recognitionRef.current?.stop();
    setFinalTranscript("");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
    lastSavedRef.current = "";
    onSave(null);
  }, [onSave]);

  useEffect(() => {
    finalTranscriptRef.current = finalTranscript;
  }, [finalTranscript]);

  // Periodic autosave while recording, so a long lecture isn't lost to a
  // crashed tab or accidental navigation between explicit start/stop.
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(save, saveIntervalMs);
    return () => clearInterval(interval);
  }, [isRecording, saveIntervalMs, save]);

  // Best-effort stop on unmount — doesn't force a save (React state updates
  // don't flush during teardown), but the periodic autosave above already
  // covers most of a long session.
  useEffect(() => {
    return () => {
      shouldBeRecordingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isSupported,
    isRecording,
    finalTranscript,
    interimTranscript,
    error,
    start,
    stop,
    clear,
  };
}
