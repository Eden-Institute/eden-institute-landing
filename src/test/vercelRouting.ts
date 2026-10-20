/**
 * A small model of how Vercel routes one request through vercel.json, for tests.
 *
 * Order, as Vercel applies it to a static deployment:
 *   1. redirects, first match wins (308 when permanent, 307 when not)
 *   2. the filesystem: a built file at the path, or <path>/index.html
 *   3. rewrites, first match wins
 *   4. nothing matched: HTTP 404, with dist/404.html as the body
 * The caller supplies the filesystem as a function, so the same model runs
 * against the source tree (unit tests) or a built dist/.
 *
 * Sources compile the way @vercel/routing-utils compiles them (sourceToRegex):
 * path-to-regexp 6 with strict: true, sensitive: true, delimiter "/". So
 * matching is case-sensitive, a trailing slash is not optional unless the
 * pattern says so, and a custom (...) pattern is used as written.
 * sourceToRegExp() below is a port of that library's lexer, parser and
 * tokensToRegexp for exactly those options. It is a test model, not Vercel:
 * only a Vercel preview proves what production does.
 */

type Token =
  | string
  | { name: string | number; prefix: string; suffix: string; pattern: string; modifier: string };

type LexToken = { type: "MODIFIER" | "ESCAPED_CHAR" | "OPEN" | "CLOSE" | "NAME" | "PATTERN" | "CHAR" | "END"; index: number; value: string };

function lexer(str: string): LexToken[] {
  const tokens: LexToken[] = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      let name = "";
      let j = i + 1;
      while (j < str.length && /[0-9A-Za-z_]/.test(str[j])) name += str[j++];
      if (!name) throw new TypeError(`Missing parameter name at ${i}`);
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      let count = 1;
      let pattern = "";
      let j = i + 1;
      if (str[j] === "?") throw new TypeError(`Pattern cannot start with "?" at ${j}`);
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") throw new TypeError(`Capturing groups are not allowed at ${j}`);
        }
        pattern += str[j++];
      }
      if (count) throw new TypeError(`Unbalanced pattern at ${i}`);
      if (!pattern) throw new TypeError(`Missing pattern at ${i}`);
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}

const escapeString = (s: string) => s.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");

const DELIMITER = "/";
const PREFIXES = "./";
const DEFAULT_PATTERN = `[^${escapeString(DELIMITER)}]+?`;

