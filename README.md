# PlateMate - Smart Ingredient Detector
A real-time food recognition system that identifies dishes through your webcam and recommends relevant grocery products using machine learning. Built for the Conestoga Experience Ventures 2025 by the Wilfrid Laurier University Start-Up Lab. 
# Overview
PlateMate uses computer vision to detect food items and provides intelligent product recommendations from transaction data. 
* Real-time food detection via webcam 
* Smart product matching and recommendations based on co-purchase patterns
* Pricing and zero-waste product highlighting

## How it works
PlateMate contains two machine learning models:
1. **Food Classification Model (Google Teachable Machine):** Identifies dishes from webcam feed using image recognition. As an minimum viable product, it supports three dishes: caesar salads, spaghetti & meatballs, and breakfast sandwiches.  
2. **Product Recommendation Model (TensorFlow + Keras):** Recommends related products using embedding-based similarity from past purchases. Transaction ID is used as a primary key to connect both the transaction and product tables.

The backend is connected with Flask and Python and is defaulted to port 5050. Frontend is made with React and Typescript. Meals are defined in the const foodData held in the IngredientDetector.tsx file. When the program is ran:

1. **Food detection**: Webcam feed is analyzed by a Teachable Machine model trained on food images
2. **Find ongredients**: Detected foods are mapped to ingredient lists in `foodData`
3. **Match products**: Ingredients are sent to Flask API for fuzzy matching against product database
4. **Recommendations**: Neural network embeddings generate "frequently bought together" suggestions
5. **Display**: Results show matching products with pricing, zero-waste indiciators, and suggested products

## Installation

### Prerequisites


- Python 3.11 
- Node.js 14.x (for frontend build tools and package management)
- npm or yarn
- pip

#### Python packages

- `flask`
  - `flask-cors` 
- `tensorflow`
  - Includes `keras`
- `pandas` 
- `numpy`

For data visualizations
- `matplotlib.pyplot`

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/platemate.git
cd platemate
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Create the model directory
mkdir -p public/foodDetector

# Place your Teachable Machine model files in public/foodDetector/
# - model.json
# - metadata.json
# - weights.bin

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173` (or your configured port).

### 3. Backend Setup

```bash
# Navigate to backend directory (if separate)
cd backend

# Install Python dependencies
pip install flask flask-cors tensorflow pandas numpy

# Prepare your data files
# Place transactions_fake.csv and products_fake.csv in the backend directory

# Train the recommendation model
python train_model.py

# Start the Flask API server
python app.py
```

The API will be available at `http://localhost:5050`.

### 4. Verify Installation

1. Open your browser to the frontend URL
2. Click "Start" to activate the webcam
3. Show a food item to the camera
4. Check that products appear in the sidebar

## Data Requirements

The system expects two CSV files in the backend directory. The Keras model and .csv files are **examples** and do not represent Full Circle Food's data. 

### transactions_fake.csv
```csv
Transaction ID,Date,Customer,Location,Amount
0000a,9/1/25,,in-store,15.99
0000b,9/1/25,,delivery,23.45
```

### products_fake.csv
```csv
Transaction ID,Product ID,Product Description,Zero-waste?
0000a,00001,Spinach,yes
0000a,00002,Garlic,no
0000b,00003,Carrots,no
```
This tells us that
* `0000a` was a transaction costing 15.99 that contained Spinach and Garlic
* `0000b` was a transaction costing 23.45 that contained Carrots

## Model Training

The recommendation engine uses product co-occurrence embeddings:

```bash
python train_model.py
```

This trains a neural network on transaction pairs to learn which products are purchased together, saving embeddings for similarity search.

### How the Recommendation Model Works

The model learns product embeddings by training on co-purchase patterns:
- **Input**: Product pairs from the same transaction
- **Architecture**: Dual embedding layers with dot product similarity
- **Training**: Binary classification (products bought together = 1)
- **Inference**: Cosine similarity search in embedding space

Products frequently purchased together will have similar embeddings, enabling accurate recommendations.

## API Endpoints

### POST `/predict`

**Request:**
```json
{
  "query": "spinach"
}
```

**Response:**
```json
{
  "query": "spinach",
  "results": [
    {
      "product": "organic spinach",
      "product_id": "12345",
      "sales": 4.99,
      "zero_waste": true,
      "popularity": 42,
      "suggested_addons": ["garlic", "olive oil", "feta cheese"]
    }
  ]
}
```
## Configuration

### Teachable Machine Model
Place `model.json` and `metadata.json` in `/public/foodDetector/`

### Food Database
Edit `foodData` object in `IngredientDetector.tsx` to add dishes and ingredients:

```typescript
const foodData: FoodData = {
  "Your Dish Name": {
    ingredients_per_serving: {
      "Ingredient": { quantity: 100, unit: "grams" },
    },
    servings: 1,
    average_price: 5.99,
    recommended_addons: ["Item1", "Item2"],
  },
};
```

Footnote: ingredient pricing is found through the transaction info and may differ as the given csv files aggregate entire purchases. 

### Detection Settings
- **Confidence Threshold**: Adjust `top.probability < 0.7` in the code for sensitivity
- **API Cache**: Modify `lastAPICall` timeout (currently disabled: `> 0`)
