# Problem 6: Scoreboard Module Specification

> **Duration**: You should not spend more than 8 hours on this problem.
> Time estimation is for internship roles, if you are a software professional you should spend significantly less time.

## Overview

This document specifies the backend module for a real-time scoreboard system that displays the top 10 user scores with live updates.

## Requirements

1. Display top 10 users by score on a scoreboard
2. Live update of scoreboard when scores change
3. Users complete actions that increase their score
4. API endpoint to update scores upon action completion
5. Prevent unauthorized score manipulation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│   │   User A     │         │   User B     │         │   User C     │        │
│   │  (Browser)   │         │  (Browser)   │         │  (Browser)   │        │
│   └──────┬───────┘         └──────┬───────┘         └──────┬───────┘        │
│          │                        │                        │                 │
│          │ 1. Complete Action     │                        │                 │
│          │ 2. POST /scores        │                        │                 │
│          ▼                        │                        │                 │
│   ┌──────────────┐               │                        │                 │
│   │ Action Token │               │                        │                 │
│   │  (signed)    │               │                        │                 │
│   └──────┬───────┘               │                        │                 │
│          │                        │                        │                 │
└──────────┼────────────────────────┼────────────────────────┼─────────────────┘
           │                        │                        │
           │ HTTPS + JWT            │ WebSocket              │ WebSocket
           │                        │                        │
┌──────────▼────────────────────────▼────────────────────────▼─────────────────┐
│                              API GATEWAY                                     │
│                         (Rate Limiting, Auth)                                │
└──────────┬────────────────────────┬────────────────────────┬─────────────────┘
           │                        │                        │
┌──────────▼────────────────────────▼────────────────────────▼─────────────────┐
│                           APPLICATION SERVER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│   │  Auth Service   │    │  Score Service  │    │ WebSocket Hub   │         │
│   │                 │    │                 │    │                 │         │
│   │ • Verify JWT    │    │ • Validate      │    │ • Manage conns  │         │
│   │ • Verify Action │───▶│   action token  │───▶│ • Broadcast     │         │
│   │   Token         │    │ • Update score  │    │   updates       │         │
│   │                 │    │ • Get top 10    │    │                 │         │
│   └─────────────────┘    └────────┬────────┘    └────────┬────────┘         │
│                                   │                      │                   │
└───────────────────────────────────┼──────────────────────┼───────────────────┘
                                    │                      │
┌───────────────────────────────────▼──────────────────────┼───────────────────┐
│                            DATA LAYER                    │                   │
├──────────────────────────────────────────────────────────┼───────────────────┤
│                                                          │                   │
│   ┌─────────────────┐         ┌─────────────────┐       │                   │
│   │    Database     │         │      Redis      │◀──────┘                   │
│   │   (PostgreSQL)  │◀───────▶│     Cache       │                           │
│   │                 │         │                 │                           │
│   │ • users         │         │ • Top 10 cache  │                           │
│   │ • scores        │         │ • Pub/Sub       │                           │
│   │ • action_logs   │         │ • Rate limits   │                           │
│   └─────────────────┘         └─────────────────┘                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow of Execution

### 1. Action Token Generation Flow

Before a user can submit a score update, they must obtain a signed action token from the server. This ensures the server knows about the action before it's completed.

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│ Client │     │   API   │     │   Auth   │     │  Action │
│        │     │ Gateway │     │ Service  │     │ Service │
└───┬────┘     └────┬────┘     └────┬─────┘     └────┬────┘
    │               │               │                │
    │ 1. User starts action         │                │
    │    (e.g., clicks "Start Task")│                │
    │               │               │                │
    │ 2. POST /actions/start        │                │
    │   (JWT + actionType)          │                │
    │──────────────▶│               │                │
    │               │               │                │
    │               │ 3. Verify JWT │                │
    │               │──────────────▶│                │
    │               │               │                │
    │               │ 4. JWT Valid  │                │
    │               │◀──────────────│                │
    │               │               │                │
    │               │ 5. Generate Token              │
    │               │───────────────────────────────▶│
    │               │               │                │
    │               │               │  6. Create signed token
    │               │               │     with actionId, nonce,
    │               │               │     timestamp, expiry
    │               │               │                │
    │               │ 7. Return ActionToken          │
    │               │◀───────────────────────────────│
    │               │               │                │
    │ 8. ActionToken                │                │
    │◀──────────────│               │                │
    │               │               │                │
    │ 9. User completes action      │                │
    │    (client-side)              │                │
    │               │               │                │
