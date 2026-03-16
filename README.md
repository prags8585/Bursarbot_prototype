# BursarBot (v1) - SJSU AI Administrative Portal 🛡️🤖

**BursarBot** is a secure, full-stack AI administrative orchestrator prototype designed specifically for the San José State University (SJSU) Office of the Bursar. It demonstrates how Large Language Models (LLMs) can securely interface with institutional financial databases to automate student outreach, handle NLP-based account inquiries, and provide predictive financial analytics.

This is **Version 1**, which evolves the prototype from a purely front-end application to a robust **FastAPI (Python) + React (JavaScript)** full-stack architecture.

---

## 🌟 Key Features

1. **AI Inquiry (NLP):** Administrators can chat with BursarBot (powered by GPT-4o-mini) to query specific student records, ask about university-wide financial trends, and automatically draft professional, empathetic reminder emails.
2. **Secure Architecture:** The OpenAI API key and LLM prompting logic are securely isolated on the Python backend. The React frontend never exposes sensitive API keys to the browser.
3. **Automated Outreach Dashboard:** A responsive data table that displays student records, fee categories (Tuition, Housing, etc.), and balance statuses, complete with real-time UI filtering.
4. **Data Governance & PII Masking:** A togglable security layer that automatically redacts Personally Identifiable Information (PII) like Student Names and IDs from the UI to maintain FERPA compliance.
5. **Financial Insights Analytics:** An analytics dashboard that aggregates active receivables, overdue metrics, and collection velocities using Pandas in the backend.

---

## 💻 Tech Stack

### Frontend (User Interface)
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Vanilla CSS + modern Glassmorphism & UI/UX design patterns
- **HTTP Client:** Axios (for communicating with the backend API)
- **Icons:** Lucide React

### Backend (API & AI Logic)
- **Framework:** FastAPI (Python 3)
- **Server:** Uvicorn
- **AI Integration:** OpenAI Python SDK (`gpt-4o-mini`)
- **Data Processing:** Pandas (reads and aggregates student data from CSV)
- **Environment Management:** `python-dotenv`

---

## 🚀 How to Run Locally

### 1. Backend Setup (FastAPI)
The backend requires Python and your OpenAI API key.

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd bursarbot-sjsu2/backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install fastapi uvicorn pandas openai pydantic python-dotenv
   ```
4. Create a `.env` file in the `backend/` directory and add your key:
   ```env
   VITE_OPENAI_API_KEY=sk-proj-...
   ```
5. *(Optional)* Generate default student data:
   ```bash
   python generate_data.py
   ```
6. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will be running at `http://localhost:8000`. You can view the API documentation at `http://localhost:8000/docs`.*

### 2. Frontend Setup (React/Vite)
The frontend requires Node.js.

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd bursarbot-sjsu2/frontend
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev -- --port 5174
   ```
   *The frontend will be running at `http://localhost:5174`.*

---

## 🏗️ Architecture Overview

Unlike v1, which handled all AI prompts directly in the browser, v2 routes all data securely:

1. **Data:** `students.csv` acts as the simulated institutional database.
2. **Endpoints:**
   - `GET /api/students`: Returns raw student data for the React data table.
   - `GET /api/insights`: Uses Pandas to calculate aggregate financials (totals, overdue counts).
   - `POST /api/chat`: Receives natural language queries from React. The backend securely injects the database state into the `SYSTEM_PROMPT` and queries OpenAI, returning the text response.

## 🤝 Authors
Prototype developed for DATA 228 / SJSU Big Data ecosystem research.
