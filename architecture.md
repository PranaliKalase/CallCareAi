# 🏗️ CarePlus – System Architecture & Workflow

## 📌 System Architecture Overview
ResQPath follows a modular and scalable architecture with three main layers:

1. Frontend (User Interface)
2. Backend (API & Logic)
3. Database (Data Storage)

---

## 🧱 Architecture Diagram (Conceptual)

User (Patient / Hospital / Ambulance)
        ↓
Frontend (Web App - UI)
        ↓
Backend API (Node.js / Supabase)
        ↓
Database (PostgreSQL)
        ↓
Real-time Updates (WebSockets / Supabase Realtime)

---

## 🔧 Components

### 1. Frontend Layer
- Built using HTML, CSS, JavaScript (or React)
- Handles:
  - User interaction
  - Map visualization (Leaflet + OSM)
  - Dashboard UI
- Communicates with backend via APIs

---

### 2. Backend Layer
- Handles business logic
- API endpoints for:
  - Authentication
  - ICU availability updates
  - Ambulance booking
- Real-time updates using Supabase

---

### 3. Database Layer
- Stores:
  - User data
  - Hospital data
  - ICU bed availability
  - Ambulance status
- Managed using PostgreSQL

---

## 🔄 Workflow

### 🧑‍⚕️ Patient Flow
1. User logs in
2. Searches for nearby hospitals
3. Views ICU bed availability
4. Requests ICU bed or ambulance
5. Tracks ambulance in real time

---

### 🏥 Hospital Flow
1. Hospital logs in
2. Updates ICU bed availability
3. Receives patient requests
4. Accepts or rejects booking

---

### 🚑 Ambulance Flow
1. Driver logs in
2. Receives request notification
3. Accepts request
4. Shares live location
5. Updates trip status

---

### 🛠 Admin Flow
1. Admin logs in
2. Monitors system activity
3. Manages users
4. Views analytics and reports

---

## 📡 Real-Time Communication
- Used for:
  - ICU availability updates
  - Ambulance tracking
- Implemented via:
  - Supabase Realtime / WebSockets

---

## 🗺️ Map Workflow
1. Fetch hospital & ambulance data
2. Display markers on map (Leaflet)
3. Update positions in real time

---

## 🔐 Security
- Authentication via JWT / Supabase Auth
- Role-based access control
- Secure API endpoints

---

## ⚡ Scalability Considerations
- Modular design for easy upgrades
- Cloud-based backend (Supabase)
- Can handle multiple users simultaneously

---

## 📌 Summary
ResQPath uses a real-time, data-driven architecture to connect patients, hospitals, and ambulances efficiently. The system ensures fast communication, accurate data, and seamless emergency response.
