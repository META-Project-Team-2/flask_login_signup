from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class UserModel(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.BigInteger, primary_key=True)  
    username = db.Column(db.String(255), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    password = db.Column(db.String(255), nullable=True)

    def __init__(self, user_data):
        self.id = user_data.get('id')
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.password = user_data.get('password')

    def serialize(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "password": self.password
        }

    @staticmethod
    def deserialize(user_data):
        return UserModel({
            "id": user_data.get('id', 0),  
            "username": user_data.get('username', ''),
            "email": user_data.get('email', ''),
            "password": user_data.get('password', '')
        })

    @staticmethod
    def upsert_user(user_data):
        user = UserModel.query.get(user_data.get('id'))
        if user:
            user.username = user_data.get('username')
            user.email = user_data.get('email')
            user.password = user_data.get('password')
        else:
            user = UserModel(user_data)
            db.session.add(user)
        db.session.commit()

    @staticmethod
    def get_user(user_id):
        user = UserModel.query.get(user_id)
        if user:
            return user.serialize()
        return None

    @staticmethod
    def remove_user(user_id):
        user = UserModel.query.get(user_id)
        if user:
            db.session.delete(user)
            db.session.commit()

class Diary(db.Model):
    __tablename__ = 'diaries'
    diary_id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    title = db.Column(db.String(255), nullable=False) 
    content = db.Column(db.Text, nullable=False)
    emotion_name = db.Column(db.String(255), nullable=True)  

    def __init__(self, user_id, date, title, content, emotion_name=None):
        self.user_id = user_id
        self.date = date
        self.title = title
        self.content = content
        self.emotion_name = emotion_name

    def serialize(self):
        return {
            "diary_id": self.diary_id,
            "user_id": self.user_id,
            "date": self.date.strftime('%Y-%m-%d'),
            "title": self.title,
            "content": self.content,
            "emotion": self.emotion_name 
        }





class Emotion(db.Model):
    __tablename__ = 'emotions'
    emotion_id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)

    def __init__(self, name):
        self.name = name

    def serialize(self):
        return {
            "emotion_id": self.emotion_id,
            "name": self.name
        }

class Music(db.Model):
    __tablename__ = 'musics'
    music_id = db.Column(db.BigInteger, primary_key=True)
    diary_id = db.Column(db.BigInteger, db.ForeignKey('diaries.diary_id'), nullable=False)
    artist = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(255), nullable=True)
    music_title = db.Column(db.String(255), nullable=False)


    diary = db.relationship('Diary', backref=db.backref('musics', lazy=True))

    def __init__(self, music_data):
        self.diary_id = music_data.get('diary_id')
        self.artist = music_data.get('artist')
        self.url = music_data.get('url')
        self.music_title = music_data.get('music_title')

    def serialize(self):
        return {
            "music_id": self.music_id,
            "diary_id": self.diary_id,
            "artist": self.artist,
            "url": self.url,
            "music_title": self.music_title
        }


def add_emotions_to_db():
    emotions = ["angry", "sad", "anxiety", "calm", "happy", "surprised"]

    for emotion_name in emotions:
        existing_emotion = Emotion.query.filter_by(name=emotion_name).first()
        if not existing_emotion:
            new_emotion = Emotion(name=emotion_name)
            db.session.add(new_emotion)

    db.session.commit()