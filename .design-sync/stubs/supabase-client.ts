// Design-sync stub for `@/integrations/supabase/client`.
//
// The real client runs `createClient(import.meta.env.VITE_SUPABASE_URL, ...)`
// at MODULE scope. In the esbuild IIFE there is no Vite env, so the URL is
// undefined and createClient throws "supabaseUrl is required" — which crashes
// the entire window.<global> assignment and takes every component down with it.
//
// This harmless chainable proxy lets any component import `{ supabase }`
// without a module-eval throw. Design previews never touch the network; if a
// component calls a supabase method at render time it simply gets a no-op
// chainable that awaits to itself.
const make = (): any =>
  new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? undefined : make()),
    apply: () => make(),
  });

export const supabase: any = make();
export default supabase;
