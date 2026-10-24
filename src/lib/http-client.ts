type ErrorEnvelope = {
  error?: { code?: string; message?: string };
};

function friendlyMessage(status: number, code?: string) {
  if (status === 401)
    return "Sesi berakhir. Muat ulang halaman lalu masuk lagi.";
  if (status === 403)
    return "Permintaan ditolak. Muat ulang halaman lalu coba lagi.";
  if (code === "VALIDATION_ERROR") return "Periksa kembali isian formulir.";
  if (status >= 500) return "Terjadi kesalahan. Coba lagi.";
  return undefined;
}

async function readError(response: Response) {
  const body = (await response
    .json()
    .catch(() => null)) as ErrorEnvelope | null;
  return (
    friendlyMessage(response.status, body?.error?.code) ??
    body?.error?.message ??
    "Permintaan gagal. Coba lagi."
  );
}

export async function getJson<T>(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function sendJson<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  input?: unknown,
) {
  const response = await fetch(path, {
    method,
    headers:
      input === undefined ? undefined : { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return null as T;
  const body = (await response.json()) as { data: T };
  return body.data;
}

export function postJson<T>(path: string, input: unknown) {
  return sendJson<T>("POST", path, input);
}

export function patchJson<T>(path: string, input: unknown) {
  return sendJson<T>("PATCH", path, input);
}

export function putJson<T>(path: string, input: unknown) {
  return sendJson<T>("PUT", path, input);
}

export function deleteJson<T>(path: string) {
  return sendJson<T>("DELETE", path);
}
