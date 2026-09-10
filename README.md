# Himantar: Dual-Twin Architecture for Antarctic Stations

**Smart India Hackathon 2026 | Team: VajraX | Problem Statement: Digital Platform for Efficient Remote Management of Indian Antarctic Research Stations**

Project **Himantar** is an offline-resilient, Edge-to-Cloud Digital Twin framework designed specifically for India's Antarctic research stations. It addresses the critical challenges of extreme polar isolation, strictly constrained **4 MHz satellite bandwidth**, and frequent connectivity blackouts.

---

## 🚀 Quick Links (For Judges)

* 🌍 **Live Deployment:** [HIMANTAR](https://sih-2026-two-xi.vercel.app/)
* 🎥 **Demo Video:** [DEMO VIDEO](https://youtu.be/9kXuhC71zNw)
* 📊 **Pitch Deck:** [CANVA](https://canva.link/z07c4ggxd0g6vb3)

---

## ⚠️ The Antarctic Problem

Monitoring **Maitri** and **Bharati** stations from **Goa HQ (NCPOR)** currently faces four critical bottlenecks:

1. **Bandwidth Starvation:** The shared 4 MHz satellite link degrades during extreme weather conditions.
2. **Dangerous Cloud Latency:** Relying solely on the cloud for fire and thermal alerts risks delayed emergency responses.
3. **Zero-Visibility Blackouts:** Vital incident telemetry can be permanently lost during frequent network outages.
4. **Blind Winter Logistics:** Unpredicted cold snaps can drain fuel reserves before the single annual ship resupply.

---

## 💡 The Himantar Solution

We built a **Decoupled Dual-Twin Architecture** that processes tactical, life-safety alarms locally on the ice while synchronizing highly compressed predictive intelligence with Goa HQ.

### 🔑 Core USPs

* 📡 **Payload Crushing (Protobuf + MQTT):**
  Bulky JSON telemetry is converted into compact binary **Protocol Buffers (Protobuf)** payloads. This significantly reduces bandwidth consumption and enables reliable communication over the constrained 4 MHz satellite network.

* ⚡ **Zero-Latency Edge AI:**
  The **Edge Twin** runs locally on station servers. It can instantly detect thermal spikes and trigger life-safety alarms without relying on cloud connectivity.

* 🔒 **10-Hour Crypto Black Box:**
  During satellite blackouts, an **Edge InfluxDB** instance queues telemetry data. Critical alerts trigger a **10-hour HMAC-signed telemetry lock**, providing HQ with a tamper-evident "flight recorder" for incident replay.

* 🔮 **Predictive Survival AI:**
  Cloud-based ML models correlate historical extreme-weather conditions with generator loads to forecast winter fuel consumption, helping optimize annual logistics and resupply planning.

---

## 🏗️ System Architecture

The system operates across three resilient layers:

### 1. Tier 1: Antarctic Edge

**IoT Sensor Array → Protobuf Serialization → Rugged Edge Server**

The Edge Server handles:

* Local AI inference
* Thermal anomaly detection
* Life-safety alerts
* Local telemetry storage
* Black-box incident recording

### 2. Tier 2: Data Pipeline

**MQTTS over TLS (Port 8883) → Constrained 4 MHz Satellite Link**

Telemetry is serialized using Protobuf and transmitted through a secure MQTT/TLS pipeline to minimize bandwidth usage while maintaining data integrity.

### 3. Tier 3: NCPOR Goa HQ

**Cloud Twin Aggregation → Predictive AI Server → Unified Spatial Dashboard**

The HQ layer aggregates station telemetry, runs predictive models, and provides a unified spatial view of the Antarctic stations.

---

## 💻 Tech Stack

| Category                | Technologies                         |
| ----------------------- | ------------------------------------ |
| **Frontend**            | React.js, Tailwind CSS, Mapbox GL    |
| **Backend & APIs**      | Node.js, Express.js, Python, FastAPI |
| **IoT & Data Pipeline** | MQTT, Mosquitto, Protocol Buffers    |
| **Database**            | InfluxDB, PostgreSQL                 |
| **AI/ML**               | Scikit-learn, TensorFlow             |
| **Security**            | HMAC SHA-256, mTLS                   |
| **Communication**       | MQTTS over TLS                       |

### Frontend

* React.js
* Tailwind CSS
* Mapbox GL
* Spatial Digital Twin Dashboard

### Backend

* Node.js
* Express.js
* Python
* FastAPI

### IoT & Data Pipeline

* MQTT
* Mosquitto
* Protocol Buffers (Protobuf)

### Databases

* InfluxDB — Time-series telemetry
* PostgreSQL — Metadata and application data

### AI/ML

* Scikit-learn
* TensorFlow
* Predictive thermal-load modeling

### Security

* HMAC SHA-256
* Mutual TLS (mTLS)

---

## ⚙️ How to Run Locally

### Prerequisites

Make sure the following are installed:

* [Node.js](https://nodejs.org/) **v18+**
* [Python](https://www.python.org/) **v3.9+**
* InfluxDB
* Mosquitto MQTT Broker

---

### 1. Clone the Repository

```bash
git clone https://github.com/YourUsername/Project-Himantar.git
cd Project-Himantar
```

---

### 2. Start the Backend

Open a terminal and run:

```bash
cd backend
python dev_server.py
```

---

### 3. Start the Frontend

Open a **new terminal** and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend should then be available at the local development URL shown in your terminal, typically:

```text
http://localhost:5173
```

---

## 🌐 Live Deployment

The latest deployed version of **Himantar** is available here:

**[HIMANTAR — Live Demo](https://sih-2026-two-xi.vercel.app/)**

---

## 🎯 Key Benefits

* **Offline-first architecture** for Antarctic connectivity blackouts
* **Edge-based emergency detection** for rapid life-safety response
* **Bandwidth-efficient telemetry** using Protobuf and MQTT
* **Secure telemetry transmission** using TLS and HMAC
* **Tamper-evident incident replay** through the cryptographic black box
* **Predictive fuel consumption modeling** for winter logistics
* **Unified digital twin dashboard** for remote station management
* **Scalable Edge-to-Cloud architecture** for future Antarctic deployments

---

## 🧊 Why Himantar?

Himantar bridges the gap between **extreme environments and modern digital infrastructure**.

By combining **Edge AI, Digital Twins, secure IoT communication, predictive analytics, and offline-resilient data pipelines**, Himantar enables NCPOR to maintain visibility and operational intelligence even when Antarctic stations are disconnected from the mainland.

---

## ❤️ Developed for SIH 2026

**Developed with ❤️ for Smart India Hackathon 2026 by Team VajraX.**

> **Bridging the ice with code.**
