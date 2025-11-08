import pandas as pd
import matplotlib.pyplot as plt

dfs = pd.read_excel("../../Dataset/full-circle-foods-data.xlsx", sheet_name=None)

df_target = dfs["Lines"]
rows, cols = df_target.shape
count = (df_target["Zero-waste?"] == "zero-waste").sum()

# Console Checks
print(f"Total Columns: {cols}")
print(f"Total Rows: {rows}")
print(f"Zero-Waste Count: {count}")
print(f"Percentage of Zero-Waste Products: {round((count / rows) * 100, 2)}%")

# Charts Creation
zero = count
non_zero = rows - count

labels = ["Zero-Waste", "Not Zero-Waste"]
values = [zero, non_zero]
colors = ["#D1E297", "#EEF2DB"]

plt.pie(values, labels=labels, autopct="%1.1f%%", colors=colors)
plt.show()

