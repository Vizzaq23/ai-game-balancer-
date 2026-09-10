"""Flask API and production SPA host. Uploaded data is never persisted."""
import json
import os
import time
from pathlib import Path
from threading import Lock
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from balancer.analysis import MAX_BYTES, ValidationError, analyze, parse_csv, validate_records
from balancer.demo import demo_records
from balancer.explanations import explain

load_dotenv()


def create_app():
    app = Flask(__name__, static_folder=None)
    # Normalized JSON repeats field names and can be larger than its source CSV.
    # CSV itself remains strictly capped at 10 MB in parse_csv.
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
    dist = Path(__file__).parent / "frontend" / "dist"
    ai_times, ai_lock = [], Lock()

    def success(data):
        response = jsonify({"data": data, "errors": []})
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.after_request
    def headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.errorhandler(ValidationError)
    def invalid(exc):
        return jsonify({"data": None, "errors": exc.messages}), 400

    @app.errorhandler(HTTPException)
    def http_error(exc):
        message = "Request exceeds the 32 MB envelope limit; CSV files are limited to 10 MB." if exc.code == 413 else exc.description
        return jsonify({"data": None, "errors": [message]}), exc.code

    @app.errorhandler(Exception)
    def unexpected(exc):
        app.logger.exception("Request failed")
        return jsonify({"data": None, "errors": ["An unexpected error occurred. Please try again."]}), 500

    def inputs():
        if "file" in request.files:
            rows = parse_csv(request.files["file"].read(MAX_BYTES + 1))
            try:
                filters = json.loads(request.form.get("filters", "{}"))
            except (ValueError, TypeError):
                raise ValidationError("Filters must be valid JSON.")
            return rows, request.form.get("tolerance", 0.75), filters
        payload = request.get_json()
        if not isinstance(payload, dict):
            raise ValidationError("Expected an object containing data, tolerance and optional filters.")
        return validate_records(payload.get("data")), payload.get("tolerance", 0.75), payload.get("filters")

    @app.get("/health")
    def health():
        return success({"status": "ok"})

    @app.get("/api/v1/demo")
    def demo():
        return success({"records": demo_records(), "synthetic": True, "name": "Synthetic arena playtest"})

    @app.post("/api/v1/analyze")
    def analyze_route():
        rows, tolerance, filters = inputs()
        return success({"analysis": analyze(rows, tolerance, filters), "records": rows})

    @app.post("/api/v1/explanations")
    def explanations():
        rows, tolerance, filters = inputs()
        result = analyze(rows, tolerance, filters)
        if os.getenv("ENABLE_LIVE_AI", "false").lower() == "true":
            with ai_lock:
                now = time.monotonic()
                ai_times[:] = [t for t in ai_times if now - t < 3600]
                if len(ai_times) >= 20:
                    from balancer.explanations import built_in
                    return success({"source": "built_in", "text": built_in(result), "notice": "Hourly AI limit reached; showing a built-in explanation."})
                ai_times.append(now)
        return success(explain(result))

    @app.post("/analyze")
    def legacy():
        rows, tolerance, filters = inputs()
        mapping = {"potential_overpowered": ("overpowered", "nerf"),
                   "potential_underpowered": ("underpowered", "buff"),
                   "within_tolerance": ("balanced", "none"),
                   "insufficient_data": ("insufficient_data", "collect_more_data"),
                   "unavailable": ("unavailable", "collect_more_data")}
        return jsonify([{"weapon": f["weapon"], "status": mapping[f["status"]][0],
                         "suggestion": mapping[f["status"]][1]} for f in analyze(rows, tolerance, filters)["weapons"]])

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path=""):
        if path.startswith("api/") or path == "analyze":
            return jsonify({"data": None, "errors": ["Endpoint not found."]}), 404
        if path and (dist / path).is_file():
            return send_from_directory(dist, path)
        if dist.joinpath("index.html").exists():
            return send_from_directory(dist, "index.html")
        return jsonify({"data": None, "errors": ["Frontend not built. Run npm ci and npm run build in frontend/."]}), 503

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
