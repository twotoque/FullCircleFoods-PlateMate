import React, { useEffect, useRef, useState } from "react";
import * as tmImage from "@teachablemachine/image";

type TMImageModel = {
  predict: (image: HTMLCanvasElement | HTMLVideoElement) => Promise<
    { className: string; probability: number }[]
  >;
  getTotalClasses: () => number;
};

type TMWebcam = {
  canvas: HTMLCanvasElement;
  setup: () => Promise<void>;
  play: () => Promise<void>;
  stop: () => void;
  update: () => void;
};

export default function TeachableDetector() {
  const webcamContainer = useRef<HTMLDivElement | null>(null);
  const labelContainer = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);

  const MODEL_URL = "/foodDetector/"; 

  useEffect(() => {
    if (!started) return;

    let model: TMImageModel;
    let webcam: TMWebcam;
    let maxPredictions: number;

    const init = async () => {
      const modelURL = MODEL_URL + "model.json";
      const metadataURL = MODEL_URL + "metadata.json";

      model = await tmImage.load(modelURL, metadataURL);
      maxPredictions = model.getTotalClasses();

      webcam = new tmImage.Webcam(200, 200, true);
      await webcam.setup();
      await webcam.play();

      if (webcamContainer.current) {
        webcamContainer.current.innerHTML = "";
        webcamContainer.current.appendChild(webcam.canvas);
      }

      if (labelContainer.current) {
        labelContainer.current.innerHTML = "";
        for (let i = 0; i < maxPredictions; i++) {
          labelContainer.current.appendChild(document.createElement("div"));
        }
      }

      const loop = async () => {
        webcam.update();
        await predict();
        window.requestAnimationFrame(loop);
      };
      loop();
    };

    const predict = async () => {
      const prediction = await model.predict(webcam.canvas);
      if (!labelContainer.current) return;

      const filtered = prediction.filter(
        p => p.probability >= 0.7 && p.className.toLowerCase() !== "background"
      );

      if (filtered.length === 0) {
        console.log("No food detected 🍽️");
      }

      // sort by descending probability
      const sortedPredictions = [...prediction].sort(
        (a, b) => b.probability - a.probability
      );

      // Optional: clear the label container each frame
      labelContainer.current.innerHTML = "";

      sortedPredictions.forEach(p => {
        if (p.probability >= 0.7) {
          const div = document.createElement("div");
          div.textContent = `${p.className}: ${(p.probability * 100).toFixed(1)}% ✅`;
          labelContainer.current!.appendChild(div);
        }
      });

      // Or, if you only want to show the single highest prediction:
      // const top = sortedPredictions[0];
      // labelContainer.current.innerHTML =
      //   `${top.className}: ${(top.probability * 100).toFixed(1)}% ✅`;
    };


    init();

    return () => {
      if (webcam) webcam.stop();
    };
  }, [started]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <h2 className="text-lg font-semibold">Teachable Machine Image Model</h2>
      <button
        onClick={() => setStarted(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Start
      </button>
      <div ref={webcamContainer}></div>
      <div ref={labelContainer}></div>
    </div>
  );
}
