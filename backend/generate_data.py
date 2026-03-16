import pandas as pd
import random

# Generate the same 50 students data as the original JS implementation
def generate_data():
    names = ['Alex Spartan', 'Jordan Gold', 'Taylor Blue', 'Casey Grey', 'Sam Tower', 'Morgan Field', 'Riley West', 'Peyton East', 'Quinn North', 'Avery South']
    types = ['Tuition', 'Lab Fees', 'Housing', 'Health Insurance', 'Orientation']
    statuses = ['paid', 'overdue', 'partial']

    data = []
    for i in range(50):
        name = f"{names[i % len(names)]} {i + 1}"
        status = statuses[i % len(statuses)]
        balance = 0 if status == 'paid' else random.randint(100, 3100)
        fee_type = types[i % len(types)]
        
        data.append({
            "id": str(1000 + i),
            "name": name,
            "balance": balance,
            "type": fee_type,
            "status": status,
            "date": f"2024-03-{((i % 28) + 1):02d}"
        })

    df = pd.DataFrame(data)
    df.to_csv("students.csv", index=False)
    print("Generated students.csv with 50 records.")

if __name__ == "__main__":
    generate_data()
