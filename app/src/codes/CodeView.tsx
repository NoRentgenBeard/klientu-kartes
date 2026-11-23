import { useEffect, useState } from 'preact/hooks';
import type { CodeFormat } from '../db/types';
import { lv } from '../i18n/lv';
import type { RenderedCode } from './render';
import './codes.css';

type RenderFn = typeof import('./render').renderCode;
let renderFn: RenderFn | undefined;
const loadRender = () => import('./render').then((m) => (renderFn = m.renderCode));

/** Long QR payloads (e.g. URLs) aren't useful for a cashier to type; hide them. */
const MAX_SHOWN_LENGTH = 32;

function withSvgAttrs(r: RenderedCode): string {
  const attrs = r.twoD
    ? 'preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"'
    : 'preserveAspectRatio="none" shape-rendering="crispEdges"';
  return r.svg.replace('<svg ', `<svg ${attrs} aria-hidden="true" `);
}

interface Props {
  value: string;
  format: CodeFormat;
  layout: 'portrait' | 'landscape';
}

/** White box with the generated code and the number below it (SPEC 6.2–6.3). */
export function CodeView({ value, format, layout }: Props) {
  const [rendered, setRendered] = useState<RenderedCode | null | undefined>(() => renderFn?.(value, format));

  useEffect(() => {
    let alive = true;
    const run = (fn: RenderFn) => alive && setRendered(fn(value, format));
    if (renderFn) run(renderFn);
    else void loadRender().then(run);
    return () => {
      alive = false;
    };
  }, [value, format]);

  const showNumber = !rendered?.twoD || value.length <= MAX_SHOWN_LENGTH;

  return (
    <div class={`code-box code-box--${layout}${rendered?.twoD ? ' code-box--2d' : ''}`}>
      {rendered === undefined && <div class="code-box__art" />}
      {rendered && <div class="code-box__art" dangerouslySetInnerHTML={{ __html: withSvgAttrs(rendered) }} />}
      {rendered === null && <p class="code-box__error">{lv.codeUnavailable}</p>}
      {showNumber && <p class="code-box__number">{value}</p>}
    </div>
  );
}

/** Start loading the encoder early (e.g. when a card is tapped). */
export const preloadCodeRenderer = () => void (renderFn ?? loadRender());
