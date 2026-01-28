# Architecture & Engineering Trade-offs

## 🏗️ Core Design Philosophy

Matchingo is designed to be **stateless**, **horizontally scalable**, and **secure by default**. Major architectural decisions were made to prioritize these goals while accepting specific trade-offs for velocity and complexity management.

---

## ⚠️ Known Risks & Trade-offs (The "Bad")

These are accepted engineering trade-offs, not bugs. They should be understood by any engineer operating this system.

### 1. Redis is the Single Point of Truth
*   **Context**: Redis stores room state, presence, and rate limits.
*   **Risk**: If Redis fails, the system falls back to in-memory state. In a multi-instance deployment, this causes **split-brain** (Instance A doesn't know about Instance B's users).
*   **Mitigation**: This is acceptable given the high SLA of managed Redis providers (Upstash/ElastiCache).
*   **Future Fix**: Implement Redis High Availability (HA) or Client-side Leader Election (complex).

### 2. Unbounded Memory Cache (`roomSnapshotCache`)
*   **Context**: An in-memory `Map` is used to cache room state to reduce Redis reads and survive Redis blips.
*   **Risk**: There is no eviction strategy (LRU/TTL). A long-running process with millions of unique room accesses could eventually hit **Out Of Memory (OOM)**.
*   **Mitigation**: Node.js GC handles small objects, but sustained growth is a risk.
*   **Future Fix**: Replace `Map` with `lru-cache` package or implement a TTL-based cleanup for the cache map.

### 3. File Validation is Extension-Based
*   **Context**: `ALLOWED_FILE_TYPES` regex checks extensions.
*   **Risk**: A user can rename `malware.exe` to `photo.png` and upload it.
*   **Mitigation**: Files are served from R2 with correctly set `Content-Type`, but a user downloading it might still be at risk if they execute it.
*   **Future Fix**: Implement "Magic Bytes" inspection (e.g., using `mmmagic` or `file-type`) to verify actual file content before upload.

---

## ✅ What is NOT a Problem

Common concerns that are actually correct design choices for this specific product:
*   **"Heavy Redis Usage"**: Standard for realtime/socket apps.
*   **"Polling Cleanup"**: A loose 30s interval is acceptable for this scale; precise timing isn't critical.
*   **"Guests not in DB"**: Feature, not bug. Privacy-first design.

---

## 🚀 Scalability Status
*   **Backend**: 🟢 **Stateless**. Ready for horizontal scaling (PM2/K8s).
*   **Storage**: 🟢 **R2 (S3)**. Infinite scale, no local disk dependency.
*   **Database**: 🟢 **MongoDB**. Used only for Auth (low write pressure).
