import os
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow import keras
from difflib import get_close_matches

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "product_matcher_offline.keras")

model = keras.models.load_model(MODEL_PATH)

transactions = pd.read_csv(os.path.join(BASE_DIR, "transactions.csv"))
products = pd.read_csv(os.path.join(BASE_DIR, "products.csv"))
df = pd.merge(products, transactions, on="Transaction ID", how="left")
df["Product Description"] = df["Product Description"].astype(str).str.lower().str.strip()

pairs = df[["Transaction ID", "Product Description"]].dropna()
unique_products = pairs["Product Description"].unique()
product_to_id = {p: i for i, p in enumerate(unique_products)}
id_to_product = {i: p for p, i in product_to_id.items()}
popularity = pairs["Product Description"].value_counts()

app = Flask(__name__)
CORS(app)

def find_similar_names(query, product_list, cutoff=0.6):
    return get_close_matches(query.lower(), [p.lower() for p in product_list], cutoff=cutoff)

def get_similar_products(query, top_k=5):
    if query not in product_to_id:
        return []
    q_id = product_to_id[query]
    emb_matrix = model.get_layer("product_embedding").get_weights()[0]
    q_vec = emb_matrix[q_id]
    sims = np.dot(emb_matrix, q_vec) / (np.linalg.norm(emb_matrix, axis=1) * np.linalg.norm(q_vec))
    top_ids = np.argsort(-sims)[1 : top_k + 1]
    return [id_to_product[i] for i in top_ids]

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    query = data.get("query", "").strip().lower()
    if not query:
        return jsonify({"error": "missing query"}), 400
    variants = find_similar_names(query, unique_products)
    if not variants:
        return jsonify({"message": f"no matches for '{query}'"}), 404
    results = []
    for v in variants:
        pop = int(popularity.get(v, 0))
        addons = get_similar_products(v, top_k=5)
        results.append({"product": v, "popularity": pop, "suggested_addons": addons})
    return jsonify({"query": query, "results": results})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
