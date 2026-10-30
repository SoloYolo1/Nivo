// Minimal typings for Node's built-in test runner (keeps @types/node out of the app).
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
  const t: typeof test; export default t;
}
declare module 'node:assert/strict' {
  interface A {
    (v: unknown, msg?: string): void;
    equal(a: unknown, b: unknown, msg?: string): void;
    match(s: string, re: RegExp, msg?: string): void;
    deepEqual(a: unknown, b: unknown, msg?: string): void;
    ok(v: unknown, msg?: string): void;
    notEqual(a: unknown, b: unknown, msg?: string): void;
  }
  const assert: A; export default assert;
}
declare module 'node:fs' { export function readFileSync(p: string, enc: string): string }
