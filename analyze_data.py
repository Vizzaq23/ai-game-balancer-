import pandas as pd

# Load your game data
df = pd.read_csv("match_data.csv")

# Show the first 5 rows
print("Game Match Data:")
print(df.head())

# Calculate average stats by weapon

weapon_stats = df.groupby("weapon").agg({
    "kills": "mean",
    "deaths": "mean",
    "damage_done": "mean"
})
#So we can see if a weapon is too strong or too weak on average.
print("\n Average Stats per Weapon:")
print(weapon_stats)

# Calculate kill/death ratio (K/D)
df["kdr"] = df["kills"] / df["deaths"]

# Show top K/D ratios
print("\n Players with Top K/D Ratio:")
print(df.sort_values("kdr", ascending=False).head())
# Average K/D ratio per weapon
weapon_kdr = df.groupby("weapon")["kdr"].mean()
print("\n📈 Average K/D per Weapon:")
print(weapon_kdr)

# Global average K/D
#If a weapon is above or below the global K/D average by more than 0.75, we flag it.
global_avg_kdr = df["kdr"].mean()
tolerance = 0.75

print(f"\nGlobal Average K/D Ratio: {global_avg_kdr:.2f}")
print("🔍 Weapon Balance Suggestions:")

for weapon, avg_kdr in weapon_kdr.items():
    if avg_kdr > global_avg_kdr + tolerance:
        print(f"⚠️ {weapon} is OVERPOWERED (avg K/D = {avg_kdr:.2f}) → Suggest nerf (reduce damage)")
    elif avg_kdr < global_avg_kdr - tolerance:
        print(f"⚠️ {weapon} is UNDERPOWERED (avg K/D = {avg_kdr:.2f}) → Suggest buff (increase damage)")
    else:
        print(f"✅ {weapon} is balanced (avg K/D = {avg_kdr:.2f})")