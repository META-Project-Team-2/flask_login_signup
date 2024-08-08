from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class UserModel(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.BigInteger, primary_key=True)  
    nickname = db.Column(db.String(255), nullable=True)
    profile = db.Column(db.String(255), nullable=True)
    thumbnail = db.Column(db.String(255), nullable=True)

    def __init__(self, user_data):
        self.id = user_data.get('id')
        self.nickname = user_data.get('nickname')
        self.profile = user_data.get('profile')
        self.thumbnail = user_data.get('thumbnail')

    def serialize(self):
        return {
            "id": self.id,
            "nickname": self.nickname,
            "profile": self.profile,
            "thumbnail": self.thumbnail
        }

    @staticmethod
    def deserialize(user_data):
        return UserModel({
            "id": user_data.get('id', 0),  
            "nickname": user_data.get('nickname', ''),
            "profile": user_data.get('profile', ''),
            "thumbnail": user_data.get('thumbnail', '')
        })

    @staticmethod
    def upsert_user(user_data):
        user = UserModel.query.get(user_data.get('id'))
        if user:
            user.nickname = user_data.get('nickname')
            user.profile = user_data.get('profile')
            user.thumbnail = user_data.get('thumbnail')
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
    diary_id = db.Column(db.Integer, primary_key=True)  
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    content = db.Column(db.Text, nullable=False)

    user = db.relationship('UserModel', backref=db.backref('diaries', lazy=True))

    def __init__(self, user_id, date, content):
        self.user_id = user_id
        self.date = date
        self.content = content

    def serialize(self):
        return {
            "diary_id": self.diary_id,
            "user_id": self.user_id,
            "date": self.date.strftime('%Y-%m-%d'),
            "content": self.content
        }
