import { headers } from 'next/headers';

// Without JavaScript the posting steps can't move (./steps.ts): this shows every step at once
// with the plain save and publish buttons, as before wave 1. Only inside <noscript>, so browsers
// with JavaScript never apply it. The page's CSP nonce lets the style through.

const CSS = '[data-step]{display:block!important}[data-step-bar]{display:none!important}[data-noscript-actions]{display:flex!important}';

export async function NoScriptSteps() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <noscript>
      <style nonce={nonce}>{CSS}</style>
    </noscript>
  );
}