```

### 2. Score Update Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐     ┌───────────┐
│ Client │     │   API   │     │   Auth   │     │  Score  │     │ WebSocket │
│        │     │ Gateway │     │ Service  │     │ Service │     │    Hub    │
└───┬────┘     └────┬────┘     └────┬─────┘     └────┬────┘     └─────┬─────┘
    │               │               │                │                 │
    │ 1. POST /scores               │                │                 │
    │   (JWT + ActionToken)         │                │                 │
    │──────────────▶│               │                │                 │
    │               │               │                │                 │
    │               │ 2. Verify JWT │                │                 │
    │               │──────────────▶│                │                 │
    │               │               │                │                 │
    │               │ 3. JWT Valid  │                │                 │
    │               │◀──────────────│                │                 │
    │               │               │                │                 │
    │               │ 4. Process Score Update        │                 │
    │               │───────────────────────────────▶│                 │
    │               │               │                │                 │
    │               │               │ 5. Verify      │                 │
    │               │               │    ActionToken │                 │
    │               │               │◀───────────────│                 │
    │               │               │                │                 │
    │               │               │ 6. Token Valid │                 │
    │               │               │───────────────▶│                 │
    │               │               │                │                 │
    │               │               │                │ 7. Atomic Update
    │               │               │                │    (INCREMENT)  │
    │               │               │                │─────┐           │
    │               │               │                │     │           │
    │               │               │                │◀────┘           │
    │               │               │                │                 │
    │               │               │                │ 8. Conditional  │
    │               │               │                │    Broadcast    │
    │               │               │                │    (if top 10   │
    │               │               │                │     affected)   │
    │               │               │                │───────────────▶ │
    │               │               │                │                 │
    │ 9. Success Response           │                │                 │
    │◀──────────────│               │                │                 │
    │               │               │                │                 │
```

### 3. Live Update Flow (WebSocket with Ticket-Based Auth)

To avoid security issues with JWT in query strings (logged in server logs, browser history), we use a short-lived ticket exchanged for WebSocket authentication:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     Client      │      │   API Server    │      │      Redis      │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │ 1. POST /ws/ticket     │                        │
         │    (JWT in header)     │                        │
         │───────────────────────▶│                        │
         │                        │                        │
         │                        │ 2. Generate ticket     │
         │                        │    (UUID, 30s TTL)     │
         │                        │───────────────────────▶│
         │                        │                        │
         │ 3. Return ticket       │                        │
         │◀───────────────────────│                        │
         │                        │                        │
```

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   All Clients   │      │  WebSocket Hub  │      │      Redis      │
│   (Subscribed)  │      │                 │      │    (Pub/Sub)    │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │ 1. Connect WebSocket   │                        │
         │    /ws/scores          │                        │
         │───────────────────────▶│                        │
         │                        │                        │
         │ 2. Send AUTH message   │                        │
         │    { ticket: "..." }   │                        │
         │───────────────────────▶│                        │
         │                        │                        │
         │                        │ 3. Validate & consume  │
         │                        │    ticket (one-time)   │
         │                        │───────────────────────▶│
         │                        │                        │
         │                        │ 4. Return userId       │
         │                        │◀───────────────────────│
         │                        │                        │
         │ 5. AUTH_SUCCESS        │                        │
         │◀───────────────────────│                        │
         │                        │                        │
         │                        │ 6. Subscribe to        │
         │                        │    scoreboard channel  │
         │                        │───────────────────────▶│
         │                        │                        │
         │                        │      (Score Updated)   │
         │                        │                        │
         │                        │ 7. Receive update      │
         │                        │◀───────────────────────│
         │                        │                        │
         │ 8. Broadcast new       │                        │
         │    top 10 to all       │                        │
         │◀───────────────────────│                        │
         │                        │                        │
```

---

## API Specification

### Endpoints

#### `POST /api/v1/actions/start`

Request an action token before starting a scoreable action. The server issues a signed token that must be submitted when the action is completed.

