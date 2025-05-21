from flask import Flask, request, jsonify
#Flask makes the server
#request lets us read stuff people send to us
# jsonify lets us send stuff back
import pandas as pd

app = Flask(__name__)  #  robot server brain

@app.route("/analyze", methods=["POST"]) 
#If someone sends data to /analyze, and they’re doing a POST (sending info), call the function below."
def analyze_match_data():
    # Get JSON payload
    payload = request.get_json()

    # Extract match data and tolerance value
    df = pd.DataFrame(payload["data"])
    tolerance = payload.get("tolerance", 0.75)  # Default to 0.75 if not provided
   
   

    # Calculate K/D
    df["kdr"] = df["kills"] / df["deaths"]

    # K/D per weapon
    weapon_kdr = df.groupby("weapon")["kdr"].mean()
    global_avg_kdr = df["kdr"].mean()
    tolerance = 0.75

    # Generate suggestions
    suggestions = []
    for weapon, avg_kdr in weapon_kdr.items():
        if avg_kdr > global_avg_kdr + tolerance:
            suggestions.append({
                "weapon": weapon,
                "status": "overpowered",
                "suggestion": "nerf"
            })
        elif avg_kdr < global_avg_kdr - tolerance:
            suggestions.append({
                "weapon": weapon,
                "status": "underpowered",
                "suggestion": "buff"
            })
        else:
            suggestions.append({
                "weapon": weapon,
                "status": "balanced",
                "suggestion": "none"
            })

    return jsonify(suggestions)

if __name__ == "__main__":
    app.run(debug=True)
