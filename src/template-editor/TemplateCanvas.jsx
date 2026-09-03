import React, { useEffect, useMemo, useState } from 'react';
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text as KonvaText } from 'react-konva';
import { moveBox, snapBox } from './templateGeometry';

function useBrowserImage(url) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!url) { setImage(null); return undefined; }
    const value = new window.Image();
    value.crossOrigin = 'anonymous';
    value.onload = () => setImage(value);
    value.src = url;
    return () => { value.onload = null; };
  }, [url]);
  return image;
}

const layerColors = {
  cell: '#1677ff',
  text: '#52c41a',
  asset: '#d4380d',
};

const asManual = item => ({ ...item, locked: true, source: { kind: 'manual', reason: 'user_edit' } });

function BorderLines({ cell, scale }) {
  const [x1, y1, x2, y2] = cell.bbox_px.map(value => value * scale);
  const borders = cell.borders || {};
  const common = { stroke: '#1677ff', strokeWidth: 1.5 };
  return <>
    {borders.top !== false && <Line points={[x1, y1, x2, y1]} {...common}/>} 
    {borders.right !== false && <Line points={[x2, y1, x2, y2]} {...common}/>} 
    {borders.bottom !== false && <Line points={[x1, y2, x2, y2]} {...common}/>} 
    {borders.left !== false && <Line points={[x1, y1, x1, y2]} {...common}/>} 
  </>;
}

function CornerHandles({ box, scale, onCorner }) {
  const [x1, y1, x2, y2] = box.map(value => value * scale);
  const points = [
    ['top-left', x1, y1], ['top-right', x2, y1],
    ['bottom-right', x2, y2], ['bottom-left', x1, y2],
  ];
  return points.map(([corner, x, y]) => <Circle
    key={corner} x={x} y={y} radius={6} fill="#fff" stroke="#1677ff" strokeWidth={2}
    draggable onDragEnd={event => onCorner(corner, { x: event.target.x() / scale, y: event.target.y() / scale })}
  />);
}

