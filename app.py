from flask import Flask, render_template, request, jsonify, make_response
from flask_jwt_extended import (
    JWTManager, create_access_token, 
    get_jwt_identity, jwt_required,
    set_access_cookies, set_refresh_cookies, 
    unset_jwt_cookies, create_refresh_token
)
from flask_sqlalchemy import SQLAlchemy
from config import CLIENT_ID, REDIRECT_URI, MYSQL_DATABASE_URI
from model import db, UserModel, Diary, add_emotions_to_db, Emotion, Music
from controller import Oauth
from datetime import datetime, timedelta
from flask_cors import CORS
import requests
import random

# Flask 애플리케이션 초기화
app = Flask(__name__)
CORS(app, supports_credentials=True)

app.config['JWT_SECRET_KEY'] = "my_key"
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['SQLALCHEMY_DATABASE_URI'] = MYSQL_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 데이터베이스 및 JWT 초기화
db.init_app(app)
with app.app_context():
    db.create_all()
    add_emotions_to_db()

jwt = JWTManager(app)

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/oauth")
def oauth_api():
    code = request.args.get('code', type=str)
    oauth = Oauth()
    auth_info = oauth.auth(code)
    user = oauth.userinfo(f"Bearer {auth_info['access_token']}")

    user_data = UserModel.deserialize(user)
    UserModel.upsert_user(user_data.serialize())
    resp = make_response(render_template('index.html'))
    access_token = create_access_token(identity=user_data.id)
    refresh_token = create_refresh_token(identity=user_data.id)
    resp.set_cookie("logined", "true")
    set_access_cookies(resp, access_token)
    set_refresh_cookies(resp, refresh_token)
    return resp

@app.route('/token/refresh')
@jwt_required()
def token_refresh_api():
    user_id = get_jwt_identity()
    resp = jsonify({'result': True})
    access_token = create_access_token(identity=user_id)
    set_access_cookies(resp, access_token)
    return resp

@app.route('/token/remove')
def token_remove_api():
    resp = jsonify({'result': True})
    unset_jwt_cookies(resp)
    resp.delete_cookie('logined')
    return resp

@app.route("/userinfo")
@jwt_required()
def userinfo():
    user_id = get_jwt_identity()
    userinfo = UserModel.get_user(user_id)
    return jsonify(userinfo)

@app.route('/oauth/url')
def oauth_url_api():
    return jsonify(
        kakao_oauth_url=(
            f"https://kauth.kakao.com/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code"
        )
    )

@app.route("/oauth/refresh", methods=['POST'])
def oauth_refresh_api():
    refresh_token = request.json.get('refresh_token')
    result = Oauth().refresh(refresh_token)
    return jsonify(result)

@app.route("/oauth/userinfo", methods=['POST'])
def oauth_userinfo_api():
    access_token = request.json.get('access_token')
    result = Oauth().userinfo(f"Bearer {access_token}")
    return jsonify(result)

