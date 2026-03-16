from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import openai
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai.api_key = os.getenv("VITE_OPENAI_API_KEY")

class ChatRequest(BaseModel):
    messages: list

@app.get("/api/students")
def get_students():
    try:
        df = pd.read_csv("students.csv")
        # Convert NaN to None for JSON serialization
        df = df.where(pd.notnull(df), None)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/insights")
def get_insights():
    try:
        df = pd.read_csv("students.csv")
        total_students = len(df)
        overdue_count = len(df[df["status"] == "overdue"])
        partial_count = len(df[df["status"] == "partial"])
        paid_count = len(df[df["status"] == "paid"])
        total_receivables = int(df["balance"].sum())
        
        return {
            "total_students": total_students,
            "overdue_count": overdue_count,
            "partial_count": partial_count,
            "paid_count": paid_count,
            "total_receivables": total_receivables
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not openai.api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on the server")
        
    try:
        # Load data to inject deterministic counts
        df = pd.read_csv("students.csv")
        total_count = len(df)
        overdue_count = len(df[df['status'] == 'overdue'])
        partial_count = len(df[df['status'] == 'partial'])
        paid_count = len(df[df['status'] == 'paid'])
        
        # We inject the DB summary dynamically on the backend
        system_prompt = f"""
You are BursarBot, a professional AI Assistant for the San Jose State University (SJSU) Office of the Bursar.
You have access to a student financial database.

DATABASE SUMMARY (authoritative — always use these exact numbers for counts):
- Total students: {total_count}
- Overdue: {overdue_count}
- Partial balance: {partial_count}
- Paid / settled: {paid_count}

Rules:
1. You identify yourself as BursarBot.
2. You provide accurate data based ONLY on the student list provided below.
3. When asked for a COUNT (overdue / partial / paid / total), use the DATABASE SUMMARY numbers above. Do NOT recount the JSON.
4. If asked about a specific Student ID (e.g. #1005), provide their specific details.
5. If the user asks you to "Draft a reminder email" for a student, provide a professional, empathetic email draft addressed to the student.
   - Mention their name, ID, category of balance (e.g. Tuition), and the amount.
   - Include a clear subject line.
   - Do NOT use placeholders like [Your Name]; sign off as SJSU Bursar Office.
6. If the data is not in the list, state that you don't have that record.
7. Maintain a helpful and professional tone.
8. Respond in Markdown.

STUDENT DATABASE (JSON dump derived from Pandas CSV):
{df.to_json(orient="records", indent=2)}
"""
        
        # Prepend system prompt to user messages
        messages = [{"role": "system", "content": system_prompt}] + request.messages
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )
        
        return {"reply": response.choices[0].message.content}
        
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
