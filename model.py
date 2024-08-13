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
    diary_id = db.Column(db.Integer, primary_key=True)  
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    content = db.Column(db.Text, nullable=False)
    title = db.Column(db.String(255), nullable=False)

    user = db.relationship('UserModel', backref=db.backref('diaries', lazy=True))

    def __init__(self, user_id, date, content, title):
        self.user_id = user_id
        self.date = date
        self.content = content
        self.title=title

    def serialize(self):
        return {
            "diary_id": self.diary_id,
            "user_id": self.user_id,
            "date": self.date.strftime('%Y-%m-%d'),
            "title": self.title, 
            "content": self.content
        }
