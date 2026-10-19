/** Minimal Deno globals so `tsc` can check the functions from Node. Not loaded by the Deno runtime. */
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  const env: { get(name: string): string | undefined };
}