export default function TemplateCanvas({ draft, sourceUrl, visibility, privacyVisible = true, selection, onSelection, onDraftChange, zoom = 1, interactionLocks = {} }) {
  const sourceImage = useBrowserImage(sourceUrl);
  const canvas = draft.canvas;
  const baseScale = Math.min(820 / canvas.width, 610 / canvas.height);
  const scale = baseScale * zoom;
  const width = Math.round(canvas.width * scale);
  const height = Math.round(canvas.height * scale);
  const selectedCell = selection?.kind === 'cell' ? draft.cells.find(item => item.id === selection.id) : null;
  const tableLocked = Boolean(interactionLocks.table);

  const allObjects = useMemo(() => [...draft.cells, ...draft.texts, ...draft.assets], [draft.cells, draft.texts, draft.assets]);

  const move = (kind, item, event) => {
    const dx = event.target.x() / scale - item.bbox_px[0];
    const dy = event.target.y() / scale - item.bbox_px[1];
    const collectionName = kind === 'cell' ? 'cells' : kind === 'text' ? 'texts' : 'assets';
    const nextBox = moveBox(item.bbox_px, dx, dy, allObjects, item.id, canvas, 8 / baseScale);
    onDraftChange({ ...draft, [collectionName]: draft[collectionName].map(value => value.id === item.id ? asManual({ ...value, bbox_px: nextBox }) : value) });
  };

  const resizeGeneric = (kind, item, corner, point) => {
    const [x1, y1, x2, y2] = item.bbox_px;
    let box = [x1, y1, x2, y2];
    if (corner.includes('left')) box[0] = point.x;
    if (corner.includes('right')) box[2] = point.x;
    if (corner.includes('top')) box[1] = point.y;
    if (corner.includes('bottom')) box[3] = point.y;
    box = snapBox(box, allObjects, item.id, canvas, 8 / baseScale);
    const collectionName = kind === 'text' ? 'texts' : 'assets';
    onDraftChange({ ...draft, [collectionName]: draft[collectionName].map(value => value.id === item.id ? asManual({ ...value, bbox_px: box }) : value) });
  };

  const resizeSelectedCell = (item, corner, point) => {
    const [x1, y1, x2, y2] = item.bbox_px;
    let box = [x1, y1, x2, y2];
    if (corner.includes('left')) box[0] = point.x;
    if (corner.includes('right')) box[2] = point.x;
    if (corner.includes('top')) box[1] = point.y;
    if (corner.includes('bottom')) box[3] = point.y;
    box = snapBox(box, draft.cells, item.id, canvas, 8 / baseScale);
    onDraftChange({
      ...draft,
      cells: draft.cells.map(cell => cell.id === item.id
        ? asManual({ ...cell, bbox_px: box })
        : cell),
    });
  };

  const selectedObject = selection?.kind === 'text'
    ? draft.texts.find(item => item.id === selection.id)
    : selection?.kind === 'asset' ? draft.assets.find(item => item.id === selection.id) : null;

  return <div className="template-canvas-shell">
    <Stage width={width} height={height} className="template-stage" onMouseDown={event => {
      if (event.target === event.target.getStage()) onSelection(null);
    }}>
      <Layer visible={visibility.background}>
        <Rect x={0} y={0} width={width} height={height} fill="#fff"/>
        {sourceImage && <KonvaImage image={sourceImage} x={0} y={0} width={width} height={height}/>} 
      </Layer>
      <Layer visible={privacyVisible} listening={false}>
        {draft.texts.filter(item=>{const field=draft.fields.find(value=>value.id===item.field_id);return item.kind==='dynamic_field'&&['person_name','address','code','company_name'].includes(field?.data_type);}).map(item=>{const [x1,y1,x2,y2]=item.bbox_px.map(value=>value*scale);return <Rect key={item.id} x={x1} y={y1} width={x2-x1} height={y2-y1} fill="#8c8c8c" opacity={0.72} cornerRadius={3}/>})}
        {Array.from({length:6},(_,row)=>Array.from({length:4},(_,column)=><KonvaText key={`${row}-${column}`} x={column*width/4-20} y={row*height/6+30} text="仅供合成训练数据使用" fontSize={Math.max(12,18*zoom)} fill="rgba(22,119,255,.22)" rotation={-24}/>))}
      </Layer>
      <Layer visible={visibility.table}>
        {draft.cells.map(cell => {
          const [x1, y1, x2, y2] = cell.bbox_px.map(value => value * scale);
          const selected = selection?.kind === 'cell' && selection.id === cell.id;
          return <React.Fragment key={cell.id}>
            <Rect x={x1} y={y1} width={x2 - x1} height={y2 - y1}
              fill={selected ? 'rgba(22,119,255,.16)' : 'rgba(22,119,255,.04)'}
              stroke={selected ? '#0958d9' : 'transparent'} strokeWidth={selected ? 2 : 0}
              draggable={!tableLocked}
              listening={!tableLocked}
              onClick={() => !tableLocked && onSelection({ kind: 'cell', id: cell.id })}
              onTap={() => !tableLocked && onSelection({ kind: 'cell', id: cell.id })}
              onDragEnd={event => !tableLocked && move('cell', cell, event)}/>
            <BorderLines cell={cell} scale={scale}/>
          </React.Fragment>;
        })}
        {selectedCell && !tableLocked && <CornerHandles box={selectedCell.bbox_px} scale={scale} onCorner={(corner, point) => {
          resizeSelectedCell(selectedCell, corner, point);
        }}/>} 
      </Layer>
      <Layer visible={visibility.text}>
        {draft.texts.map(item => {
          const [x1, y1, x2, y2] = item.bbox_px.map(value => value * scale);
          const selected = selection?.kind === 'text' && selection.id === item.id;
          const boxWidth = Math.max(2, x2 - x1);
          const boxHeight = Math.max(2, y2 - y1);
          const labelFontSize = Math.max(5, Math.min(10, boxHeight * .72));
          return <React.Fragment key={item.id}>
            <Rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="rgba(82,196,26,.08)" stroke={layerColors.text} strokeWidth={selected ? 3 : 1} dash={[6, 4]}
              draggable onClick={() => onSelection({ kind: 'text', id: item.id })} onDragEnd={event => move('text', item, event)}/>
            <KonvaText x={x1 + 1} y={y1 + 1} width={Math.max(2, boxWidth - 2)} height={Math.max(2, boxHeight - 2)}
              text={item.sample_text || item.field_id || '文字'} fill="#237804" fontSize={labelFontSize}
              wrap="none" ellipsis listening={false}/>
          </React.Fragment>;
        })}
        {selection?.kind === 'text' && selectedObject && <CornerHandles box={selectedObject.bbox_px} scale={scale} onCorner={(corner, point) => resizeGeneric('text', selectedObject, corner, point)}/>} 
      </Layer>
      <Layer visible={visibility.asset}>
        {draft.assets.map(item => {
          const [x1, y1, x2, y2] = item.bbox_px.map(value => value * scale);
          const selected = selection?.kind === 'asset' && selection.id === item.id;
          return <React.Fragment key={item.id}>
            <Rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="rgba(212,56,13,.08)" stroke={layerColors.asset} strokeWidth={selected ? 3 : 1} dash={[8, 4]}
              draggable onClick={() => onSelection({ kind: 'asset', id: item.id })} onDragEnd={event => move('asset', item, event)}/>
            <KonvaText x={x1 + 4} y={y1 + 4} text={item.asset_type || '图案'} fill="#a8071a" fontSize={Math.max(10, 13 * zoom)} listening={false}/>
          </React.Fragment>;
        })}
        {selection?.kind === 'asset' && selectedObject && <CornerHandles box={selectedObject.bbox_px} scale={scale} onCorner={(corner, point) => resizeGeneric('asset', selectedObject, corner, point)}/>} 
      </Layer>
    </Stage>
  </div>;
}
