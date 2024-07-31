from flask import Flask, render_template, request, jsonify, make_response
from flask_jwt_extended import (
    JWTManager, create_access_token, 
    get_jwt_identity, jwt_required,
    set_access_cookies, set_refresh_cookies, 
    unset_jwt_cookies, create_refresh_token
)
from config import CLIENT_ID, REDIRECT_URI
from controller import Oauth
from model import UserModel, UserData
from datetime import timedelta

app = Flask(__name__)


app.config['JWT_SECRET_KEY'] = "I'M IML."
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 30
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 100

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

    user = UserData(user)
    UserModel().upsert_user(user)

    resp = make_response(render_template('index.html'))
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
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
@jwt_required()  # Use jwt_required() here
def userinfo():
    user_id = get_jwt_identity()
    userinfo = UserModel().get_user(user_id).serialize()
    return jsonify(userinfo)

@app.route('/oauth/url')
def oauth_url_api():
    """
    Kakao OAuth URL 가져오기
    """
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

if __name__ == '__main__':
    app.run(debug=True)
