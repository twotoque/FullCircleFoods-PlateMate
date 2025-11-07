# model.py — Offline hybrid product recommender
# Python 3.11 + tensorflow-macos + tensorflow-metal compatible

import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers
from difflib import get_close_matches

# === Load CSVs ===
transactions = pd.read_csv("transactions.csv")
products = pd.read_csv("products.csv")

# Merge on Transaction ID
df = pd.merge(products, transactions, on="Transaction ID", how="left")

# Normalize text
df["Product Description"] = df["Product Description"].astype(str).str.lower().str.strip()

# === Build (transaction, product) pairs ===
pairs = df[["Transaction ID", "Product Description"]].dropna()

# === Encode products ===
unique_products = pairs["Product Description"].unique()
product_to_id = {p: i for i, p in enumerate(unique_products)}
id_to_product = {i: p for p, i in product_to_id.items()}
pairs["prod_id"] = pairs["Product Description"].map(product_to_id)

# === Generate (input, context) training pairs ===
inputs, contexts = [], []
for tid, group in pairs.groupby("Transaction ID"):
    prods = group["prod_id"].tolist()
    for i in prods:
        for j in prods:
            if i != j:
                inputs.append(i)
                contexts.append(j)

inputs = np.array(inputs)
contexts = np.array(contexts)

# === Define embedding model ===
vocab_size = len(product_to_id)
embed_dim = 8

input_layer = layers.Input(shape=(), name="input_id")
context_layer = layers.Input(shape=(), name="context_id")

embedding = layers.Embedding(vocab_size, embed_dim, name="product_embedding")(input_layer)
context_embedding = layers.Embedding(vocab_size, embed_dim, name="context_embedding")(context_layer)

# Dot-product similarity
dot_product = layers.Dot(axes=1)([embedding, context_embedding])
output = layers.Activation("sigmoid")(dot_product)

model = tf.keras.Model([input_layer, context_layer], output)
model.compile(optimizer="adam", loss="binary_crossentropy")

# === Train offline (short run) ===
print("Training model (7 epochs)...")
model.fit([inputs, contexts], np.ones(len(inputs)), epochs=7, verbose=1)

# === Save offline model ===
model.save("product_matcher_offline.keras")
print("✅ Saved model as product_matcher_offline.keras")

# === Popularity table ===
popularity = pairs["Product Description"].value_counts()

# === Helper: find similar product names ===
def find_similar_names(query, product_list, cutoff=0.6):
    return get_close_matches(query.lower(), [p.lower() for p in product_list], cutoff=cutoff)

# === Get add-on recommendations ===
def get_similar_products(query, top_k=5):
    if query not in product_to_id:
        print(f"⚠️ Unknown product: {query}")
        return []
    q_id = product_to_id[query]
    emb_matrix = model.get_layer("product_embedding").get_weights()[0]
    q_vec = emb_matrix[q_id]
    sims = np.dot(emb_matrix, q_vec) / (np.linalg.norm(emb_matrix, axis=1) * np.linalg.norm(q_vec))
    top_ids = np.argsort(-sims)[1 : top_k + 1]
    return [id_to_product[i] for i in top_ids]

# === Combined recommender ===
def recommend(query, top_k=5):
    # 1. Find all variants (e.g. organic spinach, baby spinach)
    variants = find_similar_names(query, unique_products)
    if not variants:
        print(f"⚠️ No close matches for '{query}'.")
        return
    print(f"\n🪴 Results for '{query}':\n")

    for v in variants:
        pop = int(popularity.get(v, 0))
        print(f"• {v.title()}  (purchased {pop}×)")
        addons = get_similar_products(v, top_k=top_k)
        if addons:
            print("   ↳ Suggested add-ons:", ", ".join(a.title() for a in addons))
        else:
            print("   ↳ No add-ons found.")
        print()

# === Example demo ===
recommend("spinach")
recommend("classic hummus")
