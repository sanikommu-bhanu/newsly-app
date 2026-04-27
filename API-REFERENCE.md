# 🔗 Newsly API Endpoints Reference

## Base URL

**Local Development:**
```
http://localhost:8000
```

**Production (After Deployment):**
```
https://newsly-api.onrender.com
```

**Interactive Docs:**
- Swagger UI: `{BASE_URL}/docs`
- ReDoc: `{BASE_URL}/redoc`

---

## Health & Metadata

### Health Check
```http
GET /health
```
**Response:** `{ "status": "ok", "service": "Newsly API", "version": "1.0.0" }`

### API Root
```http
GET /
```
**Response:** Links to documentation endpoints

---

## Authentication

### Sign Up
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Errors:**
- `409`: Email or username already exists
- `422`: Invalid input (email format, password length < 8)

---

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Errors:**
- `401`: Invalid email or password
- `422`: Missing email or password

---

## News Articles

### Get Articles (Paginated)
```http
GET /news?category=Technology&location=India&page=1&limit=20
Authorization: Bearer {token}  [Optional]
```

**Query Parameters:**
| Param | Type | Required | Default | Values |
|-------|------|----------|---------|--------|
| `category` | string | No | All | Technology, Business, World, Health, Sports, Entertainment, Politics |
| `location` | string | No | Global | India, US, UK, China, Europe, Middle East, Australia, Canada, Global |
| `q` | string | No | - | Any search query |
| `page` | integer | No | 1 | ≥ 1 |
| `limit` | integer | No | 20 | 1–50 |

**Response (200 OK):**
```json
{
  "total": 145,
  "page": 1,
  "limit": 20,
  "articles": [
    {
      "id": "a3f2c1d0e4b5...",
      "title": "India's ISRO Launches New Satellite",
      "description": "ISRO successfully placed a communication satellite...",
      "image_url": "https://ichef.bbci.co.uk/news/1024/...",
      "source": "BBC Technology",
      "published_at": "2025-04-27T10:30:00Z",
      "article_url": "https://www.bbc.com/news/technology-...",
      "category": "Technology",
      "region": "India",
      "summary": "India's ISRO launched a communication satellite...",
      "tone": "Positive",
      "bias": "Center",
      "emotional_words": ["achievement", "success", "breakthrough"]
    }
  ]
}
```

**Errors:**
- `422`: Invalid category or location

---

### Get Single Article
```http
GET /article/{article_id}
```

**Response (200 OK):**
```json
{
  "id": "a3f2c1d0e4b5...",
  "title": "India's ISRO Launches New Satellite",
  ... // Same article structure as above
}
```

**Errors:**
- `404`: Article not found (may have expired from cache)

---

### Force Cache Refresh (Admin)
```http
POST /news/refresh
```

**Response (200 OK):**
```json
{
  "message": "Cache refreshed.",
  "article_count": 150
}
```

---

## User Preferences

### Get Preferences
```http
GET /user/preferences
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "location": "India",
  "categories": ["Technology", "Business"],
  "email_alerts": false,
  "push_alerts": true,
  "digest_hour": "08:00",
  "legal_accepted": true
}
```

**Errors:**
- `401`: Missing or invalid token

---

### Save Preferences
```http
POST /user/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "location": "India",
  "categories": ["Technology", "Business"],
  "email_alerts": true,
  "push_alerts": false,
  "digest_hour": "08:00"
}
```

**Response (200 OK):**
```json
{
  "location": "India",
  "categories": ["Technology", "Business"],
  "email_alerts": true,
  "push_alerts": false,
  "digest_hour": "08:00",
  "legal_accepted": false
}
```

---

## Bookmarks

### List Bookmarks
```http
GET /user/bookmarks
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
[
  {
    "article_id": "a3f2c1d0e4b5...",
    "title": "India's ISRO Launches New Satellite",
    "article_url": "https://www.bbc.com/news/...",
    "source": "BBC Technology",
    "image_url": "https://...",
    "category": "Technology",
    "region": "India",
    "published_at": "2025-04-27T10:30:00Z"
  }
]
```

---

### Add/Update Bookmark
```http
POST /user/bookmarks
Authorization: Bearer {token}
Content-Type: application/json

{
  "article_id": "a3f2c1d0e4b5...",
  "title": "India's ISRO Launches New Satellite",
  "article_url": "https://www.bbc.com/news/...",
  "source": "BBC Technology",
  "image_url": "https://...",
  "category": "Technology",
  "region": "India",
  "published_at": "2025-04-27T10:30:00Z"
}
```

**Response (200 OK):**
```json
{
  "message": "Bookmark saved"
}
```

---

### Delete Bookmark
```http
DELETE /user/bookmarks/{article_id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "message": "Bookmark deleted"
}
```

**Errors:**
- `404`: Bookmark not found

---

## User Interactions (Analytics)

