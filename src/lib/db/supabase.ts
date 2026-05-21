import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;

function initClient(): SupabaseClient | undefined {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return undefined;

  _client = createClient(url, key);
  return _client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function noop(): any {
  return new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === "then") return undefined;
        return noop;
      },
      apply() {
        return noop();
      },
    }
  );
}

function from(table: string) {
  const c = initClient();
  if (!c) return noop();
  return c.from(table);
}

export const supabase = { from } as unknown as SupabaseClient;
