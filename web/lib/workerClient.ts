// Talks to the worker/ service (persistent container) for anything that
// needs a real filesystem — this app is meant to be deployable serverless,
// where local disk writes don't persist across requests/instances.

type Namespace = "lectures" | "syllabi";

function requireWorkerConfig(): { url: string; apiKey: string } {
  const url = process.env.WORKER_URL;
  const apiKey = process.env.WORKER_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "WORKER_URL and WORKER_API_KEY must be set — file uploads and lecture previews depend " +
        "on the worker service (see worker/README or .env.example)."
    );
  }
  return { url, apiKey };
}

export async function uploadFileToWorker(
  namespace: Namespace,
  file: { buffer: Buffer; filename: string },
  desiredFilename?: string
): Promise<{ filename: string; url: string }> {
  const { url, apiKey } = requireWorkerConfig();

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(file.buffer)]), file.filename);
  if (desiredFilename) formData.append("filename", desiredFilename);

  const res = await fetch(`${url}/files/${namespace}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Worker upload failed: ${body.error ?? res.statusText}`);
  }
  return res.json();
}

export async function getFileTextFromWorker(
  namespace: Namespace,
  filename: string
): Promise<string | null> {
  const { url, apiKey } = requireWorkerConfig();

  const res = await fetch(`${url}/files/${namespace}/${filename}/text`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Worker text extraction failed: ${body.error ?? res.statusText}`);
  }
  const data = await res.json();
  return data.text;
}

// The web app never has local disk access to the file — the filename
// encoded in slides_url (a worker-served URL) is the only handle it keeps.
export function filenameFromWorkerUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  return fileUrl.split("/").pop() ?? null;
}
