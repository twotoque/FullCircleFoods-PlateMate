import { useEffect, useRef, useState } from "react";
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
        Spinach: { quantity: 30, unit: "grams" },
        Onions: { quantity: 1, unit: "piece" },
        Garlic: { quantity: 1, unit: "piece" },
      },
      servings: 1,
      average_price: 5.99,
      recommended_addons: ["Cheese", "Spinach", "Ketchup"],
    },
    "Breakfast Sandwich": {
      ingredients_per_serving: {
        Sausage: { quantity: 1, unit: "piece" },
        Bread: { quantity: 1, unit: "loaf" },
        Eggs: { quantity: 1, unit: "eggs" },
      },
      servings: 1,
      average_price: 5.99,
      recommended_addons: ["Cheese", "Spinach", "Ketchup"],
    },
    "Spaghetti and Meatballs": {
      ingredients_per_serving: {
        Sausage: { quantity: 1, unit: "pieces" },
        Spaghetti: { quantity: 250, unit: "grams" },
        Tomato: { quantity: 1, unit: "tomatoes" },
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
      webcam = new tmImage.Webcam(300, 300, true);
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

      if (lastPrediction.current === foodName) return;
      lastPrediction.current = foodName;

      labelContainer.current.innerHTML = "";

      const mainCard = document.createElement("div");
      mainCard.className =
        "bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4";

      const foodTitle = document.createElement("h3");
      foodTitle.textContent = foodName;
      foodTitle.className = "text-xl font-bold text-gray-900";

      const confidenceBadge = document.createElement("span");
      confidenceBadge.textContent = `${confidence}% confidence`;
      confidenceBadge.className =
        "bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold mt-2 inline-block";

      mainCard.appendChild(foodTitle);
      mainCard.appendChild(confidenceBadge);

      labelContainer.current.appendChild(mainCard);

      const foodInfo = Object.entries(foodData).find(
        ([key]) => key.toLowerCase() === foodName.toLowerCase()
      )?.[1];

      if (foodInfo) {
        const now = Date.now();

        // cache API calls to avoid spamming (turned off rn)
        if (now - lastAPICall.current > 0) {
          lastAPICall.current = now;

          const ingredients = Object.keys(foodInfo.ingredients_per_serving);

          ingredients.forEach((item) => {
            const trimmedItem = item.trim();
            const itemDetails = foodInfo.ingredients_per_serving[trimmedItem];

            const ingredientCard = document.createElement("div");
            ingredientCard.className =
              "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3";

            const ingredientHeader = document.createElement("div");
            ingredientHeader.className =
              "p-4 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between";

            const headerLeft = document.createElement("div");
            headerLeft.className = "flex-1";

            const ingredientTitle = document.createElement("h4");
            ingredientTitle.innerHTML = `
              <span class="font-semibold text-gray-900">${trimmedItem}</span>
              <span class="text-xs text-gray-500 ml-2">(${itemDetails.quantity} ${itemDetails.unit} per serving)</span>
            `;
            ingredientTitle.className = "text-base";

            headerLeft.appendChild(ingredientTitle);

            const chevron = document.createElement("span");
            chevron.textContent = "▼";
            chevron.className =
              "text-gray-400 text-xl transition-transform duration-200";

            ingredientHeader.appendChild(headerLeft);
            ingredientHeader.appendChild(chevron);

            const productsContainer = document.createElement("div");
            productsContainer.className =
              "hidden border-t border-gray-200 bg-gray-50 p-4 space-y-2";

            const loadingText = document.createElement("p");
            loadingText.textContent = "Loading products...";
            loadingText.className = "text-gray-500 text-sm";
            productsContainer.appendChild(loadingText);

            ingredientCard.appendChild(ingredientHeader);
            ingredientCard.appendChild(productsContainer);

            ingredientHeader.onclick = () => {
              const isExpanded = !productsContainer.classList.contains("hidden");
              if (isExpanded) {
                productsContainer.classList.add("hidden");
                chevron.style.transform = "rotate(0deg)";
              } else {
                productsContainer.classList.remove("hidden");
                chevron.style.transform = "rotate(180deg)";
              }
            };

            labelContainer.current!.appendChild(ingredientCard);

            fetch("http://127.0.0.1:5050/predict", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: trimmedItem }),
            })
              .then((r) => r.json())
              .then((data) => {
                productsContainer.innerHTML = "";

                if (data.results?.length) {
                  data.results.forEach((match: any) => {
                    const productCard = document.createElement("div");
                    productCard.className =
                      "bg-white p-3 rounded-lg border border-gray-200";

                    const productName = document.createElement("p");
                    productName.innerHTML = `
                      <span class="font-semibold text-gray-900">${match.product}</span>
                      <span class="text-xs text-gray-500 ml-2">(ID: ${match.product_id})</span>
                    `;
                    productCard.appendChild(productName);

                    const infoRow = document.createElement("div");
                    infoRow.className = "flex items-center gap-4 text-sm mb-2 mt-1";

                    const sales = document.createElement("span");
                    
                    let displaySales = match.sales ?? 0;

                    // prototype divider since the transaction shows entire sale 
                    if (displaySales > 100) displaySales /= 5;
                    else if (displaySales > 50) displaySales /= 4;
                    else if (displaySales > 20) displaySales /= 3;

                    sales.textContent = `$${displaySales.toFixed(2)}`;

                    sales.className = "text-green-700 font-medium";

                    const zeroWaste = document.createElement("span");
                    zeroWaste.textContent = match.zero_waste
                      ? "♻️ Zero-waste"
                      : "Standard";
                    zeroWaste.className = match.zero_waste
                      ? "text-emerald-600"
                      : "text-gray-500";

                    infoRow.appendChild(sales);
                    infoRow.appendChild(zeroWaste);
                    productCard.appendChild(infoRow);

                    if (match.suggested_addons?.length) {
                      const upsellSection = document.createElement("div");
                      upsellSection.className =
                        "mt-2 pt-2 border-t border-gray-100";
                      const upsellLabel = document.createElement("p");
                      upsellLabel.textContent = "Other customers also bought:";
                      upsellLabel.className =
                        "text-xs text-gray-500 mb-1";
                      const upsellList = document.createElement("p");
                      upsellList.textContent =
                        match.suggested_addons.join(", ");
                      upsellList.className =
                        "text-sm text-blue-600 font-medium";
                      upsellSection.appendChild(upsellLabel);
                      upsellSection.appendChild(upsellList);
                      productCard.appendChild(upsellSection);
                    }

                    productsContainer.appendChild(productCard);
                  });
                } else {
                  const noneP = document.createElement("p");
                  noneP.textContent = `No products found for "${trimmedItem}"`;
                  noneP.className = "text-sm text-gray-500";
                  productsContainer.appendChild(noneP);
                }
              })
              .catch((err) => {
                productsContainer.innerHTML = "";
                const errorP = document.createElement("p");
                errorP.textContent = `Error loading products: ${err.message}`;
                errorP.className = "text-sm text-red-600";
                productsContainer.appendChild(errorP);
              });
          });
        }
      } else {
        const noneP = document.createElement("p");
        noneP.textContent = "⚠️ Food not found in database";
        noneP.className = "text-yellow-600";
        labelContainer.current.appendChild(noneP);
      }
    };

    init();

    return () => {
      if (webcam) webcam.stop();
    };
  }, [started]);

  return (
    <>
      <div className="absolute inset-0 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(at_50%_25%,#eaffd0_0%,#f7fee7_35%,white_80%),radial-gradient(at_15%_85%,#fff1e6_0%,transparent_75%),radial-gradient(at_80%_90%,#fff7ed_0%,transparent_75%),radial-gradient(at_90%_20%,#fffbe6_0%,transparent_80%)] opacity-95 blur-2xl"></div>
        <div className="absolute inset-0 bg-white/50 pointer-events-none"></div>
      </div>

      <div className="flex flex-col h-screen content-center w-screen pl-50 pr-50 pt-25 z-10">
        <div className="flex flex-col items-center pb-5 gap-5">
          <img
            src="/Logo.png"
            alt="Ingredient Detector Logo"
            className=" h-25 w-auto  object-contain"
          />
          <h2 className="text-3xl font-bold text-center flex items-center justify-center flex-shrink-0">
            PlateMate: Your Smart Ingredient Detector
          </h2>
          <p className="text-sm pb-5">
            Developed by Derek Song, Amun Ahmad & Allan Yang. Powered by the Wilfrid Laurier University Start-Up Lab.
          </p>

          {!started && (
            <div className="flex justify-center mb-6 flex-shrink-0">
              <button
                onClick={() => setStarted(true)}
                className="!bg-green-800 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Start
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 gap-6 px-6 pb-6 min-h-0">
          <div className="flex-shrink-0">
            <div
              ref={webcamContainer}
              className="flex justify-center items-center w-80 h-80 bg-gray-100 rounded-lg shadow-md overflow-hidden"
            ></div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div
              ref={labelContainer}
              className="space-y-3 pr-2 overflow-y-auto flex-1"
            ></div>
          </div>
        </div>
      </div>
    </>
  );
}
