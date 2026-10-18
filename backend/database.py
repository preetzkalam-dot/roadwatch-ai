
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username="postgres",
    password=os.getenv("ROADWATCH_DB_PASSWORD"),
    host="localhost",
    port=5432,
    database="roadwatch_db",
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()