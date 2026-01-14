from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

SCORES_FILE = '/home/fabien/Antigravity/projects/petit-simon/scores.json'

def load_scores():
    if os.path.exists(SCORES_FILE):
        with open(SCORES_FILE, 'r') as f:
            return json.load(f)
    return []

def save_scores(scores):
    with open(SCORES_FILE, 'w') as f:
        json.dump(scores, f)

@app.route('/scores', methods=['GET'])
def get_scores():
    scores = load_scores()
    # Sort by score descending
    sorted_scores = sorted(scores, key=lambda x: x['score'], reverse=True)
    top_15 = sorted_scores[:15]
    highest = sorted_scores[0] if sorted_scores else None
    return jsonify({
        'top_15': top_15,
        'highest': highest
    })

@app.route('/score', methods=['POST'])
def add_score():
    data = request.json
    nickname = data.get('nickname')
    score = data.get('score')
    
    if not nickname or score is None:
        return jsonify({'error': 'Missing nickname or score'}), 400
    
    scores = load_scores()
    scores.append({'nickname': nickname, 'score': score})
    save_scores(scores)
    
    return jsonify({'message': 'Score saved successfully'})

if __name__ == '__main__':
    app.run(port=5000)
