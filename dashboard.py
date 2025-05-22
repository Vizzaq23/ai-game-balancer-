import streamlit as st 
import pandas as pd
import requests
import matplotlib.pyplot as plt

# Set the title of the dashboard
st.set_page_config(page_title="Game Balance Dashboard",layout="centered")
#This shows a big page title at the top
st.title("🎮 AI Game Balancer")
st.write("Analyze your game data and get balance suggestions!")
tolerance = st.slider(" Balance Sensitivity", min_value=0.1,max_value=2.0, value=0.75, step=0.05)
#This shows a slider to adjust the sensitivity of the balance analysis
# Upload CSV file
uploaded_file = st.file_uploader("Upload your game data CSV file", type=["csv"])
if uploaded_file is not None:
    # Read the CSV file
    df =pd.read_csv(uploaded_file)
    st.write("Game Match Data:")
    st.dataframe(df)  # Shows the uploaded game data as an interactive table on the page.
    # Calculate kill/death ratio and average K/D per weapon
    df["kdr"] = df["kills"] / df["deaths"]
    weapon_kdr = df.groupby("weapon")["kdr"].mean()
            #groups the data by weapon (like "Rifle", "Shotgun", etc.)
    # calculates the average K/D ratio for each weapon.
    # Show bar chart of average K/D per weapon
    st.write("📈 Average K/D Ratio per Weapon:")
    st.bar_chart(weapon_kdr)
    fig, ax = plt.subplots()
    weapon_kdr.plot(kind="bar", ax=ax)
    ax.set_ylabel("Avg K/D Ratio")
    ax.set_xlabel("Weapon")
    st.pyplot(fig)
   

    
    # Send data to API
    payload = {
        "data": df.to_dict(orient="records"),
        "tolerance": tolerance
    }

    try:
        response = requests.post("http://127.0.0.1:5000/analyze", json=payload)
        st.write("📡 Raw response object:", response)

        if response.status_code == 200:
            results = response.json()
            st.write("🔍 API response data:", results)

            # If response is wrapped like {"suggestions": [...]}, unpack it
            if isinstance(results, dict) and "suggestions" in results:
                results = results["suggestions"]

            st.write("⚖️ Weapon Balance Suggestions:")
            for r in results:
                st.write(f"⚠️ {r['weapon']} → {r['status'].upper()} → Suggest: {r['suggestion']}")
        else:
            st.error(f"API request failed. Status code: {response.status_code}")
    except Exception as e:
        st.error(f"⚠️ Failed to connect to API or parse response: {e}")