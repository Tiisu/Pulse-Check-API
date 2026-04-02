# 🫀 Pulse-Check-API

A **Dead Man's Switch API** for monitoring remote device heartbeats. Built for CritMon Servers Inc. to track solar farms and unmanned weather stations in areas with poor connectivity.

Devices register a monitor with a countdown timer. If a device fails to send a heartbeat before the timer expires, the system automatically fires an alert — no human checking required.

---

## Architecture

### High-Level System Architecture

The system follows a **layered architecture** with strict separation of concerns. Each layer only communicates with its immediate neighbor.

```mermaid
graph TB
    subgraph Clients ["🌐 Client Layer"]
        DEV["IoT Device<br/>(Heartbeat Sender)"]
        ADMIN["Admin / Dashboard<br/>(Monitor Management)"]
    end

    subgraph API ["⚡ API Gateway Layer"]
        EXP["Express.js Server<br/>───────────────<br/>• JSON body parsing<br/>• Request logging<br/>• Route dispatch<br/>• 404 handling"]
    end

    subgraph Routes ["🛣️ Routing Layer"]
        MR["Monitor Router<br/>───────────────<br/>POST /monitors<br/>POST /monitors/:id/heartbeat<br/>POST /monitors/:id/pause<br/>GET  /monitors<br/>GET  /monitors/:id<br/>DELETE /monitors/:id"]
    end

    subgraph Business ["🧠 Business Logic Layer"]
        MC["Monitor Controller<br/>───────────────<br/>• Input validation<br/>• Request/Response mapping<br/>• Error responses<br/>• Response formatting"]
    end

    subgraph Services ["⚙️ Service Layer"]
        TS["Timer Service<br/>───────────────<br/>• setTimeout management<br/>• Countdown tracking<br/>• Remaining time calc<br/>• Alert triggering"]
    end

    subgraph Data ["💾 Data Layer"]
        MS["Monitor Store<br/>───────────────<br/>• In-Memory Map<br/>• CRUD operations<br/>• State management"]
    end

    DEV -->|"HTTP Requests"| EXP
    ADMIN -->|"HTTP Requests"| EXP
    EXP --> MR
    MR --> MC
    MC --> TS
    MC --> MS
    TS -->|"onTimerExpired()"| MS
    TS -.->|"🚨 ALERT"| ALERT["Alert Output"]
```

### Request Lifecycle — Sequence Diagram

Covers all flows including error paths (validation failures, 404s, 409 conflicts).

```mermaid
sequenceDiagram
    actor D as 📡 Device
    actor A as 👤 Admin
    participant S as Express Server
    participant C as Controller
    participant TS as Timer Service
    participant MS as Monitor Store

    rect rgb(22, 33, 62)
        Note over D, MS: ① REGISTER — POST /monitors
        D->>S: POST /monitors<br/>{"id":"device-123","timeout":60,"alert_email":"admin@critmon.com"}
        S->>C: createMonitor(req, res)
        C->>C: ✅ Validate: id, timeout > 0, alert_email
        alt Validation fails
            C-->>D: 400 Bad Request
        else ID already exists
            C->>MS: exists(id)
            MS-->>C: true
            C-->>D: 409 Conflict
        else Valid request
            C->>MS: create(id, 60, "admin@critmon.com")
            MS-->>C: { id, status: "active", timeout: 60, ... }
            C->>TS: startTimer("device-123", 60)
            TS->>TS: setTimeout(onTimerExpired, 60000ms)
            C-->>D: 201 Created + monitor object
        end
    end

    rect rgb(15, 52, 96)
        Note over D, MS: ② HEARTBEAT — POST /monitors/:id/heartbeat
        D->>S: POST /monitors/device-123/heartbeat
        S->>C: heartbeat(req, res)
        C->>MS: get("device-123")
        alt Monitor not found
            MS-->>C: undefined
            C-->>D: 404 Not Found
        else Monitor exists (active, paused, or down)
            MS-->>C: monitor object
            C->>MS: update(id, { status: "active", lastHeartbeat: now })
            C->>TS: startTimer("device-123", 60)
            TS->>TS: clearTimeout(existing)
            TS->>TS: setTimeout(onTimerExpired, 60000ms)
            C-->>D: 200 OK + updated monitor
        end
    end

    rect rgb(233, 69, 96)
        Note over D, MS: ③ TIMER EXPIRY — Automatic Alert
        TS->>TS: ⏰ 60 seconds elapsed — no heartbeat
        TS->>MS: update("device-123", { status: "down" })
        TS->>TS: 🚨 console.log({ ALERT: "Device device-123 is down!", ... })
        Note right of TS: Timer references cleaned up.<br/>Monitor persists in "down" state.
    end

    rect rgb(22, 33, 62)
        Note over A, MS: ④ PAUSE — POST /monitors/:id/pause
        A->>S: POST /monitors/device-123/pause
        S->>C: pause(req, res)
        C->>MS: get("device-123")
        alt Already paused
            C-->>A: 400 Bad Request
        else Active monitor
            C->>TS: clearTimer("device-123")
            TS->>TS: clearTimeout + remove metadata
            C->>MS: update(id, { status: "paused" })
            C-->>A: 200 OK — "Send heartbeat to resume"
        end
    end

    rect rgb(15, 52, 96)
        Note over D, MS: ⑤ RESUME — Heartbeat after pause/down
        D->>S: POST /monitors/device-123/heartbeat
        S->>C: heartbeat(req, res)
        C->>MS: update(id, { status: "active", lastHeartbeat: now })
        C->>TS: startTimer("device-123", 60)
        TS->>TS: New setTimeout(onTimerExpired, 60000ms)
        C-->>D: 200 OK — Monitor resumed
    end
```

### Monitor State Machine

Every monitor transitions through three states. A heartbeat can recover a device from any state.

```mermaid
stateDiagram-v2
    [*] --> Active: POST /monitors<br/>(register + start timer)

    state Active {
        [*] --> Counting
        Counting --> Counting: heartbeat received<br/>(timer resets to full duration)
    }

    Active --> Paused: POST /pause<br/>(timer cleared)
    Active --> Down: ⏰ Timer expires<br/>(alert fired)

    Paused --> Active: POST /heartbeat<br/>(timer restarted)

    Down --> Active: POST /heartbeat<br/>(recovery — timer restarted)

    Active --> Destroyed: DELETE /monitors/:id
    Paused --> Destroyed: DELETE /monitors/:id
    Down --> Destroyed: DELETE /monitors/:id

    Destroyed --> [*]

    note right of Active
        Timer is running.
        Device is healthy.
        Remaining time tracked.
    end note

    note right of Paused
        No timer running.
        No alerts will fire.
        Maintenance mode.
    end note

    note left of Down
        Timer expired.
        Alert was fired.
        Awaiting recovery heartbeat.
    end note
```

---

## Project Structure

```
Pulse-Check-API/
├── src/
│   ├── server.js               
│   ├── routes/
│   │   └── monitors.js         
│   ├── controllers/
│   │   └── monitorController.js
│   ├── services/
│   │   └── timerService.js     
│   └── store/
│       └── monitorStore.js     
├── package.json
├── .gitignore
└── README.md
```
