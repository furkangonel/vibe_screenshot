import Konva from 'konva';
import { useEffect, useRef, type RefObject } from 'react';
import { Group } from 'react-konva';
import { layerBounds } from './editorActions';
import { effectiveLayer } from './layerUtils';
import { resizeOrigin, snapPosition, snapSize, type Guide } from './guideGeometry';
import type { LayoutDocument } from './types';

export default function SmartGuides({
  stageRef,
  document,
  locale,
  zoom,
  enabled,
  snapDistance = 5,
  crossCanvas = true,
}: {
  stageRef: RefObject<Konva.Stage | null>;
  document: LayoutDocument;
  locale: string;
  zoom: number;
  enabled: boolean;
  snapDistance?: number;
  crossCanvas?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  useEffect(() => {
    const stage = stageRef.current,
      group = groupRef.current;
    if (!stage || !group || !enabled) return;
    function clear() {
      group!.destroyChildren();
      group!.getLayer()?.batchDraw();
    }
    function draw(guides: Guide[]) {
      group!.destroyChildren();
      for (const guide of guides) {
        const color = guide.kind === 'size' ? '#9b57d3' : guide.kind === 'spacing' ? '#d4519b' : '#008bda';
        group!.add(
          new Konva.Line({
            points: guide.points,
            stroke: color,
            strokeWidth: 1 / zoom,
            dash: guide.kind === 'align' ? [4 / zoom, 3 / zoom] : undefined,
            listening: false,
          }),
        );
        if (guide.kind === 'spacing') {
          const [x1, y1, x2, y2] = guide.points;
          const horizontal = y1 === y2,
            cap = 4 / zoom;
          for (const [x, y] of [
            [x1, y1],
            [x2, y2],
          ])
            group!.add(
              new Konva.Line({
                points: horizontal ? [x, y - cap, x, y + cap] : [x - cap, y, x + cap, y],
                stroke: color,
                strokeWidth: 1 / zoom,
                listening: false,
              }),
            );
        }
        if (guide.label) {
          const x = guide.kind === 'spacing' ? (guide.points[0] + guide.points[2]) / 2 : guide.points[0];
          const y = guide.kind === 'spacing' ? (guide.points[1] + guide.points[3]) / 2 : guide.points[1];
          const label = new Konva.Label({ x, y: y - 22 / zoom, listening: false });
          label.add(
            new Konva.Tag({
              fill: '#ffffff',
              cornerRadius: 4 / zoom,
              stroke: color,
              strokeWidth: 0.5 / zoom,
            }),
          );
          label.add(
            new Konva.Text({
              text: guide.label,
              fontSize: 11 / zoom,
              fontFamily: '-apple-system, sans-serif',
              padding: 4 / zoom,
              fill: color,
            }),
          );
          group!.add(label);
        }
      }
      group!.getLayer()?.batchDraw();
    }
    const move = (event: Konva.KonvaEventObject<DragEvent | PointerEvent>) => {
      const node = event.target;
      const id = node.id().replace(/^node-/, '');
      const source = document.layers.find((l) => l.id === id);
      // Transformer mirrors drag/transform events after the actual object.
      // Ignore those helper events instead of erasing the object's guides.
      if (!source) return;
      if (source.locked || !source.visible || event.evt?.altKey) {
        clear();
        return;
      }
      const layer = effectiveLayer(source, locale);
      const peers = document.layers
        .filter((l) => l.id !== id && l.visible)
        .map((l) => effectiveLayer(l, locale));
      const references = peers.map((l) => ({ ...layerBounds(l), id: l.id }));
      const tolerance = snapDistance / zoom;
      if (event.type === 'dragmove') {
        const box = layerBounds({ ...layer, x: node.x(), y: node.y() });
        const page = Math.max(
          0,
          Math.min(document.pageCount - 1, Math.floor((box.x + box.width / 2) / document.width)),
        );
        const snap = snapPosition(
          box,
          references,
          document.width,
          document.height,
          page,
          tolerance,
          crossCanvas,
        );
        node.position({ x: node.x() + snap.dx, y: node.y() + snap.dy });
        draw(snap.guides);
      } else if (event.type === 'transform') {
        const transformer = stage.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = transformer?.getActiveAnchor() ?? '';
        if (!anchor || anchor === 'rotater') {
          clear();
          return;
        }
        const width = layer.width * node.scaleX(),
          height = layer.height * node.scaleY();
        const sizes = peers
          .filter((l) => Math.abs(l.rotation - layer.rotation) < 0.1)
          .map((l) => ({ x: l.x, y: l.y, width: l.width, height: l.height, id: l.id }));
        let result = snapSize(width, height, sizes, tolerance, layer.type === 'device');
        // Edge handles change one dimension. Keep the untouched dimension intact.
        if (anchor === 'top-center' || anchor === 'bottom-center')
          result = { ...result, width, matches: result.matches.filter((m) => m.axis === 'height') };
        if (anchor === 'middle-left' || anchor === 'middle-right')
          result = { ...result, height, matches: result.matches.filter((m) => m.axis === 'width') };
        node.position(
          resizeOrigin(
            { x: node.x(), y: node.y(), width, height },
            result.width,
            result.height,
            anchor,
            node.rotation(),
          ),
        );
        node.scale({ x: result.width / layer.width, y: result.height / layer.height });
        transformer?.forceUpdate();
        const guides: Guide[] = [];
        for (const match of result.matches) {
          const horizontal = match.axis === 'width';
          for (const box of [
            { x: node.x(), y: node.y(), width: result.width, height: result.height },
            match.reference,
          ]) {
            const offset = 10 / zoom;
            guides.push({
              kind: 'size',
              points: horizontal
                ? [box.x, box.y - offset, box.x + box.width, box.y - offset]
                : [box.x + box.width + offset, box.y, box.x + box.width + offset, box.y + box.height],
              label: `${horizontal ? 'W' : 'H'} = ${Math.round(match.value)}`,
            });
          }
        }
        draw(guides);
      }
    };
    stage.on('dragmove.smartGuides', move);
    stage.on('dragend.smartGuides', clear);
    // Konva transform events are fired directly on the transformed node and
    // do not bubble to the stage, unlike drag events.
    const objects = stage.find((node: Konva.Node) => node.id().startsWith('node-'));
    for (const object of objects) {
      object.on('transform.smartGuides', move);
      object.on('transformend.smartGuides', clear);
    }
    return () => {
      stage.off('.smartGuides');
      for (const object of objects) object.off('.smartGuides');
      clear();
    };
  }, [stageRef, document, locale, zoom, enabled, snapDistance, crossCanvas]);
  return <Group ref={groupRef} name="smart-guides" listening={false} />;
}
