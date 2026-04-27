import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const WIDTH = 128;
const HEIGHT = 128;

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const pngFromRgba = (rgba, width, height) => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const createCanvas = () => Buffer.alloc(WIDTH * HEIGHT * 4);

const blendPixel = (canvas, x, y, color) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 4;
  const srcA = color[3] / 255;
  const dstA = canvas[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;

  canvas[index] = Math.round(
    (color[0] * srcA + canvas[index] * dstA * (1 - srcA)) / outA,
  );
  canvas[index + 1] = Math.round(
    (color[1] * srcA + canvas[index + 1] * dstA * (1 - srcA)) / outA,
  );
  canvas[index + 2] = Math.round(
    (color[2] * srcA + canvas[index + 2] * dstA * (1 - srcA)) / outA,
  );
  canvas[index + 3] = Math.round(outA * 255);
};

const fillCircle = (canvas, cx, cy, radius, color) => {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSquared) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
};

const polygonContains = (points, x, y) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-5) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const fillPolygon = (canvas, points, color) => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (polygonContains(points, x + 0.5, y + 0.5)) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
};

const regularPolygon = (cx, cy, radius, sides, rotation = 0) =>
  Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });

const starPoints = (cx, cy, outerRadius, innerRadius, points) => {
  const result = [];
  for (let index = 0; index < points * 2; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / points;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    result.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return result;
};

const drawGlow = (canvas, cx, cy, radius, [r, g, b], alpha) => {
  for (let step = radius; step > 0; step -= 6) {
    const fade = (alpha * step) / radius;
    fillCircle(canvas, cx, cy, step, [r, g, b, Math.round(fade)]);
  }
};

const buildBadgeCore = () => {
  const canvas = createCanvas();
  drawGlow(canvas, 64, 56, 46, [168, 162, 158], 42);
  fillPolygon(canvas, regularPolygon(64, 58, 42, 6, -Math.PI / 2), [230, 232, 236, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 35, 6, -Math.PI / 2), [65, 50, 42, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 20, 4, 0), [255, 224, 204, 255]);
  fillPolygon(canvas, [
    [64, 40],
    [80, 56],
    [64, 72],
    [48, 56],
  ], [252, 246, 241, 210]);
  return canvas;
};

const buildBadgeCreator = () => {
  const canvas = createCanvas();
  drawGlow(canvas, 64, 56, 48, [76, 110, 255], 54);
  fillPolygon(canvas, [[14, 62], [38, 44], [40, 74], [18, 86]], [221, 233, 255, 255]);
  fillPolygon(canvas, [[114, 62], [90, 44], [88, 74], [110, 86]], [221, 233, 255, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 40, 6, -Math.PI / 2), [235, 240, 255, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 34, 6, -Math.PI / 2), [44, 67, 155, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 17, 5, -Math.PI / 2), [215, 232, 255, 255]);
  fillPolygon(canvas, regularPolygon(64, 58, 10, 5, -Math.PI / 2), [122, 170, 255, 255]);
  return canvas;
};

const buildBadgeSales = () => {
  const canvas = createCanvas();
  drawGlow(canvas, 64, 58, 50, [255, 138, 28], 62);
  fillPolygon(canvas, regularPolygon(64, 56, 42, 6, -Math.PI / 2), [255, 243, 214, 255]);
  fillPolygon(canvas, regularPolygon(64, 56, 35, 6, -Math.PI / 2), [115, 39, 23, 255]);
  fillPolygon(canvas, starPoints(64, 56, 22, 10, 5), [255, 208, 72, 255]);
  fillPolygon(canvas, starPoints(64, 56, 12, 5, 5), [255, 247, 211, 255]);
  fillPolygon(canvas, [[24, 84], [42, 70], [48, 78], [34, 100]], [255, 190, 85, 240]);
  fillPolygon(canvas, [[104, 84], [86, 70], [80, 78], [94, 100]], [255, 190, 85, 240]);
  return canvas;
};

const buildBadgeReferrals = () => {
  const canvas = createCanvas();
  drawGlow(canvas, 64, 58, 52, [164, 89, 255], 60);
  fillPolygon(canvas, [[10, 70], [34, 44], [46, 62], [26, 92]], [224, 196, 255, 245]);
  fillPolygon(canvas, [[118, 70], [94, 44], [82, 62], [102, 92]], [224, 196, 255, 245]);
  fillPolygon(canvas, regularPolygon(64, 56, 42, 6, -Math.PI / 2), [250, 238, 255, 255]);
  fillPolygon(canvas, regularPolygon(64, 56, 35, 6, -Math.PI / 2), [78, 31, 123, 255]);
  fillPolygon(canvas, regularPolygon(64, 56, 19, 4, 0), [255, 215, 250, 255]);
  fillCircle(canvas, 64, 56, 8, [255, 208, 90, 255]);
  return canvas;
};

const outputDir = path.join(process.cwd(), "public/profile-badges");
fs.mkdirSync(outputDir, { recursive: true });

const files = [
  ["badge-core.png", buildBadgeCore()],
  ["badge-creator.png", buildBadgeCreator()],
  ["badge-sales.png", buildBadgeSales()],
  ["badge-referrals.png", buildBadgeReferrals()],
];

for (const [filename, canvas] of files) {
  fs.writeFileSync(path.join(outputDir, filename), pngFromRgba(canvas, WIDTH, HEIGHT));
}
