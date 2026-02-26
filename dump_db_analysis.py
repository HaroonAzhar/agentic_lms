from sqlmodel import Session, select
from backend.app.database import engine
from backend.app.models import Topic, KeyConcept, Occurrence, Resource

def dump_data():
    with Session(engine) as session:
        print("="*60)
        print("FULL DATABASE DUMP: ANALYSIS DATA")
        print("="*60)

        # Topics
        topics = session.exec(select(Topic)).all()
        print(f"\n--- TOPICS ({len(topics)}) ---")
        for t in topics:
            print(f"ID: {t.id} | Name: {t.name} | Outline: {t.outline}")

        # Occurrences
        occurrences = session.exec(select(Occurrence)).all()
        print(f"\n--- OCCURRENCES ({len(occurrences)}) ---")
        for o in occurrences:
             # Try to get resource title for context if possible
             res = session.get(Resource, o.resource_id)
             res_title = res.title if res else "Unknown"
             topic = session.get(Topic, o.topic_id)
             topic_name = topic.name if topic else "Unknown"
             print(f"ID: {o.id} | Resource: {o.resource_id} ({res_title}) | Topic: {o.topic_id} ({topic_name})")

        # Key Concepts
        concepts = session.exec(select(KeyConcept)).all()
        print(f"\n--- KEY CONCEPTS ({len(concepts)}) ---")
        for c in concepts:
            print(f"ID: {c.id} | Name: {c.name} | Occurrence ID: {c.occurrence_id} | Time: {c.timestamp_start}s")

if __name__ == "__main__":
    dump_data()