### Track Article Interaction
```http
POST /user/interactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "article_id": "a3f2c1d0e4b5...",
  "action": "read",
  "category": "Technology",
  "source": "BBC Technology"
}
```

**Action Values:** `read`, `share`, `bookmark`

**Response (200 OK):**
```json
{
  "message": "Interaction recorded"
}
```

---

## Admin

### Get Publisher Controls
```http
GET /admin/publishers
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
[
  {
    "id": "bbc-tech",
    "source": "BBC Technology",
    "is_blocked": false,
    "max_per_feed": 15
  }
]
```

---

### Upsert Publisher Control
```http
POST /admin/publishers
Authorization: Bearer {token}
Content-Type: application/json

{
  "source": "BBC Technology",
  "is_blocked": false,
  "max_per_feed": 15
}
```

**Response (200 OK):**
```json
{
  "message": "Publisher control updated"
}
```

---

### Get Takedown Requests
```http
GET /admin/takedowns
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
[
  {
    "id": "tk-001",
    "source": "BBC Technology",
    "article_url": "https://www.bbc.com/news/...",
    "reason": "Misinformation about COVID-19",
    "requester_email": "admin@newsly.com",
    "status": "pending",
    "created_at": "2025-04-27T10:30:00Z"
  }
]
```

---

### Create Takedown Request
```http
POST /admin/takedowns
Content-Type: application/json

{
  "source": "BBC Technology",
  "article_url": "https://www.bbc.com/news/...",
  "reason": "Misinformation about COVID-19",
  "requester_email": "user@example.com"
}
```

**Response (201 Created):**
```json
{
  "id": "tk-001",
  "message": "Takedown request created"
}
```

---

### Resolve Takedown Request
```http
POST /admin/takedowns/{takedown_id}/resolve
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "resolved"
}
```

**Response (200 OK):**
```json
{
  "message": "Takedown request resolved"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid request format"
}
```

### 401 Unauthorized
```json
{
  "detail": "Invalid or expired token.",
  "headers": { "WWW-Authenticate": "Bearer" }
}
```

### 404 Not Found
```json
{
  "detail": "Article 'a3f2c1d0e4b5' not found. It may have expired from the cache."
}
```

### 409 Conflict
```json
{
  "detail": "An account with this email already exists."
}
```

### 422 Unprocessable Entity
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Authentication

### Bearer Token Usage
Include the token in the `Authorization` header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiry
- Default: 60 minutes
- Request a new token by logging in again

---

## Rate Limiting

Currently no rate limiting implemented. Subject to change in future versions.

---

## Data Types

### Article Object
```typescript
interface Article {
  id: string
  title: string
  description: string | null
  image_url: string | null
  source: string
  published_at: string  // ISO 8601 format
  article_url: string
  category: string  // Technology, Business, World, etc.
  region: string    // India, US, UK, etc.
  summary: string | null      // AI-generated 2-3 sentence summary
  tone: string | null         // Positive, Neutral, Negative
  bias: string | null         // Center, Center-Left, etc.
  emotional_words: string[]   // ["hope", "crisis", "growth"]
}
```

### User Object
```typescript
interface User {
  id: string
  email: string
  username: string
  created_at: string  // ISO 8601 format
}
```

### Token Object
```typescript
interface Token {
  access_token: string
  token_type: "bearer"
}
```

---

## Examples

### Example: Full Login → Browse → Bookmark Flow

**1. Sign Up**
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "username": "alice",
    "password": "secure123"
  }'
# Returns: {"access_token": "...", "token_type": "bearer"}
```

**2. Save Preferences**
```bash
curl -X POST http://localhost:8000/user/preferences \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "location": "India",
    "categories": ["Technology", "Business"]
  }'
```

**3. Browse News**
```bash
curl "http://localhost:8000/news?category=Technology&location=India&limit=5" \
  -H "Authorization: Bearer eyJ..."
# Returns: {"total": 150, "page": 1, "limit": 5, "articles": [...]}
```

**4. Bookmark Article**
```bash
curl -X POST http://localhost:8000/user/bookmarks \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": "a3f2c1d0...",
    "title": "...",
    "article_url": "...",
    "source": "BBC Technology",
    "image_url": "...",
    "category": "Technology",
    "region": "India",
    "published_at": "2025-04-27T10:30:00Z"
  }'
```

**5. Track Reading**
```bash
curl -X POST http://localhost:8000/user/interactions \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": "a3f2c1d0...",
    "action": "read",
    "category": "Technology"
  }'
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK — Request succeeded |
| `201` | Created — Resource created |
| `400` | Bad Request — Invalid input |
| `401` | Unauthorized — Missing or invalid token |
| `404` | Not Found — Resource doesn't exist |
| `409` | Conflict — Resource already exists |
| `422` | Unprocessable Entity — Validation failed |
| `500` | Internal Server Error — Server error |

---

**Last Updated:** 2026-04-27
**API Version:** 1.0.0
