import React, { useEffect, useRef } from "react";

export type GemstoneTheme = "emerald" | "diamond" | "ruby" | "sapphire";

interface Gemstone3DProps {
  size?: number;
  theme?: GemstoneTheme;
  interactive?: boolean;
  autoRotateSpeed?: number;
  showSparkles?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Face3D {
  indices: number[];
  baseColor: string;
}

export function Gemstone3D({
  size = 140,
  theme = "emerald",
  interactive = true,
  autoRotateSpeed = 0.012,
  showSparkles = true,
  className = "",
  style = {},
}: Gemstone3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction tracking refs
  const rotX = useRef<number>(0.35);
  const rotY = useRef<number>(0.4);
  const velX = useRef<number>(0);
  const velY = useRef<number>(autoRotateSpeed);
  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameId = useRef<number>(0);

  // Sparkles
  const sparkles = useRef<Array<{ x: number; y: number; life: number; maxLife: number; size: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas pixel density for retina crispness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    // Theme color palettes: [ambient, mid, highlight, edge, glow]
    const themes: Record<GemstoneTheme, { r: number; g: number; b: number; glow: string }> = {
      emerald: { r: 16, g: 185, b: 129, glow: "rgba(16, 185, 129, 0.45)" },
      diamond: { r: 56, g: 189, b: 248, glow: "rgba(56, 189, 248, 0.45)" },
      ruby: { r: 244, g: 63, b: 94, glow: "rgba(244, 63, 94, 0.45)" },
      sapphire: { r: 99, g: 102, b: 241, glow: "rgba(99, 102, 241, 0.45)" },
    };

    const curTheme = themes[theme] || themes.emerald;

    // 3D Gemstone Geometry: Brilliant Cut / Octagonal Gem Model
    // 1 Table vertex (top center) or 8 table vertices, 8 girdle vertices, 1 culet (bottom)
    const tableRadius = 0.52;
    const girdleRadius = 0.92;
    const tableY = 0.52;
    const girdleY = 0.12;
    const culetY = -0.92;

    const vertices: Point3D[] = [];

    // Table vertices (0..7)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      vertices.push({
        x: Math.cos(angle) * tableRadius,
        y: tableY,
        z: Math.sin(angle) * tableRadius,
      });
    }

    // Girdle vertices (8..15)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      vertices.push({
        x: Math.cos(angle) * girdleRadius,
        y: girdleY,
        z: Math.sin(angle) * girdleRadius,
      });
    }

    // Culet vertex (16)
    vertices.push({ x: 0, y: culetY, z: 0 });

    // Table center (17) for table octagonal fan
    vertices.push({ x: 0, y: tableY, z: 0 });

    // Define facets
    const faces: Face3D[] = [];

    // Table face (Octagon formed of 8 triangles)
    for (let i = 0; i < 8; i++) {
      faces.push({
        indices: [17, (i + 1) % 8, i],
        baseColor: "table",
      });
    }

    // Crown facets (Triangles connecting Table and Girdle)
    for (let i = 0; i < 8; i++) {
      const t1 = i;
      const t2 = (i + 1) % 8;
      const g1 = 8 + i;
      const g2 = 8 + ((i + 1) % 8);

      faces.push({
        indices: [t1, g1, t2],
        baseColor: "crown",
      });
      faces.push({
        indices: [t2, g1, g2],
        baseColor: "crown",
      });
    }

    // Pavilion facets (Triangles from Girdle to Culet 16)
    for (let i = 0; i < 8; i++) {
      const g1 = 8 + i;
      const g2 = 8 + ((i + 1) % 8);
      faces.push({
        indices: [g1, 16, g2],
        baseColor: "pavilion",
      });
    }

    // Light source vector in world space (coming from top-front-right)
    const light = { x: 0.55, y: 0.8, z: 0.65 };
    const lightLen = Math.sqrt(light.x * light.x + light.y * light.y + light.z * light.z);
    light.x /= lightLen;
    light.y /= lightLen;
    light.z /= lightLen;

    const render = () => {
      // Rotation physics & damping
      if (!isDragging.current) {
        velX.current *= 0.95;
        velY.current = velY.current * 0.95 + autoRotateSpeed * 0.05;
        rotX.current += velX.current;
        rotY.current += velY.current;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = (canvas.width / 2.3);

      const cosX = Math.cos(rotX.current);
      const sinX = Math.sin(rotX.current);
      const cosY = Math.cos(rotY.current);
      const sinY = Math.sin(rotY.current);

      // Rotate vertices: Y then X
      const transformed: Array<Point3D & { sx: number; sy: number }> = vertices.map((v) => {
        // Rotate around Y
        const x1 = v.x * cosY + v.z * sinY;
        const y1 = v.y;
        const z1 = -v.x * sinY + v.z * cosY;

        // Rotate around X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Perspective / Orthographic projection
        const pFactor = 1 / (1 - z2 * 0.18);
        return {
          x: x2,
          y: y2,
          z: z2,
          sx: cx + x2 * scale * pFactor,
          sy: cy - y2 * scale * pFactor,
        };
      });

      // Prepare facets for sorting & rendering
      const renderedFaces: Array<{
        indices: number[];
        zAvg: number;
        normalZ: number;
        intensity: number;
        specular: number;
        baseColor: string;
      }> = [];

      for (const face of faces) {
        const p0 = transformed[face.indices[0]];
        const p1 = transformed[face.indices[1]];
        const p2 = transformed[face.indices[2]];

        // Cross product for Normal vector
        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v1z = p1.z - p0.z;

        const v2x = p2.x - p0.x;
        const v2y = p2.y - p0.y;
        const v2z = p2.z - p0.z;

        let nx = v1y * v2z - v1z * v2y;
        let ny = v1z * v2x - v1x * v2z;
        let nz = v1x * v2y - v1y * v2x;

        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;

        // Dot product with light
        const dot = nx * light.x + ny * light.y + nz * light.z;
        const intensity = Math.max(0.08, dot);

        // Specular highlight: reflection vector vs camera (0, 0, 1)
        const rx = 2 * dot * nx - light.x;
        const ry = 2 * dot * ny - light.y;
        const rz = 2 * dot * nz - light.z;
        const spec = Math.pow(Math.max(0, rz), 18);

        const zAvg = (p0.z + p1.z + p2.z) / 3;

        renderedFaces.push({
          indices: face.indices,
          zAvg,
          normalZ: nz,
          intensity,
          specular: spec,
          baseColor: face.baseColor,
        });
      }

      // Sort faces back-to-front (painter's algorithm)
      renderedFaces.sort((a, b) => a.zAvg - b.zAvg);

      // Render back-faces first (semi-transparent inner crystal refraction)
      for (const f of renderedFaces) {
        if (f.normalZ <= 0) {
          const pts = f.indices.map((idx) => transformed[idx]);
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].sx, pts[i].sy);
          }
          ctx.closePath();

          // Darker inner crystal tone
          const alpha = 0.22;
          ctx.fillStyle = `rgba(${Math.floor(curTheme.r * 0.35)}, ${Math.floor(curTheme.g * 0.45)}, ${Math.floor(curTheme.b * 0.45)}, ${alpha})`;
          ctx.fill();

          ctx.strokeStyle = `rgba(${curTheme.r}, ${curTheme.g}, ${curTheme.b}, 0.15)`;
          ctx.lineWidth = 0.8 * dpr;
          ctx.stroke();
        }
      }

      // Render front-faces with gemstone refraction and specular glow
      for (const f of renderedFaces) {
        if (f.normalZ > 0) {
          const pts = f.indices.map((idx) => transformed[idx]);
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].sx, pts[i].sy);
          }
          ctx.closePath();

          // Dynamic facet coloration with Phong specular component
          const r = Math.min(255, Math.floor(curTheme.r * f.intensity + f.specular * 230));
          const g = Math.min(255, Math.floor(curTheme.g * f.intensity + f.specular * 240));
          const b = Math.min(255, Math.floor(curTheme.b * f.intensity + f.specular * 255));
          const alpha = Math.min(0.96, 0.55 + f.intensity * 0.4);

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();

          // Crisp facet edge lines
          const edgeAlpha = Math.min(0.9, 0.4 + f.specular * 0.6);
          ctx.strokeStyle = `rgba(255, 255, 255, ${edgeAlpha})`;
          ctx.lineWidth = (f.specular > 0.4 ? 1.5 : 0.9) * dpr;
          ctx.stroke();

          // Generate sparkle if high specular
          if (showSparkles && f.specular > 0.82 && Math.random() < 0.25) {
            sparkles.current.push({
              x: (pts[0].sx + pts[1].sx + pts[2].sx) / 3,
              y: (pts[0].sy + pts[1].sy + pts[2].sy) / 3,
              life: 1.0,
              maxLife: 20 + Math.random() * 15,
              size: (3 + Math.random() * 4) * dpr,
            });
          }
        }
      }

      // Render Sparkles
      if (showSparkles && sparkles.current.length > 0) {
        for (let i = sparkles.current.length - 1; i >= 0; i--) {
          const sp = sparkles.current[i];
          sp.life -= 1 / sp.maxLife;
          if (sp.life <= 0) {
            sparkles.current.splice(i, 1);
            continue;
          }

          const spAlpha = Math.sin(sp.life * Math.PI);
          ctx.save();
          ctx.translate(sp.x, sp.y);
          ctx.fillStyle = `rgba(255, 255, 255, ${spAlpha})`;
          ctx.shadowColor = curTheme.glow;
          ctx.shadowBlur = 10 * dpr;

          // 4-point star sparkle
          const s = sp.size * spAlpha;
          ctx.beginPath();
          ctx.moveTo(0, -s * 2);
          ctx.quadraticCurveTo(0, 0, s * 2, 0);
          ctx.quadraticCurveTo(0, 0, 0, s * 2);
          ctx.quadraticCurveTo(0, 0, -s * 2, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId.current);
    };
  }, [size, theme, interactive, autoRotateSpeed, showSparkles]);

  // Mouse / Touch handlers for interactive 3D rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !interactive) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    velY.current = dx * 0.008;
    velX.current = -dy * 0.008;

    rotY.current += velY.current;
    rotX.current += velX.current;

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      className={`gemstone-3d-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
        cursor: interactive ? "grab" : "default",
        filter: "drop-shadow(0 12px 28px rgba(16, 185, 129, 0.35))",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: "block",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
