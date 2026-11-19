import Konva from 'konva';
import { Lock } from 'lucide-react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Transformer } from 'react-konva';
import { useI18n } from './i18n';
import type { EditorLayer } from './types';

type Props = {
  stageRef: RefObject<Konva.Stage | null>;
  selected: EditorLayer | undefined;
  zoom: number;
};
export const SELECTION_PADDING = 80;
const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const allAnchors = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'middle-left',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
function styleAnchor(anchor: Konva.Rect) {
  const rotation = anchor.hasName('rotater');
  const horizontalEdge = anchor.hasName('top-center') || anchor.hasName('bottom-center');
  const verticalEdge = anchor.hasName('middle-left') || anchor.hasName('middle-right');
  const width = rotation ? 8 : horizontalEdge ? 10 : verticalEdge ? 4 : 7;
  const height = rotation ? 8 : horizontalEdge ? 4 : verticalEdge ? 10 : 7;
  anchor.setAttrs({
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    cornerRadius: rotation ? 4 : 2,
    fill: '#ffffff',
    stroke: '#007aff',
    strokeWidth: 1.2,
    shadowColor: '#1c355d',
    shadowBlur: 2,
    shadowOpacity: 0.14,
    shadowOffset: { x: 0, y: 1 },
    hitStrokeWidth: window.matchMedia('(pointer: coarse)').matches ? 24 : 14,
  });
}

export function SelectionFrame({ stageRef, selected, zoom }: Props) {
  const ref = useRef<Konva.Transformer>(null);
  useLayoutEffect(() => {
    const transformer = ref.current;
    const node = selected?.visible ? stageRef.current?.findOne(`#node-${selected.id}`) : undefined;
    if (!transformer) return;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
    return () => {
      transformer.nodes([]);
    };
  }, [stageRef, selected, zoom]);
  const compact = selected && (selected.width * zoom < 56 || selected.height * zoom < 56);
  return (
    <Transformer
      ref={ref}
      name="selection-frame"
      // Transformer controls are already screen-space; dividing by zoom makes them enormous.
      anchorSize={7}
      anchorStyleFunc={styleAnchor}
      anchorFill="#ffffff"
      anchorStroke="#007aff"
      anchorStrokeWidth={1.2}
      anchorCornerRadius={2}
      borderStroke="#007aff"
      borderStrokeWidth={1.15}
      borderDash={selected?.locked ? [4, 3] : []}
      enabledAnchors={selected?.type === 'device' || compact ? corners : allAnchors}
      resizeEnabled={Boolean(selected?.visible && !selected.locked)}
      rotateEnabled={Boolean(selected?.visible && !selected.locked)}
      rotateAnchorOffset={24}
      rotateAnchorCursor="grab"
      rotationSnaps={[0, 90, 180, 270]}
      rotationSnapTolerance={4}
      keepRatio={selected?.type === 'device'}
      flipEnabled={false}
      ignoreStroke
      listening={Boolean(selected?.visible && !selected.locked)}
      boundBoxFunc={(oldBox, newBox) =>
        Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20 ? oldBox : newBox
      }
    />
  );
}

export function SelectionBadge({ stageRef, selected, zoom }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const { t } = useI18n();
  useLayoutEffect(() => {
    const badge = ref.current,
      value = valueRef.current;
    const node = selected?.visible ? stageRef.current?.findOne(`#node-${selected.id}`) : undefined;
    if (!badge || !value || !node || !selected) return;
    const update = () => {
      const bounds = node.getClientRect({ skipShadow: true, skipStroke: true });
      badge.style.left = `${bounds.x + bounds.width / 2 - SELECTION_PADDING}px`;
      badge.style.top = `${bounds.y + bounds.height - SELECTION_PADDING + 10}px`;
      badge.style.visibility = 'visible';
      value.textContent = `${Math.round(Math.abs(selected.width * node.scaleX()))} × ${Math.round(Math.abs(selected.height * node.scaleY()))}`;
    };
    // Updating just the badge DOM keeps dragging from rerendering the entire artwork.
    const events =
      'dragmove.selectionBadge transform.selectionBadge dragend.selectionBadge transformend.selectionBadge xChange.selectionBadge yChange.selectionBadge scaleXChange.selectionBadge scaleYChange.selectionBadge widthChange.selectionBadge heightChange.selectionBadge rotationChange.selectionBadge add.selectionBadge';
    node.on(events, update);
    update();
    const frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      node.off('.selectionBadge');
    };
  }, [stageRef, selected, zoom]);
  if (!selected?.visible) return null;
  return (
    <div
      ref={ref}
      className={`selection-badge ${selected.locked ? 'is-locked' : ''}`}
      aria-label={t(selected.locked ? 'Locked layer' : 'Selection dimensions')}
      style={{ visibility: 'hidden' }}
    >
      {selected.locked && <Lock size={10} aria-hidden="true" />}
      <span ref={valueRef} />
    </div>
  );
}
