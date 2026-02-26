import sys
from sqlmodel import text, Session
from backend.app.database import engine

def run_query(sql_query: str):
    with Session(engine) as session:
        try:
            print(f"Executing: {sql_query}")
            result = session.exec(text(sql_query))
            
            # Check if returns rows
            if result.returns_rows:
                rows = result.all()
                if not rows:
                    print("No results found.")
                    return

                # Get keys (columns)
                keys = result.keys()
                print(f"Found {len(rows)} rows:")
                print(" | ".join(keys))
                print("-" * 50)
                for row in rows:
                    print(" | ".join(str(val) for val in row))
            else:
                session.commit()
                print("Query executed successfully (Rows updated/deleted/inserted).")
                
        except Exception as e:
            print(f"Error executing query: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python query_db.py '<SQL_QUERY>'")
        sys.exit(1)
    
    query = sys.argv[1]
    run_query(query)
