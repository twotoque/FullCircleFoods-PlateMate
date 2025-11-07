import React, { useRef, useEffect } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

interface Prediction {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export default function IngredientDetector() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if (videoRef.current) {
          await new Promise<void>(resolve => {
            videoRef.current!.onloadedmetadata = () => resolve();
          });
        }

      }
    };

    const runModel = async () => {
      const model = await cocoSsd.load();

      const detect = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const predictions: Prediction[] = await model.detect(videoRef.current);
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);

        predictions.forEach(p => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = "lime";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = "lime";
          ctx.fillText(`${p.class} (${Math.round(p.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
        });

        requestAnimationFrame(detect);
      };

      detect();
    };

    startCamera().then(runModel);
  }, []);

  return (
    <div className="relative w-[640px] h-[480px]">
      <video ref={videoRef} autoPlay playsInline className="absolute left-0 top-0" width="640" height="480" />
      <canvas ref={canvasRef} className="absolute left-0 top-0" width="640" height="480" />
    </div>
  );
}
