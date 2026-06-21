import os
from sqlmodel import create_engine, SQLModel, Session

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ticket_brief")

engine = create_engine(DATABASE_URL, echo=False)

def init_db():
    from sqlalchemy import text
    # Ensure vector extension is enabled
    with Session(engine) as session:
        session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        session.commit()
    # Create all missing tables (like users)
    SQLModel.metadata.create_all(engine)
    # Ensure user_id column exists on briefs table
    with Session(engine) as session:
        session.execute(text("ALTER TABLE briefs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);"))
        session.commit()

def get_session():
    with Session(engine) as session:
        yield session
