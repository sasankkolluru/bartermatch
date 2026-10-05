import os
import re
import sqlite3
import warnings
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
if DATABASE_URL.startswith("sqlite:///" ):
	configured_path = DATABASE_URL.removeprefix("sqlite:///")
	DB_PATH = str((BACKEND_DIR / configured_path).resolve()) if not Path(configured_path).is_absolute() else configured_path
else:
	DB_PATH = os.getenv("SQLITE_PATH", str(BACKEND_DIR / "bartermatch.db"))


class Record(dict):
	def __getitem__(self, key):
		if isinstance(key, int):
			return tuple(self.values())[key]
		return super().__getitem__(key)


class PostgresCursor:
	def __init__(self, cursor):
		self._cursor = cursor

	def fetchone(self):
		result = self._cursor.fetchone()
		return Record(result) if result is not None else None

	def fetchall(self):
		return [Record(result) for result in self._cursor.fetchall()]


class PostgresConnection:
	dialect = "postgres"

	def __init__(self, connection):
		self._connection = connection

	@staticmethod
	def _translate(sql):
		sql = re.sub(r"^\s*PRAGMA\s+.*?;?\s*$", "", sql, flags=re.IGNORECASE)
		if not sql:
			return sql
		ignore_insert = re.match(r"\s*INSERT\s+OR\s+IGNORE\s+INTO\b", sql, flags=re.IGNORECASE) is not None
		if ignore_insert:
			sql = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", sql, count=1, flags=re.IGNORECASE)
			sql = sql.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
		sql = sql.replace("?", "%s")
		sql = re.sub(r"\bMAX\(\s*0\s*,", "GREATEST(0,", sql, flags=re.IGNORECASE)
		sql = re.sub(r"\bMIN\(\s*100\s*,", "LEAST(100,", sql, flags=re.IGNORECASE)
		return sql

	def execute(self, sql, args=()):
		return PostgresCursor(self._connection.execute(self._translate(sql), args))

	def executescript(self, script):
		for statement in script.split(";"):
			if statement.strip():
				self.execute(statement)

	def commit(self):
		self._connection.commit()

	def rollback(self):
		self._connection.rollback()

	def close(self):
		self._connection.close()


class SQLiteConnection:
	dialect = "sqlite"

	def __init__(self, connection):
		self._connection = connection

	def execute(self, sql, args=()):
		return self._connection.execute(sql, args)

	def executescript(self, script):
		return self._connection.executescript(script)

	def commit(self):
		self._connection.commit()

	def rollback(self):
		self._connection.rollback()

	def close(self):
		self._connection.close()


def _sqlite_connection():
	Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
	connection = sqlite3.connect(DB_PATH)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	return SQLiteConnection(connection)


def get_connection():
	if USE_POSTGRES:
		try:
			import psycopg
			from psycopg.rows import dict_row

			connection = psycopg.connect(DATABASE_URL, row_factory=dict_row, prepare_threshold=None, connect_timeout=5)
			return PostgresConnection(connection)
		except Exception as error:
			warnings.warn(
				f"Supabase/PostgreSQL is unavailable ({type(error).__name__}); using local SQLite demo storage.",
				RuntimeWarning,
			)
	return _sqlite_connection()


@contextmanager
def session():
	connection = get_connection()
	try:
		yield connection
		connection.commit()
	except Exception:
		connection.rollback()
		raise
	finally:
		connection.close()