@app.route('/diary/save', methods=['POST'])
@jwt_required()
def save_diary():
    user_id = get_jwt_identity()
    data = request.json

    try:
        date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        title = data.get('title', 'Untitled')
        content = data['content']
        emotion_name = data.get('emotion')

        diary = Diary(user_id=user_id, date=date, title=title, content=content, emotion_name=emotion_name)
        db.session.add(diary)
        db.session.commit()

        return jsonify({'result': True})

    except Exception as e:
        print(f"Error saving diary: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/diary/event', methods=['GET'])
@jwt_required()
def get_diary_event():
    user_id = get_jwt_identity()
    date_str = request.args.get('date')
    
    if not date_str:
        return jsonify({'error': 'Date parameter is missing'}), 400
    
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    diaries = Diary.query.filter_by(user_id=user_id, date=date).all()
    
    serialized_diaries = [diary.serialize() for diary in diaries]

    for diary in serialized_diaries:
        diary['musics'] = [music.serialize() for music in Diary.query.get(diary['diary_id']).musics]
    
    return jsonify({'diaries': serialized_diaries})


@app.route('/diary/events', methods=['GET'])
@jwt_required()
def get_all_diary_events():
    user_id = get_jwt_identity()
    diaries = Diary.query.filter_by(user_id=user_id).all()
    
    events = [diary.serialize() for diary in diaries]
    
    return jsonify(events)

@app.route('/diary/update/<int:diary_id>', methods=['PUT'])
@jwt_required()
def update_diary(diary_id):
    data = request.json
    title = data.get('title', 'Untitled')
    content = data.get('content')
    
    diary = Diary.query.filter_by(diary_id=diary_id, user_id=get_jwt_identity()).first()
    
    if not diary:
        return jsonify({'error': 'Diary not found'}), 404
    
    diary.title = title
    diary.content = content
    db.session.commit()
    
    return jsonify({'result': True})

@app.route('/api/rcmd/openai', methods=['POST'])
@jwt_required()
def recommend_music():
    user_id = get_jwt_identity()
    data = request.json

    print(f"Received payload: {data}")

    if not data or not data.get('diary'):
        return jsonify({'error': 'Diary content is required'}), 400

    payload = {
        "user_id": str(user_id),
        "diary": data.get('diary'),
        "emotion": data.get('emotion', []),
        "filter": data.get('filter', {})
    }

    try:
        response = requests.post('https://llm-api-server-1.onrender.com/api/rcmd/openai', json=payload)

        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': f"Failed to get recommendation: {response.text}"}), response.status_code
    except Exception as e:
        return jsonify({'error': f"An error occurred: {str(e)}"}), 500

@app.route('/api/rcmd/openai', methods=['PUT'])
@jwt_required()
def save_music_preference():
    user_id = get_jwt_identity()
    data = request.json

    if not data or not data.get('music'):
        return jsonify({'error': 'Music data is required'}), 400

    payload = {
        "user_id": str(user_id),
        "music": data.get('music')
    }

    try:
        response = requests.put('https://llm-api-server-1.onrender.com/api/rcmd/openai', json=payload)

        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': f"Failed to save music preference: {response.text}"}), response.status_code
    except Exception as e:
        return jsonify({'error': f"An error occurred: {str(e)}"}), 500

@app.route('/today_music', methods=['GET'])
@jwt_required()
def get_today_music():
    user_id = get_jwt_identity()
    today_date = datetime.now().date()
    
    diaries = Diary.query.filter_by(user_id=user_id, date=today_date).all()
    music_list = []
    
    for diary in diaries:
        music_list.extend([music.serialize() for music in diary.musics])
    
    if len(music_list) > 3:
        music_list = random.sample(music_list, 3)
    
    return jsonify({'music': music_list})

@app.route('/diary/delete/<int:diary_id>', methods=['DELETE'])
@jwt_required()
def delete_diary(diary_id):
    user_id = get_jwt_identity()
    
    diary = Diary.query.filter_by(diary_id=diary_id, user_id=user_id).first()
    
    if not diary:
        return jsonify({'error': 'Diary not found'}), 404
    
    try:
        Music.query.filter_by(diary_id=diary_id).delete()
        db.session.delete(diary)
        db.session.commit()
        return jsonify({'result': True})
    except Exception as e:
        print(f"Error deleting diary: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



@app.route('/diary/save_music', methods=['POST'])
@jwt_required()
def save_music():
    data = request.json
    diary_id = data.get('diary_id')
    artist = data.get('artist')
    url = data.get('url')
    music_title = data.get('music_title')

    if not diary_id or not artist or not music_title:
        return jsonify({'error': 'Missing required fields'}), 400

    music_data = {
        'diary_id': diary_id,
        'artist': artist,
        'url': url,
        'music_title': music_title
    }

    try:
        new_music = Music(music_data)
        db.session.add(new_music)
        db.session.commit()

        return jsonify({'result': True})

    except Exception as e:
        print(f"Error saving music: {e}")
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)
