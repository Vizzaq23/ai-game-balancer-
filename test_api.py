import requests

# Sample game data to send (same format as your CSV)
data = [
    {"player_id": "P1", "team": "Red", "weapon": "Rifle", "kills": 18, "deaths": 6, "damage_done": 1300},
    {"player_id": "P2", "team": "Blue", "weapon": "Shotgun", "kills": 9, "deaths": 10, "damage_done": 700},
    {"player_id": "P3", "team": "Red", "weapon": "Rifle", "kills": 21, "deaths": 4, "damage_done": 1450},
    {"player_id": "P4", "team": "Blue", "weapon": "Pistol", "kills": 6, "deaths": 12, "damage_done": 500},
    {"player_id": "P5", "team": "Red", "weapon": "Rifle", "kills": 19, "deaths": 7, "damage_done": 1200},
    {"player_id": "P6", "team": "Blue", "weapon": "Shotgun", "kills": 10, "deaths": 11, "damage_done": 750},
    {"player_id": "P7", "team": "Red", "weapon": "Pistol", "kills": 8, "deaths": 9, "damage_done": 600},
    {"player_id": "P8", "team": "Blue", "weapon": "Shotgun", "kills": 7, "deaths": 13, "damage_done": 550}
]

# Send to your local server
response = requests.post("http://127.0.0.1:5000/analyze", json=data)

# Print what the server returns
print("✅ Server Response:")
print(response.json())
