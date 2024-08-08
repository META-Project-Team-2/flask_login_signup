from flask import Flask, render_template, request, jsonify, make_response
from flask_jwt_extended import (
    JWTManager, create_access_token, 
    get_jwt_identity, jwt_required,
    set_access_cookies, set_refresh_cookies, 
    unset_jwt_cookies, create_refresh_token
)
from flask_sqlalchemy import SQLAlchemy
from config import CLIENT_ID, REDIRECT_URI, MYSQL_DATABASE_URI
from model import db, UserModel, Diary  
from controller import Oauth
from datetime import datetime

# Flask 애플리케이션 초기화
app = Flask(__name__)

app.config['JWT_SECRET_KEY'] = "I'M IML."
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 30
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 100
app.config['SQLALCHEMY_DATABASE_URI'] = MYSQL_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 데이터베이스 및 JWT 초기화
db.init_app(app)
jwt = JWTManager(app)

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/oauth")
def oauth_api():
    code = str(request.args.get('code'))
    oauth = Oauth()
    auth_info = oauth.auth(code)
    user = oauth.userinfo("Bearer " + auth_info['access_token'])


    print("User data:", user)

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
        kakao_oauth_url="https://kauth.kakao.com/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code" \
        % (CLIENT_ID, REDIRECT_URI)
    )

@app.route("/oauth/refresh", methods=['POST'])
def oauth_refresh_api():
    refresh_token = request.get_json().get('refresh_token')
    result = Oauth().refresh(refresh_token)
    return jsonify(result)

@app.route("/oauth/userinfo", methods=['POST'])
def oauth_userinfo_api():
    access_token = request.get_json().get('access_token')
    result = Oauth().userinfo("Bearer " + access_token)
    return jsonify(result)

# 일기 저장
@app.route('/diary/save', methods=['POST'])
@jwt_required()
def save_diary():
    user_id = get_jwt_identity()
    data = request.get_json()
    date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    content = data['content']
    
    diary = Diary(user_id=user_id, date=date, content=content)
    db.session.add(diary)
    db.session.commit()
    
    return jsonify({'result': True})

# 일기 조회
@app.route('/diary/events', methods=['GET'])
@jwt_required()
def get_diary_events():
    user_id = get_jwt_identity()
    diaries = Diary.query.filter_by(user_id=user_id).all()
    
    events = [diary.serialize() for diary in diaries]
    
    return jsonify(events)

if __name__ == '__main__':
    app.run(debug=True)