function parse(str: string): Token[] {
  const tokens = lexer(str);
  const result: Token[] = [];
  let key = 0;
  let i = 0;
  let path = "";
  const tryConsume = (type: LexToken["type"]) => (i < tokens.length && tokens[i].type === type ? tokens[i++].value : undefined);
  const mustConsume = (type: LexToken["type"]) => {
    const value = tryConsume(type);
    if (value !== undefined) return value;
    const { type: nextType, index } = tokens[i];
    throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
  };
  const consumeText = () => {
    let out = "";
    let value: string | undefined;
    while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) out += value;
    return out;
  };

  while (i < tokens.length) {
    const char = tryConsume("CHAR");
    const name = tryConsume("NAME");
    const pattern = tryConsume("PATTERN");
    if (name || pattern) {
      let prefix = char || "";
      if (PREFIXES.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({ name: name || key++, prefix, suffix: "", pattern: pattern || DEFAULT_PATTERN, modifier: tryConsume("MODIFIER") || "" });
      continue;
    }
    const value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    const open = tryConsume("OPEN");
    if (open) {
      const prefix = consumeText();
      const groupName = tryConsume("NAME") || "";
      const groupPattern = tryConsume("PATTERN") || "";
      const suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: groupName || (groupPattern ? key++ : ""),
        pattern: groupName && !groupPattern ? DEFAULT_PATTERN : groupPattern,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || "",
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}

/** A vercel.json `source` as the regular expression Vercel matches the path with, plus its parameter names in capture order. */
export function sourceToRegExp(source: string): { re: RegExp; keys: (string | number)[] } {
  const keys: (string | number)[] = [];
  let route = "^";
  for (const token of parse(source)) {
    if (typeof token === "string") {
      route += escapeString(token);
      continue;
    }
    const prefix = escapeString(token.prefix);
    const suffix = escapeString(token.suffix);
    if (!token.pattern) {
      route += `(?:${prefix}${suffix})${token.modifier}`;
      continue;
    }
    keys.push(token.name);
    if (prefix || suffix) {
      if (token.modifier === "+" || token.modifier === "*") {
        const mod = token.modifier === "*" ? "?" : "";
        route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
      } else {
        route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
      }
    } else if (token.modifier === "+" || token.modifier === "*") {
      route += `((?:${token.pattern})${token.modifier})`;
    } else {
      route += `(${token.pattern})${token.modifier}`;
    }
  }
  // strict: true adds no optional trailing delimiter; end: true anchors.
  route += "$";
  // sensitive: true, so no "i" flag.
  return { re: new RegExp(route), keys };
}

export interface Condition {
  type: string;
  key: string;
  value?: string;
}

export interface Redirect {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
  has?: Condition[];
  missing?: Condition[];
}

export interface Rewrite {
  source: string;
  destination: string;
  has?: Condition[];
  missing?: Condition[];
}

export interface VercelConfig {
  trailingSlash?: boolean;
  redirects?: Redirect[];
  rewrites?: Rewrite[];
}

export type Outcome =
  | { kind: "redirect"; status: number; location: string; source: string }
  | { kind: "file"; file: string }
  | { kind: "rewrite"; destination: string; source: string }
  | { kind: "404" };

/** The host a request goes to unless a test names another (the talesandtabletalk.com rules match on host). */
export const SITE_HOST = "edeninstitute.health";

/** Does a has/missing host condition match this host? Vercel reads the value as a full-match pattern. */
function hostMatches(c: Condition, host: string): boolean {
  if (c.value === undefined) throw new Error("model needs a value on host conditions");
  return new RegExp(`^(?:${c.value})$`).test(host);
}

/** Match one rule against a path, query and host. Returns its parameters, or null. */
function matchRule(rule: Redirect | Rewrite, pathname: string, query: URLSearchParams, host: string): Record<string, string> | null {
  const { re, keys } = sourceToRegExp(rule.source);
  const m = re.exec(pathname);
  if (!m) return null;
  const params: Record<string, string> = {};
  keys.forEach((k, idx) => {
    if (m[idx + 1] !== undefined) params[String(k)] = m[idx + 1];
  });
  for (const c of rule.has ?? []) {
    if (c.type === "host") {
      if (!hostMatches(c, host)) return null;
      continue;
    }
    if (c.type !== "query") throw new Error(`model handles query and host conditions only, got ${c.type}`);
    const v = query.get(c.key);
    if (v === null) return null;
    if (c.value !== undefined) {
      const cm = new RegExp(`^(?:${c.value})$`).exec(v);
      if (!cm) return null;
      Object.assign(params, cm.groups ?? {});
    }
  }
  for (const c of rule.missing ?? []) {
    if (c.type === "host") {
      if (hostMatches(c, host)) return null;
      continue;
    }
    if (c.type !== "query") throw new Error(`model handles query and host conditions only, got ${c.type}`);
    if (query.has(c.key)) return null;
  }
  return params;
}

/** Fill :name (and :name* / :name+) placeholders in a destination with the matched parameters. */
function fill(destination: string, params: Record<string, string>): string {
  return destination.replace(/:([A-Za-z_][0-9A-Za-z_]*)[*+]?/g, (whole, name: string) => (name in params ? params[name] : whole));
}

/**
 * Route one request URL (path plus optional ?query): redirects, then the
 * filesystem (`fileFor` returns the file that serves a path, or null), then
 * rewrites, then 404.
 */
export function route(config: VercelConfig, url: string, fileFor: (pathname: string) => string | null, host: string = SITE_HOST): Outcome {
  const [pathname, search = ""] = url.split("?");
  const query = new URLSearchParams(search);
  // trailingSlash: false runs before every other rule: /path/ answers 308 to /path, query kept.
  if (config.trailingSlash === false && pathname.length > 1 && pathname.endsWith("/")) {
    return { kind: "redirect", status: 308, location: pathname.slice(0, -1) + (search ? `?${search}` : ""), source: "trailingSlash: false" };
  }
  for (const r of config.redirects ?? []) {
    const params = matchRule(r, pathname, query, host);
    if (params) return { kind: "redirect", status: r.statusCode ?? (r.permanent ? 308 : 307), location: fill(r.destination, params), source: r.source };
  }
  const file = fileFor(pathname);
  if (file) return { kind: "file", file };
  for (const r of config.rewrites ?? []) {
    const params = matchRule(r, pathname, query, host);
    if (params) return { kind: "rewrite", destination: fill(r.destination, params), source: r.source };
  }
  return { kind: "404" };
}

/** Does this rule's source match the path (ignoring has/missing)? */
export function sourceMatches(source: string, pathname: string): boolean {
  return sourceToRegExp(source).re.test(pathname);
}
