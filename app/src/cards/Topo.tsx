import { memo } from 'preact/compat';
import { TOPO_H, TOPO_W, topoLines } from './topoLines';

/**
 * Contour-line overlay. Fills its parent (cover-scaled) and keeps a constant
 * 0.85 / 1.2 px stroke at any card size.
 */
export const Topo = memo(function Topo({ layoutIndex }: { layoutIndex: number }) {
  const lines = topoLines(layoutIndex);
  return (
    <svg
      class="topo"
      viewBox={`0 0 ${TOPO_W} ${TOPO_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {lines.map((l, i) => (
        <path key={i} d={l.d} class={l.index ? 'topo__line topo__line--index' : 'topo__line'} />
      ))}
    </svg>
  );
});
