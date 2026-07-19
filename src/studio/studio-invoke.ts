// One way to call a studio edge function.
//
// supabase.functions.invoke wraps every non-2xx in a FunctionsHttpError whose
// message is a fixed generic string; the EF's real error code and detail live
// on error.context (the Response). Unwrapping that was copy-pasted into three
// modules and the copies drifted (only one kept the HTTP status). This is the
// single copy, and every caller gets code, status, and detail.

import { supabase } from "@/integrations/supabase/client";

export interface EfError extends Error {
  /** The EF's own error code, e.g. "rate_limited" or "no_providers". */
  code?: string;
  /** HTTP status, for callers that branch on 401/403/429. */
  status?: number;
  detail?: unknown;
}

export async function invokeStudioFunction<T = unknown>(
  name: string, body: unknown,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let payload: { error?: string; detail?: unknown } | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try { payload = await ctx.json(); } catch { /* non-JSON body */ }
    }
    const err = new Error(payload?.error ?? error.message) as EfError;
    err.code = payload?.error;
    err.status = ctx?.status;
    err.detail = payload?.detail;
    throw err;
  }
  return data as T;
}
