# PlateMate - Smart Ingredient Detector
A real-time food recognition system that identifies dishes through your webcam and recommends relevant grocery products using machine learning.
# Overview
PlateMate uses computer vision to detect food items and provides intelligent product recommendations from transaction data. 
## How it works
PlateMate contains two machine learning models:
1. **Food Classification Model (Google Teachable Machine):** Identifies dishes from webcam feed using image recognition. As an minimum viable product, it supports three dishes: caesar salads, spaghetti & meatballs, and breakfast sandwiches.  
2. **Product Recommendation Model (TensorFlow + Keras): ** Recommends related products using embedding-based similarity from past purchases. Transaction ID is used as a primary key to connect both the transaction and product tables. 
