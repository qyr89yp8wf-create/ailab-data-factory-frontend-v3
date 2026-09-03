const MIN_SIZE = 4;

export function clampBox(box, width, height) {
  let [x1, y1, x2, y2] = box.map(Number);
  x1 = Math.max(0, Math.min(x1, width - MIN_SIZE));
  y1 = Math.max(0, Math.min(y1, height - MIN_SIZE));
  x2 = Math.max(x1 + MIN_SIZE, Math.min(x2, width));
  y2 = Math.max(y1 + MIN_SIZE, Math.min(y2, height));
  return [x1, y1, x2, y2].map(value => Math.round(value * 100) / 100);
}

function nearest(value, candidates, threshold) {
  let result = value;
  let distance = threshold + 1;
  candidates.forEach(candidate => {
    const current = Math.abs(candidate - value);
    if (current < distance && current <= threshold) {
      result = candidate;
      distance = current;
    }
  });
  return result;
}

export function snapBox(box, objects, objectId, canvas, threshold = 8) {
  const xCandidates = [0, canvas.width];
  const yCandidates = [0, canvas.height];
  objects.filter(item => item.id !== objectId).forEach(item => {
    xCandidates.push(item.bbox_px[0], item.bbox_px[2]);
    yCandidates.push(item.bbox_px[1], item.bbox_px[3]);
  });
  const [x1, y1, x2, y2] = box;
  const snappedLeft = nearest(x1, xCandidates, threshold);
  const snappedRight = nearest(x2, xCandidates, threshold);
  const snappedTop = nearest(y1, yCandidates, threshold);
  const snappedBottom = nearest(y2, yCandidates, threshold);
  return clampBox([snappedLeft, snappedTop, snappedRight, snappedBottom], canvas.width, canvas.height);
}

export function moveBox(box, dx, dy, objects, objectId, canvas, threshold = 8) {
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  const left = Math.max(0, Math.min(box[0] + dx, canvas.width - width));
  const top = Math.max(0, Math.min(box[1] + dy, canvas.height - height));
  const moved = [left, top, left + width, top + height];
  const xCandidates = [0, canvas.width];
  const yCandidates = [0, canvas.height];
  objects.filter(item => item.id !== objectId).forEach(item => {
    xCandidates.push(item.bbox_px[0], item.bbox_px[2]);
    yCandidates.push(item.bbox_px[1], item.bbox_px[3]);
  });
  const leftSnap = nearest(moved[0], xCandidates, threshold);
  const rightSnap = nearest(moved[2], xCandidates, threshold);
  const topSnap = nearest(moved[1], yCandidates, threshold);
  const bottomSnap = nearest(moved[3], yCandidates, threshold);
  const snappedX = Math.abs(leftSnap - moved[0]) <= Math.abs(rightSnap - moved[2]) ? leftSnap : rightSnap - width;
  const snappedY = Math.abs(topSnap - moved[1]) <= Math.abs(bottomSnap - moved[3]) ? topSnap : bottomSnap - height;
  return clampBox([snappedX, snappedY, snappedX + width, snappedY + height], canvas.width, canvas.height);
}

export function nextId(items, prefix) {
  const numbers = items.map(item => Number(String(item.id).replace(/\D/g, '')) || 0);
  return `${prefix}_${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
}
