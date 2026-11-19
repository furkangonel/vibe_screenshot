export type Box = { x: number; y: number; width: number; height: number };
export type Guide = { points: number[]; kind: 'align' | 'size' | 'spacing'; label?: string };
type Reference = Box & { id: string };

export function snapPosition(
  box: Box,
  references: Reference[],
  pageWidth: number,
  pageHeight: number,
  page: number,
  tolerance: number,
  crossCanvas = true,
) {
  const left = page * pageWidth;
  const xTargets = [left, left + pageWidth / 2, left + pageWidth];
  const yTargets = [0, pageHeight / 2, pageHeight];
  for (const target of references) {
    // Compare the same local position across neighboring screenshots as well.
    const pageX = Math.floor((target.x + target.width / 2) / pageWidth) * pageWidth;
    if (!crossCanvas && pageX !== left) continue;
    xTargets.push(
      target.x - pageX + left,
      target.x - pageX + left + target.width / 2,
      target.x - pageX + left + target.width,
    );
    yTargets.push(target.y, target.y + target.height / 2, target.y + target.height);
  }
  function closest(values: number[], targets: number[]) {
    let result: { delta: number; target: number } | null = null;
    for (const target of targets)
      for (const value of values) {
        const delta = target - value;
        if (Math.abs(delta) <= tolerance && (!result || Math.abs(delta) < Math.abs(result.delta)))
          result = { delta, target };
      }
    return result;
  }
  const x = closest([box.x, box.x + box.width / 2, box.x + box.width], xTargets);
  const y = closest([box.y, box.y + box.height / 2, box.y + box.height], yTargets);
  let dx = x?.delta ?? 0,
    dy = y?.delta ?? 0;
  const spacing = snapSpacing(
    box,
    references.filter((r) => Math.floor((r.x + r.width / 2) / pageWidth) === page),
    tolerance,
  );
  const useX = spacing.x && (!x || Math.abs(spacing.x.delta) < Math.abs(x.delta));
  const useY = spacing.y && (!y || Math.abs(spacing.y.delta) < Math.abs(y.delta));
  const guides: Guide[] = [];
  if (useX) {
    dx = spacing.x!.delta;
    guides.push(...spacing.x!.guides);
  }
  if (useY) {
    dy = spacing.y!.delta;
    guides.push(...spacing.y!.guides);
  }
  if (x && !useX) guides.push({ kind: 'align', points: [x.target, 0, x.target, pageHeight] });
  if (y && !useY) guides.push({ kind: 'align', points: [left, y.target, left + pageWidth, y.target] });
  return { dx, dy, guides };
}

export function snapSpacing(box: Box, references: Reference[], tolerance: number) {
  type Match = { delta: number; gap: number; guides: Guide[] };
  let x: Match | null = null,
    y: Match | null = null;
  const horizontal = references.filter((r) => r.y < box.y + box.height && r.y + r.height > box.y);
  const vertical = references.filter((r) => r.x < box.x + box.width && r.x + r.width > box.x);
  const left = horizontal
    .filter((r) => r.x + r.width <= box.x + tolerance)
    .sort((a, b) => b.x + b.width - a.x - a.width)[0];
  const right = horizontal.filter((r) => r.x >= box.x + box.width - tolerance).sort((a, b) => a.x - b.x)[0];
  if (left && right && left.id !== right.id) {
    const gap = (right.x - left.x - left.width - box.width) / 2;
    const target = left.x + left.width + gap,
      delta = target - box.x;
    if (gap >= 0 && Math.abs(delta) <= tolerance) {
      const mid = box.y + box.height / 2;
      x = {
        delta,
        gap,
        guides: [
          {
            kind: 'spacing',
            points: [left.x + left.width, mid, target, mid],
            label: String(Math.round(gap)),
          },
          {
            kind: 'spacing',
            points: [target + box.width, mid, right.x, mid],
            label: String(Math.round(gap)),
          },
        ],
      };
    }
  }
  const top = vertical
    .filter((r) => r.y + r.height <= box.y + tolerance)
    .sort((a, b) => b.y + b.height - a.y - a.height)[0];
  const bottom = vertical.filter((r) => r.y >= box.y + box.height - tolerance).sort((a, b) => a.y - b.y)[0];
  if (top && bottom && top.id !== bottom.id) {
    const gap = (bottom.y - top.y - top.height - box.height) / 2;
    const target = top.y + top.height + gap,
      delta = target - box.y;
    if (gap >= 0 && Math.abs(delta) <= tolerance) {
      const mid = box.x + box.width / 2;
      y = {
        delta,
        gap,
        guides: [
          { kind: 'spacing', points: [mid, top.y + top.height, mid, target], label: String(Math.round(gap)) },
          {
            kind: 'spacing',
            points: [mid, target + box.height, mid, bottom.y],
            label: String(Math.round(gap)),
          },
        ],
      };
    }
  }
  return { x, y };
}

export function snapSize(
  width: number,
  height: number,
  references: Reference[],
  tolerance: number,
  keepRatio: boolean,
) {
  const matches = references
    .flatMap((reference) => [
      { axis: 'width' as const, delta: Math.abs(reference.width - width), value: reference.width, reference },
      {
        axis: 'height' as const,
        delta: Math.abs(reference.height - height),
        value: reference.height,
        reference,
      },
    ])
    .filter((match) => match.delta <= tolerance)
    .sort((a, b) => a.delta - b.delta);
  let nextWidth = width,
    nextHeight = height;
  const chosen = keepRatio
    ? matches.slice(0, 1)
    : [matches.find((m) => m.axis === 'width'), matches.find((m) => m.axis === 'height')].filter(
        (m) => m !== undefined,
      );
  for (const match of chosen) {
    if (match.axis === 'width') {
      nextWidth = match.value;
      if (keepRatio) nextHeight = (height * nextWidth) / width;
    } else {
      nextHeight = match.value;
      if (keepRatio) nextWidth = (width * nextHeight) / height;
    }
  }
  return { width: nextWidth, height: nextHeight, matches: chosen };
}

export function resizeOrigin(box: Box, width: number, height: number, anchor: string, rotation: number) {
  const fixedX = anchor.includes('left') ? 1 : anchor.includes('right') ? 0 : 0.5;
  const fixedY = anchor.includes('top') ? 1 : anchor.includes('bottom') ? 0 : 0.5;
  const dx = (box.width - width) * fixedX,
    dy = (box.height - height) * fixedY;
  const a = (rotation * Math.PI) / 180;
  return { x: box.x + dx * Math.cos(a) - dy * Math.sin(a), y: box.y + dx * Math.sin(a) + dy * Math.cos(a) };
}
