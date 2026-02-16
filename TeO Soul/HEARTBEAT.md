# BoB Heartbeat Configuration for TeO Hub

This file defines the proactive behavior of the Moltbot Agent (System Heartbeat).
How it works: The agent checks this file at a specified interval (default 15-30 minutes) and executes tasks if the conditions are met.

## 💓 Heartbeat Loop (Interval: 15 min)

### 1. System Integrity Monitoring (System Health Check)
- **Condition**: Always on every heartbeat.
- **Action**: Run the audit script from `teo-foundry-worker`. - **Command**: `python skills/teo-foundry-worker/scripts/hub-audit.py`
- **Agent Reaction**:
- If the result contains "SYSTEM STATUS: STABLE":
- Take no action (silent mode) OR (optionally) send a short "OK" status once every 24 hours.
- If the result contains "NO_INFO" or "ERROR":
- **IMMEDIATE ALERT**: Send a message on WhatsApp/Telegram:

"🚨 **TeO Alert**: Irregularities detected in the Hub structure. [Report details...]. Proceed with the remediation procedure?"

### 2. Checking the Goorgo Plan
- **Condition**: If `skills/` is empty (which is unlikely after Step 2, but worth checking).
- **Action**: Report a critical configuration error.

### 3. Energy Management (Optional)
- **Condition**: Time > 10:00 PM.
- **Action**: Switch reporting to "Night" mode (critical errors only).

--
*Hot-reloadable configuration - changes to this file are read by the Pi Agent in real time.*