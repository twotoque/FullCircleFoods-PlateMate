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

type FoodData = {
  [foodName: string]: {
    ingredients_per_serving: Record<string, { quantity: number; unit: string }>;
    servings: number;
    average_price: number;
    recommended_addons: string[];
  };
};

export default function IngredientDetector() {
  const webcamContainer = useRef<HTMLDivElement | null>(null);
  const labelContainer = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const lastAPICall = useRef<number>(0);
  const lastPrediction = useRef<string | null>(null);

  const MODEL_URL = "/foodDetector/";

  const foodData: FoodData = {
    "Caesar Salad": {
      ingredients_per_serving: {
        Spinach: { quantity: 1, unit: "piece" },
        Onions: { quantity: 1, unit: "large" },
        Garlic: { quantity: 1, unit: "large" },
      },
      servings: 1,
      average_price: 5.99,
      recommended_addons: ["Cheese", "Spinach", "Ketchup"],
    },
    "Breakfast Sandwich": {
      ingredients_per_serving: {
        Sausage: { quantity: 1, unit: "piece" },
        Bread: { quantity: 1, unit: "large" },
        Eggs: { quantity: 1, unit: "large" },
      },
      servings: 1,
      average_price: 5.99,
      recommended_addons: ["Cheese", "Spinach", "Ketchup"],
    },
    "Spaghetti and Meatballs": {
      ingredients_per_serving: {
        Sausage: { quantity: 1, unit: "piece" },
        Spaghetti: { quantity: 1, unit: "large" },
        Tomato: { quantity: 1, unit: "large" },
      },
      servings: 1,
      average_price: 5.99,
      recommended_addons: ["Cheese", "Spinach", "Ketchup"],
    },
  };

  useEffect(() => {
    if (!started) return;

    let model: TMImageModel;
    let webcam: TMWebcam;

    const init = async () => {
      const modelURL = MODEL_URL + "model.json";
      const metadataURL = MODEL_URL + "metadata.json";

      model = await tmImage.load(modelURL, metadataURL);
      webcam = new tmImage.Webcam(200, 200, true);
      await webcam.setup();
      await webcam.play();

      if (webcamContainer.current) {
        webcamContainer.current.innerHTML = "";
        webcamContainer.current.appendChild(webcam.canvas);
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

      const sortedPredictions = [...prediction].sort(
        (a, b) => b.probability - a.probability
      );
      const top = sortedPredictions[0];
      if (!top || top.probability < 0.7) return;

      const foodName = top.className.trim();
      const confidence = (top.probability * 100).toFixed(1);

      // 🚫 Skip redundant predictions
      if (lastPrediction.current === foodName) return;
      lastPrediction.current = foodName;

      // Clear only once per new detection
      labelContainer.current.innerHTML = "";

      const p1 = document.createElement("p");
      p1.textContent = `${foodName}: ${confidence}% ✅`;
      labelContainer.current!.appendChild(p1);

      const foodInfo = Object.entries(foodData).find(
        ([key]) => key.toLowerCase() === foodName.toLowerCase()
      )?.[1];

      if (foodInfo) {
        const ingrList = Object.entries(foodInfo.ingredients_per_serving)
          .map(
            ([name, details]) => `${name} (${details.quantity} ${details.unit})`
          )
          .join(", ");

        const p2 = document.createElement("p");
        p2.textContent = `Ingredients: ${ingrList}`;
        labelContainer.current!.appendChild(p2);

        const p3 = document.createElement("p");
        p3.textContent = `Add-ons: ${foodInfo.recommended_addons.join(", ")}`;
        labelContainer.current!.appendChild(p3);

        const now = Date.now();
        if (now - lastAPICall.current > 2000) {
          lastAPICall.current = now;

          const ingredients = Object.keys(foodInfo.ingredients_per_serving);
          for (const item of ingredients) {
            const trimmedItem = item.trim();
            console.log(`📤 Querying backend for "${trimmedItem}"`);

            try {
              fetch("http://127.0.0.1:5050/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: trimmedItem }),
              })
                .then((r) => r.json())
                .then((data) => {
                  console.log(`📬 Backend reply for "${trimmedItem}":`, data);
                  const reply = document.createElement("p");

if (data.results?.length) {
  // Create a container for all backend matches
  const multiReply = document.createElement("div");
  multiReply.classList.add("backend-results");

  data.results.forEach((match: any, i: number) => {
    const itemP = document.createElement("p");
    const addons = match.suggested_addons?.length
      ? match.suggested_addons.join(", ")
      : "None";
    itemP.textContent = `${i + 1}. ${match.product} | Popularity: ${match.popularity} | Add-ons: ${addons}`;
    multiReply.appendChild(itemP);
  });

  labelContainer.current!.appendChild(multiReply);
} else {
  const noneP = document.createElement("p");
  noneP.textContent = `No match found for "${trimmedItem}"`;
  labelContainer.current!.appendChild(noneP);
}
                })
                .catch((err) => {
                  console.error("🚫 Backend error:", err);
                  const errorP = document.createElement("p");
                  errorP.textContent = `Backend error: ${err}`;
                  labelContainer.current!.appendChild(errorP);
                });
            } catch (err) {
              console.error("⚠️ Could not send to backend:", err);
              const errorP = document.createElement("p");
              errorP.textContent = `Failed to send request: ${err}`;
              labelContainer.current!.appendChild(errorP);
            }
          }
        }
      } else {
        const noneP = document.createElement("p");
        noneP.textContent = "⚠️ Not in foodData constant";
        labelContainer.current!.appendChild(noneP);
      }
    };

    init();

    return () => {
      if (webcam) webcam.stop();
    };
  }, [started]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <h2 className="text-lg font-semibold">🍳 Ingredient Detector</h2>
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
