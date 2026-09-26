import React, { useRef, useEffect } from 'react';

interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[]; // [x1, y1, x2, y2]
  keypoints?: { name: string; x: number; y: number; conf: number }[];
}

interface DetectionOverlayProps {
  detections: Detection[];
  width?: number;
  height?: number;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  width = 640,
  height = 480,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    detections.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      const isDefect =
        d.class_name.includes('defect') ||
        d.class_name.includes('misalignment') ||
        d.class_name.includes('no_') ||
        d.class_name.includes('intrusion');

      const strokeColor = isDefect ? '#ff4d4f' : '#52c41a';
      const fillColor = isDefect ? 'rgba(255, 77, 79, 0.15)' : 'rgba(82, 196, 26, 0.12)';

      // Draw Corner Accent Box (Industrial Supervision Style)
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);
      ctx.fillStyle = fillColor;
      ctx.fillRect(x1, y1, w, h);

      // Draw Corner Brackets
      const cornerLen = Math.min(12, w / 4, h / 4);
      ctx.lineWidth = 3.5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerLen, y1);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerLen);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerLen, y2);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerLen);
      ctx.stroke();

      // Label Tag Banner
      const label = `${d.class_name} ${(d.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = strokeColor;
      ctx.fillRect(x1, Math.max(0, y1 - 18), textWidth + 8, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 4, Math.max(13, y1 - 5));

      // Draw Keypoints if available (Pose mode)
      if (d.keypoints && d.keypoints.length > 0) {
        d.keypoints.forEach((kp) => {
          if (kp.conf > 0.5) {
            ctx.fillStyle = '#faad14';
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      }
    });
  }, [detections, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
};

export default DetectionOverlay;