**Headers:**
```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Request Body:**
```json
{
  "actionType": "complete_task",
  "metadata": {
    "taskId": "task_456"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "actionToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired JWT
- `429 Too Many Requests` - Rate limit exceeded (max 20 actions/minute)

**Notes:**
- Tokens expire after 5 minutes
- Each token can only be used once
- Server tracks issued tokens to prevent forgery

---

#### `POST /api/v1/scores`

Update user score after completing an action.

**Headers:**
```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Request Body:**
```json
{
  "actionToken": "eyJhbGciOiJIUzI1NiIs...",
  "actionType": "complete_task"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "newScore": 1500,
    "rank": 5
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired JWT
- `403 Forbidden` - Invalid action token (replay attack or tampered)
- `429 Too Many Requests` - Rate limit exceeded

---

#### `GET /api/v1/scores/top`

Get current top 10 scores.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "scores": [
      { "rank": 1, "userId": "user_456", "username": "alice", "score": 5000 },
      { "rank": 2, "userId": "user_789", "username": "bob", "score": 4500 },
      ...
    ],
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### `POST /api/v1/ws/ticket`

Obtain a short-lived ticket for WebSocket authentication. This avoids passing JWTs in query strings.

**Headers:**
```
Authorization: Bearer <JWT>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "ticket": "ws_ticket_abc123...",
    "expiresIn": 30
  }
}
```

**Notes:**
- Ticket is single-use and expires in 30 seconds
- Stored in Redis with TTL for validation

---

#### `WebSocket /ws/scores`

Real-time score updates with ticket-based authentication.

**Connection:**
```
wss://api.example.com/ws/scores
```

**Client Authentication Message (send immediately after connect):**
```json
{
  "type": "AUTH",
  "ticket": "ws_ticket_abc123..."
}
```

**Server Authentication Response:**
```json
{
  "type": "AUTH_SUCCESS",
  "userId": "user_123"
}
```

**Server Message (Score Update):**
```json
{
  "type": "SCOREBOARD_UPDATE",
  "data": {
    "scores": [...],
    "updatedAt": "2024-01-15T10:30:05Z"
  }
}
```

**Server Message (Delta Update - optimization):**
```json
{
  "type": "SCOREBOARD_DELTA",
  "data": {
    "changed": [
      { "rank": 5, "userId": "user_123", "username": "alice", "score": 1500, "delta": 100 }
    ],
    "updatedAt": "2024-01-15T10:30:05Z"
  }
}
```

**Error Messages:**
```json
{
  "type": "AUTH_FAILED",
  "reason": "Invalid or expired ticket"
}
```

---

## Security Design

### 1. Action Token System

To prevent unauthorized score increases, the server issues signed action tokens when users start actions. Clients cannot forge tokens because they don't have the signing secret.

**Token Lifecycle:**
1. User starts an action → Client calls `POST /actions/start`
2. Server generates token with unique actionId, stores in DB
3. User completes action → Client submits token to `POST /scores`
4. Server validates signature, checks token unused, consumes it atomically

```
┌─────────────────────────────────────────────────────────────┐
│                     ACTION TOKEN (JWT)                      │
├─────────────────────────────────────────────────────────────┤
│ Header: { "alg": "HS256", "typ": "JWT" }                    │
│                                                             │
│ Payload: {                                                  │
│   "userId": "user_123",                                     │
│   "actionId": "uuid-v4",        // Unique, stored in DB     │
│   "actionType": "complete_task",                            │
│   "scoreValue": 10,             // Points for this action   │
│   "iat": 1705312200,            // Issued at                │
│   "exp": 1705312500             // Expires (5 min window)   │
│ }                                                           │
│                                                             │
│ Signature: HMAC-SHA256(header + payload, SERVER_SECRET)     │
└─────────────────────────────────────────────────────────────┘
```

**Token Validation (in POST /scores):**
1. Verify HMAC signature using server secret (reject forged tokens)
2. Check `exp` claim not passed (reject expired tokens)
3. Validate `userId` matches JWT user (reject stolen tokens)
4. Atomically mark token as used in DB (reject replay attacks)
   - `UPDATE action_tokens SET used_at = NOW() WHERE action_id = ? AND used_at IS NULL`
   - If no rows affected → token already used

**Why server-issued tokens?**
- Score values are server-controlled (clients can't claim arbitrary points)
- Server tracks all pending actions (enables analytics, fraud detection)
- Tokens are cryptographically bound to the user who started the action

### 2. Rate Limiting

| Endpoint | Limit | Window | Enforcement |
|----------|-------|--------|-------------|
| POST /actions/start | 20 requests | per minute | Redis counter |
| POST /scores | 10 requests | per minute | Redis counter |
| GET /scores/top | 60 requests | per minute | Redis counter |
| POST /ws/ticket | 5 requests | per minute | Redis counter |
| WebSocket | 1 connection | per user | Redis set (see caching strategy) |

**Sliding Window Implementation:**

```javascript
async function checkRateLimit(userId, endpoint, limit, windowSec) {
  const key = `ratelimit:${userId}:${endpoint}`;
  const now = Date.now();
  const windowStart = now - (windowSec * 1000);

  // Remove old entries, add current, count total
  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart);
  pipe.zadd(key, now, `${now}-${Math.random()}`);
  pipe.zcard(key);
  pipe.expire(key, windowSec);

  const results = await pipe.exec();
  const count = results[2][1];

  return count <= limit;
}
```

### 3. Additional Security Measures

- **JWT Expiration**: Short-lived tokens (15 min) with refresh tokens
- **Request Signing**: Optional HMAC signature on request body
- **IP Monitoring**: Flag suspicious patterns (multiple users, same IP)
- **Audit Logging**: Log all score changes for investigation

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  score INT DEFAULT 0 CHECK (score >= 0),  -- INT sufficient for 2.1B max
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX idx_users_score ON users(score DESC);

-- Action tokens issued by server (tracks pending actions)
CREATE TABLE action_tokens (
  action_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  score_value INT NOT NULL CHECK (score_value > 0),
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,  -- NULL until consumed
  CONSTRAINT action_tokens_expiry CHECK (expires_at > issued_at)
);

-- Index for cleanup of expired tokens
CREATE INDEX idx_action_tokens_expires ON action_tokens (expires_at) WHERE used_at IS NULL;

-- Score history for auditing (partitioned by month)
CREATE TABLE score_logs (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  action_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  score_delta INT NOT NULL CHECK (score_delta > 0),  -- Only positive increments
  score_before INT NOT NULL CHECK (score_before >= 0),
  score_after INT NOT NULL CHECK (score_after >= 0),
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at),
  CONSTRAINT score_logs_action_unique UNIQUE (action_id, created_at)  -- Idempotency at DB level
) PARTITION BY RANGE (created_at);

-- Partition management with pg_partman (recommended)
-- Install: CREATE EXTENSION pg_partman;
-- SELECT partman.create_parent('public.score_logs', 'created_at', 'native', 'monthly');
-- SELECT partman.run_maintenance();  -- Run via pg_cron daily

-- Manual partition example (if not using pg_partman)
CREATE TABLE score_logs_y2024m01 PARTITION OF score_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes for common queries
CREATE INDEX idx_score_logs_user ON score_logs (user_id, created_at DESC);
CREATE INDEX idx_score_logs_action ON score_logs (action_id);
```

### Atomic Score Update

To prevent race conditions when multiple requests update the same user's score concurrently, always use atomic operations:

```sql
-- CORRECT: Atomic increment with returning clause
UPDATE users
SET score = score + $delta,
    updated_at = NOW()
WHERE id = $userId
RETURNING score;

-- This ensures concurrent updates are serialized and no increments are lost
-- Two simultaneous +10 updates will correctly result in +20
```

**Transaction for Score Update:**
```sql
BEGIN;

-- 1. Validate and consume action token atomically
UPDATE action_tokens
SET used_at = NOW()
WHERE action_id = $actionId
  AND user_id = $userId
  AND used_at IS NULL
  AND expires_at > NOW()
RETURNING score_value;

-- If no rows returned, token is invalid/used/expired → ROLLBACK

-- 2. Atomic score update
UPDATE users
SET score = score + $scoreValue,
    updated_at = NOW()
WHERE id = $userId
RETURNING score;

-- 3. Insert audit log
INSERT INTO score_logs (id, user_id, action_id, action_type, score_delta, score_before, score_after, ip_address)
VALUES ($logId, $userId, $actionId, $actionType, $scoreValue, $oldScore, $newScore, $ipAddress);

COMMIT;
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    REDIS CACHE                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Key: "scoreboard:top10"                                │
│  Type: Sorted Set (ZSET)                                │
│  TTL: None (updated on score change)                    │
│  Operations: ZADD, ZREVRANGE, ZSCORE                    │
│                                                         │
│  Key: "scoreboard:threshold"                            │
│  Type: String (INT)                                     │
│  Value: Score of rank #10 (for quick comparison)        │
│  TTL: None (updated with top10)                         │
│                                                         │
│  Key: "ws:ticket:{ticketId}"                            │
│  Type: Hash { userId, createdAt }                       │
│  TTL: 30 seconds (single-use auth ticket)               │
│                                                         │
│  Key: "ws:user:{userId}"                                │
│  Type: String (connection count)                        │
│  TTL: None (cleaned on disconnect)                      │
│  Purpose: Enforce 1 connection per user                 │
│                                                         │
│  Key: "ratelimit:{userId}:{endpoint}"                   │
│  Type: Counter (with sliding window)                    │
│  TTL: 1 minute                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Smart Cache Invalidation

Only broadcast updates when the top 10 is actually affected:

```javascript
async function updateScoreAndBroadcast(userId, newScore) {
  // 1. Get current threshold (score of rank #10)
  const threshold = await redis.get('scoreboard:threshold') || 0;

  // 2. Check if user is currently in top 10
  const currentRank = await redis.zrevrank('scoreboard:top10', userId);
  const userInTop10 = currentRank !== null && currentRank < 10;

  // 3. Update the sorted set
  await redis.zadd('scoreboard:top10', newScore, userId);

  // 4. Determine if broadcast is needed
  const shouldBroadcast = userInTop10 || newScore > threshold;

  if (shouldBroadcast) {
    // 5. Get fresh top 10 and update threshold
    const top10 = await redis.zrevrange('scoreboard:top10', 0, 9, 'WITHSCORES');
    const newThreshold = top10.length >= 10 ? top10[9].score : 0;
    await redis.set('scoreboard:threshold', newThreshold);

    // 6. Broadcast to subscribers (debounced - see below)
    await queueBroadcast(top10);
  }
}
```

### Rate Limit Enforcement

WebSocket connection limiting per user:

```javascript
async function onWebSocketConnect(userId, socket) {
  const key = `ws:user:${userId}`;

  // Atomic check-and-set
  const currentCount = await redis.incr(key);

  if (currentCount > 1) {
    // User already has a connection
    await redis.decr(key);
    socket.close(4001, 'Only one connection per user allowed');
    return;
  }

  // Set up cleanup on disconnect
  socket.on('close', async () => {
    await redis.decr(key);
    const count = await redis.get(key);
    if (count <= 0) {
      await redis.del(key);
    }
  });
}
```

---

## Log Storage Strategy

### Default: PostgreSQL with Partitioning

For moderate scale (<10K writes/sec), partitioned PostgreSQL works well:

- **Time-based partitions**: Monthly partitions for efficient range queries
- **Retention**: Drop partitions older than 90 days (instant vs slow DELETE)
- **Archival**: Export to S3/Parquet before dropping for compliance

### At Scale: MongoDB for Logs

For high-volume logging (>10K writes/sec), separate log storage:

| Component | Storage | Rationale |
|-----------|---------|-----------|
| Users & Scores | PostgreSQL | ACID, joins, leaderboard queries |
| Audit Logs | MongoDB | Write-optimized, flexible schema, Node.js native |

**Why separate storage:**
- Log writes don't impact leaderboard read performance
- Independent scaling (logs grow faster than user data)
- Different query patterns (time-series vs point lookups)

**MongoDB collection schema:**
```javascript
// score_logs collection
{
  _id: ObjectId,
  userId: UUID,
  actionId: UUID,          // unique index for deduplication
  actionType: String,
  scoreDelta: Number,
  scoreBefore: Number,
  scoreAfter: Number,
  ipAddress: String,
  createdAt: ISODate       // TTL index for auto-expiration
}

// Indexes
db.score_logs.createIndex({ actionId: 1 }, { unique: true })
db.score_logs.createIndex({ userId: 1, createdAt: -1 })
db.score_logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL
```

**Why MongoDB:**
- Native TTL indexes (automatic expiration, no cron jobs)
- Flexible schema for adding fields without migrations
- Mongoose/native driver familiar to Node.js teams
- Replica sets for high availability
- Sharding by userId for horizontal scaling

### Retention Policy

| Data | Hot Storage | Archive | Delete |
|------|-------------|---------|--------|
| Score logs | 90 days | S3 (1 year) | After 1 year |
| User data | Forever | Daily backups | On account deletion |

---

## Performance & Scale Requirements

### Target Scale

| Metric | Target | Notes |
|--------|--------|-------|
| **Concurrent users** | 100,000 | Peak during events |
| **WebSocket connections** | 50,000 | ~50% of users view leaderboard |
| **Score updates** | 1,000/sec | Burst during peak activity |
| **Daily active users** | 500,000 | Total user base ~2M |

### Latency Requirements

| Operation | P50 | P99 | Max |
|-----------|-----|-----|-----|
| POST /scores | 50ms | 200ms | 500ms |
| GET /scores/top | 10ms | 50ms | 100ms |
| WebSocket broadcast | 100ms | 500ms | 1s |

### Throughput

- **Read:Write ratio**: 100:1 (leaderboard views vs score updates)
- **Cache hit rate**: >99% for top 10 queries
- **WebSocket message rate**: Max 1 broadcast/second (debounced)

### Scaling Strategy

```
                    ┌─────────────────────────────────────┐
                    │           Load Balancer             │
                    │    (nginx/ALB - sticky sessions     │
                    │     for WebSocket connections)      │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
      │  API Server  │    │  API Server  │    │  API Server  │
      │   (Node.js)  │    │   (Node.js)  │    │   (Node.js)  │
      └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌──────────────┐         ┌──────────────────────────┐
            │    Redis     │         │       PgBouncer          │
            │   Cluster    │         │   (Connection Pooler)    │
            │  (3 nodes)   │         └────────────┬─────────────┘
            └──────────────┘                      │
                                     ┌────────────┴────────────┐
                                     │                         │
                                     ▼                         ▼
                              ┌──────────────┐         ┌──────────────┐
                              │  PostgreSQL  │         │  PostgreSQL  │
                              │   Primary    │────────▶│   Replica    │
                              │              │  sync   │  (read-only) │
                              └──────────────┘         └──────────────┘
                                     │
                              ┌──────┴──────┐
                              │   Patroni   │
                              │  (failover) │
                              └─────────────┘
```

**Horizontal scaling:**
- API servers: Stateless, scale based on CPU/request count
- WebSocket: Use Redis adapter (socket.io-redis) for cross-server broadcasting
- Database: Read replicas for GET queries, primary for writes
- Redis: Cluster mode for high availability

### High Availability & Failover

**PostgreSQL HA Stack:**

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **PgBouncer** | Connection pooling | Pool mode: transaction, max 100 connections per server |
| **Patroni** | Automatic failover | Consensus via etcd/Consul, 30s failover time |
| **Streaming Replication** | Data redundancy | Synchronous for zero data loss (or async for lower latency) |

**Failover Behavior:**
1. Patroni detects primary failure (health check timeout)
2. Replica promoted to primary automatically
3. PgBouncer redirects connections to new primary
4. Application reconnects transparently (brief ~30s disruption)

**Connection Pooling Configuration (PgBouncer):**
```ini
[databases]
scoreboard = host=pg-primary port=5432 dbname=scoreboard

[pgbouncer]
pool_mode = transaction          ; Release connection after each transaction
max_client_conn = 1000           ; Max connections from app servers
default_pool_size = 25           ; Connections per database
reserve_pool_size = 5            ; Extra connections for burst
reserve_pool_timeout = 3         ; Seconds before using reserve pool
```

**Why PgBouncer is essential:**
- Node.js apps create many short-lived connections
- PostgreSQL handles ~100-300 concurrent connections efficiently
- 100K concurrent users × 3 API servers = potential connection exhaustion
- PgBouncer multiplexes thousands of app connections to ~100 DB connections

### Bottleneck Analysis

| Component | Bottleneck | Mitigation |
|-----------|------------|------------|
| Database writes | Single primary | Batch writes, async processing |
| WebSocket fanout | Memory per connection | Limit connections per server, add nodes |
| Redis sorted set | O(log N) per update | Acceptable at 1M users |
| Leaderboard queries | DB load | Cache in Redis, 99%+ hit rate |

---

## Improvement Suggestions

### 1. Eventual Consistency with Event Sourcing
Instead of direct DB updates, use an event queue (Kafka/RabbitMQ) for score updates. This provides:
- Better audit trail
- Ability to replay/recalculate scores
- Horizontal scaling of score processing

### 2. Anti-Cheat Enhancements
- **Server-side action validation**: Don't just trust the client completed an action
- **Behavioral analysis**: ML model to detect abnormal scoring patterns
- **Periodic reconciliation**: Compare client-reported actions with server logs

### 3. Scalability Improvements
- **Sharded leaderboards**: For millions of users, partition by score ranges
- **Approximate rankings**: Use probabilistic data structures (HyperLogLog) for "your rank is approximately X"
- **CDN for static data**: Cache top 10 at edge for read-heavy loads

### 4. Monitoring & Observability
- Metrics: Score update latency, WebSocket connection count, cache hit rate
- Alerts: Unusual score spikes, high error rates, token validation failures
- Dashboards: Real-time leaderboard health, user activity patterns
