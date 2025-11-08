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

products["Product Description"] = products["Product Description"].astype(str).str.lower().str.strip()
transactions["Transaction ID"] = transactions["Transaction ID"].astype(str).str.strip()
products["Transaction ID"] = products["Transaction ID"].astype(str).str.strip()

df = pd.merge(products, transactions, on="Transaction ID", how="left")

pairs = df[["Transaction ID", "Product Description"]].dropna()
unique_products = pairs["Product Description"].unique()
product_to_id = {p: i for i, p in enumerate(unique_products)}
id_to_product = {i: p for p, i in product_to_id.items()}
popularity = pairs["Product Description"].value_counts()

app = Flask(__name__)
CORS(app)

def find_similar_names(query, product_list, cutoff=0.6):
    query_lower = query.lower()
    matches = [
        p for p in product_list
        if query_lower in p.lower() or query_lower in p.lower().replace("-", " ")
    ]
    fuzzy_matches = get_close_matches(query_lower, [p.lower() for p in product_list], cutoff=cutoff)
    return list(set(matches + fuzzy_matches)) 

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

        row = df[df["Product Description"] == v].head(1)
        if not row.empty:
            product_id = row["Product ID"].iloc[0]
            sales = float(row["Amount"].iloc[0]) if "Amount" in row else 0.0
            zero_waste = str(row["Zero-waste?"].iloc[0]).strip().lower() in ["yes", "true", "1", "zero-waste"]
        else:
            product_id = ""
            sales = 0.0
            zero_waste = False

        results.append({
            "product": v,
            "product_id": product_id,
            "sales": sales,
            "zero_waste": zero_waste,
            "popularity": pop,
            "suggested_addons": addons
        })

    return jsonify({"query": query, "results": results})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
