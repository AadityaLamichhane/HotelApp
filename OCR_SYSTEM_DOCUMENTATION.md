# Hotel SaaS OCR System Documentation

*Comprehensive visual documentation for the hotel SaaS application's OCR system*

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [OCR Processing Pipeline](#2-ocr-processing-pipeline)
3. [Configuration Requirements](#3-configuration-requirements)
4. [API Endpoint Details](#4-api-endpoint-details)
5. [Code Snippets](#5-code-snippets)
6. [Error Handling](#6-error-handling)
7. [Troubleshooting Guide](#7-troubleshooting-guide)
8. [Production Deployment Checklist](#8-production-deployment-checklist)

---

## 1. System Architecture Overview

The OCR system integrates with the hotel SaaS application to extract menu data from uploaded images. It operates as a **feature module** within the menu system, scoped to individual hotels.

```mermaid
graph TD
    subgraph "Client Layer"
        C1[Frontend/ mobile app]
        C2["User: captures menu photo"]
    end

    subgraph "API Gateway Layer"
        G1[Elysia HTTP Server]
        G2[Auth Middleware: JWT Verification]
        G3[Route Validation: Zod Schemas]
    end

    subgraph "OCR Service Layer"
        S1[Controller: scanMenuImage]
        S2[Service: scanMenuImage + getHotelOrFail]
        S3[OCR Engine: runOcr]
        S4[Image Decoder: decodeImage]
        S5[OCR Engines: Google Vision / Tesseract]
        S6[Menu Gate: checkMenuImage]
        S7[Text Parser: parseMenuText]
        S8[Item Classifier: classifyItemsWithJev]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL Database)]
        FS[File System: /uploads/]
    end

    style OCR fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style SERVICE fill:#fff3e0,stroke:#ef6c00,stroke-width:2px

    C1 -->|POST image| G1
    G1 -->|auth + validate| G2
    G2 -->|authorize| G3
    G3 -->|forward| S1
    S1 -->|hotelId + imageBase64| S2
    S2 -->|validate ownership| DB
    S2 -->|runOcr| S3
    S3 -->|decode| S4
    S3 -->|select engine| S5
    S5 -->|return text| S6
    S6 -->|gate check| S7
    S7 -->|parse| S8
    S8 -->|classified items| G1
    G1 -->|JSON response| C1

%% Style notes
classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000;
classDef storage fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000;


## 2. OCR Processing Pipeline

```mermaid
flowchart TD
    subgraph "Step-by-Step Pipeline"
        A[Receive Image Base64] --> B[Decode & Validate Size]
        B --> C[Select OCR Engine]
        C -->|API Key Set| D[Google Cloud Vision]
        C -->|No API Key| E[Tesseract.js (local)]
        D --> F[API Request to Google Vision]
        E --> G[Run Tesseract Recognition]
        F --> H[Parse Google Response]
        G --> I[Extract Text + Confidence]
        H --> I
        I --> J[Menu Gate Check]
        J -->|Not a menu!| K[Throw Validation Error]
        J -->|Is a menu!| L[Parse Menu Text]
        L --> J[Classify Items with Jev]
        J -->|Enrich| M[Add Categories + Veg Flags]
        M --> N[Return OcrResult]
    end

    style A fill:#bbdefb,stroke:#1e88e5,stroke-width:2px
    style K fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style N fill:#c8e6c9,stroke:#388e3c,stroke-width:2px

decision D{Has Google API Key?}
decision J{Menu Gate Pass?}

    D -.->|Yes| C
    D -.->|No| E
    J -.->|false| K
    J -.->|true| L
```

### Pipeline Decision Points

| Step | Decision | Outcome |
|------|----------|---------|
| **Engine Selection** | `GOOGLE_VISION_API_KEY` set? | `✅` Google Vision → better accuracy on real photos<br>`❌` Tesseract.js → local, no cost, decent accuracy |
| **Menu Gate** | `checkMenuImage` result | `✅` Pass → proceed to text parsing<br>`❌` Fail → throw error "This doesn't look like a menu photo" |
| **Jev Enrichment** | `TYPESAFE_API_KEY` set? | `✅` enrich with canonical categories + veg detection<br>`❌` return OCR results as-is |

### Detailed Step Descriptions

1. **Receive Image Base64** – POST body `imageBase64` (required, min 1 char)
2. **Decode & Validate Size** – Buffer conversion, max 8MB limit
3. **Select OCR Engine** – Check `env.GOOGLE_VISION_API_KEY`
4. **Run OCR** – Either Google Vision API or Tesseract.js recognition
5. **Menu Gate Check** – Jev `checkMenuImage` to validate it's a menu
6. **Parse Menu Text** – Extract structured items, prices, categories
7. **Classify with Jev** – Optional TypeSafe AI enrichment
8. **Return Result** – `OcrResult` with text, confidence, engine, items, gate
## 3. Configuration Requirements

### Environment Variables

```env
# REQUIRED (fail fast if missing)
API_KEY=your_api_key_here
JWT_SECRET=super_secret_jwt_signing_key
DATABASE_URL=postgresql://user:pass@localhost:5432/hotel_db

# OCR-SPECIFIC
GOOGLE_VISION_API_KEY=your_google_cloud_vision_key  # Optional
TYPESAFE_API_KEY=your_typesafe_ai_key  # Optional (for Jev enrichment)
JEV_MODEL=jev-latest  # Optional, defaults to "jev-latest"

# Optional Configuration
GOOGLE_CLIENT_IDS=comma,separated,ids  # For OAuth sign-in
APP_NAME=HotelManagement
MODE=development  # or "production"
PORT=9000
TIMEZONE=Asia/Kathmandu
```

### Google Cloud Vision Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Vision API**
3. Create an API key (or service account key)
4. Add the key to `GOOGLE_VISION_API_KEY`
5. Recommended language hints: `"ne", "en", "hi"` (Nepali + English + Hindi)

### TypeSafe AI (Jev) Setup — Optional

1. Register at [typesafe.ai](https://typesafe.ai/)
2. Obtain API key
3. Add to `TYPESAFE_API_KEY`
4. Model defaults to `jev-latest` via `JEV_MODEL` env var

### Configuration Validation

```typescript
// src/config/env.ts - Fail fast on required keys
const required = ["API_KEY", "JWT_SECRET", "DATABASE_URL"]
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] WARNING: ${key} is missing. Copy .env.example -> .env`)
  }
}
```

### Default Behaviors Without Config

| Config | Without Value | Behavior |
|--------|--------------|----------|
| `GOOGLE_VISION_API_KEY` | Not set | Falls back to Tesseract.js (local, no cost) |
| `TYPESAFE_API_KEY` | Not set | OCR results without Jev enrichment |
| `GOOGLE_CLIENT_IDS` | Empty string | Google OAuth disabled (endpoints return 503) |
```
## 4. API Endpoint Details

### OCR Scan Endpoint

```http
POST /api/hotels/:id/menu/ocr
```

#### Request Schema (Zod Validation)

```typescript
export const ocrMenuValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),  // UUID string from path
  body: z.object({
    imageBase64: z.string().min(1, "imageBase64 is required"),
    language: z.string().max(10).optional(),  // e.g., "eng+nep", "eng"
  }),
})
```

#### Request Example

```bash
curl -X POST "http://localhost:9000/api/hotels/123e4567-ec93-12d3-91c6-426614174000/menu/ocr" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEBIVFRUVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zMiTanNyD8zAQDQxKyQsNygtLfAqHy8vLy8vLfAqKS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAcAAEAAwEBAQEAAAAAAAAAAAAABgcDAQEGAAj/xABCEAABAwMDAgQEBgUDBgMAAAABAAIDBBESITEFQVFhcRQjMlKBkaGxwdEUI0JSsdHwFSNTYnKCorLC/8QAGgEAAwEBAQEAAAAAAAAAAAAAAAECAwQFB//EACgRAAMBAQEBAQEAAAAAAAAAAAAAECESEyMUEHE//aAAwEBAQEBAQE/8QAGhEAAwEBAQAAAAAAAAAAAAAAAAECAyEx/9oADAMBAAIRAxEAPwCd6y8uX/W6l3xV+FeJrM9pVbR5RrEqRRyJ0aRfy9Xyn3FcVX/AAr3T3NQvtRFdW2uIcFcWSUAAHgE9qK8VZbW1sxNr7WorqS6g2qmpVgTUNaXU1bVm6yjtB5xW43dR06jJGRjGDjJxjGcVx9K8XWo6dpt1b3VdNt5rOeSWuLqNqN5ZJ5bBQ6LXGPmA4J60ZUu88U0tUoqXq9Va11dX defenses
```

#### Response Schema (200 OK)

```typescript
export interface OcrResult {
  text: string;              // Raw OCR text output
  confidence: number | null; // Overall confidence (null for Google Vision)
  engine: "google-vision" | "tesseract";  // Which engine was used
  items: OcrItem[];          // Parsed menu items
  gate: MenuGate;           // Gate check results
}

export interface OcrItem {
  name: string;              // Dish name
  price: number;             // Price in smallest currency unit
  category: string;          // Mapped category
  description: string | null; // Optional description
  confidence: number | null; // Per-item confidence
  isVeg: boolean | null;     // Vegetarian flag
}

export interface MenuGate {
  isMenu: boolean;          // Is this a menu photo?
  hasPrices: boolean;       // Are prices visible?
  box: { top: number; bottom: number; left: number; right: number } | null;  // Bounding box
  menuScore: number | null; // Confidence score (0-1)
  skipped: boolean;         // Was gate check skipped (no API key)?
}
```

#### Response Example (200 OK)

```json
{
  "text": "MOMO ITEMS\n1. Veg Momo - NPR 150\n2. Chicken Momo - NPR 180\nThali - NPR 350\n\nSOUP ITEMS\nTomato Soup - NPR 120",
  "confidence": null,
  "engine": "tesseract",
  "items": [
    {
      "name": "Veg Momo",
      "price": 150,
      "category": "Momo & Dumplings",
      "description": null,
      "confidence": 0.94,
      "isVeg": true
    },
    {
      "name": "Chicken Momo",
      "price": 180,
      "category": "Momo & Dumplings",
      "description": null,
      "confidence": 0.89,
      "isVeg": false
    }
  ],
  "gate": {
    "isMenu": true,
    "hasPrices": true,
    "box": { "top": 15, "bottom": 280, "left": 20, "right": 300 },
    "menuScore": 0.97,
    "skipped": true
  }
}
```

#### Error Response Examples

| Status | Code | Message | When |
|--------|------|---------|------|
| 400 | `VALIDATION_ERROR` | `imageBase64 is required` | Missing or empty image |
| 400 | `VALIDATION_ERROR` | `Invalid image data` | Buffer too large (>8MB) or corrupt |
| 400 | `VALIDATION_ERROR` | `This doesn't look like a menu photo` | Menu gate failed |
| 401 | `UNAUTHORIZED_ERROR` | `Login required` | Missing/invalid JWT |
| 403 | `FORBIDDEN_ERROR` | `Access denied for this hotel` | User doesn't own hotel |
| 503 | `SERVICE_UNAVAILABLE` | `Google Vision is not configured` | No API key + Tesseract unavailable |
```
## 5. Code Snippets

### 5.1 OCR Core Function

```typescript
// src/modules/menu/ocr.ts - runOcr (main entry point)

export const runOcr = async (
  imageBase64: string,
  language = "eng+nep"
): Promise<OcrResult> => {
  const buffer = decodeImage(imageBase64)  // Step 1: decode + validate
  const apiKey = (env as Record<string, string>).GOOGLE_VISION_API_KEY as string | undefined
  let engine: OcrResult["engine"]
  let raw: { text: string; confidence: number | null }

  // Step 2: Engine selection
  if (apiKey) {
    engine = "google-vision"
    raw = await runGoogleVision(buffer)  // Cloud API call
  } else {
    engine = "tesseract"
    raw = await runTesseract(buffer, language)  // Local execution
  }

  // Step 3: Menu gate check (never blocks - fail open)
  const gate = await checkMenuImage(imageBase64)
  if (gate.isMenu === false) {
    throw throwErrorOnValidation("This doesn't look like a menu photo")
  }

  // Step 4: Parse and classify
  const parsed = parseMenuText(raw.text)
  const items = await classifyItemsWithJev(parsed)

  return {
    text: raw.text,
    confidence: raw.confidence,
    engine,
    items,
    gate,
  }
}
```

### 5.2 Image Decode Helper

```typescript
// src/modules/menu/ocr.ts - decodeImage

const MAX_IMAGE_BYTES = 8 * 1024 * 1024  // 8MB limit

const decodeImage = (imageBase64: string): Buffer => {
  const clean = imageBase64.includes(",")
    ? imageBase64.split(",").pop()!
    : imageBase64
  const buffer = Buffer.from(clean, "base64")

  if (buffer.length === 0) throw throwErrorOnValidation("Invalid image data")
  if (buffer.length > MAX_IMAGE_BYTES)
    throw throwErrorOnValidation("Image is too large (max 8MB)")

  return buffer
}
```

### 5.3 Google Vision Engine

```typescript
// src/modules/menu/ocr.ts - runGoogleVision

const runGoogleVision = async (buffer: Buffer): Promise<{ text: string; confidence: number | null }> => {
  const apiKey = (env as Record<string, string>).GOOGLE_VISION_API_KEY as string | undefined
  if (!apiKey) throw throwServiceUnavailableError("Google Vision is not configured")

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: buffer.toString("base64") },
            // "ne" = Nepali (Devanagari) + "en" for mixed menus
            // DOCUMENT_TEXT_DETECTION auto-detects all languages
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["ne", "en", "hi"] },
          },
        ],
      }),
    }
  )

  const json = (await res.json()) as {
    responses?: Array<{ textAnnotations?: Array<{ description: string }>; error?: unknown }>
    error?: { message?: string }
  }

  if (!res.ok || json.error) {
    throw throwServiceUnavailableError(`Google Vision failed: ${json.error?.message ?? res.statusText}`)
  }

  const text = json.responses?.[0]?.textAnnotations?.[0]?.description ?? ""
  return { text, confidence: null }  // Google doesn't return per-image confidence
}
```

### 5.4 Tesseract Engine

```typescript
// src/modules/menu/ocr.ts - runTesseract

const runTesseract = async (buffer: Buffer, language: string): Promise<{ text: string; confidence: number | null }> => {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker(language)

  try {
    const { data } = await worker.recognize(buffer)
    return { text: data.text ?? "", confidence: data.confidence ?? null }
  } finally {
    await worker.terminate()
  }
}
```

### 5.5 Controller Integration

```typescript
// src/modules/menu/controller.ts - scanMenuImage

const scanMenuImage = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {}
  return Service.scanMenuImage(req.user, String(hotelId), req.body.imageBase64, req.body.language)
}
```

### 5.6 Service Layer (ownership + OCR call)

```typescript
// src/modules/menu/service.ts - scanMenuImage

const scanMenuImage = async (viewer: Viewer, hotelId: string, imageBase64: string, language?: string) => {
  const hotel = await getHotelOrFail(String(hotelId))
  requireHotelAccess(viewer, hotel)
  return runOcr(imageBase64, language || "eng")
}
```
## 6. Error Handling

### Error Contract

All deliberate failures throw `AppError` with `ERROR_CODES` key. The **only** serializer is `src/middlewares/errorHandler.ts`:

```typescript
// Error shape serialized to client:
{
  success: false,
  error: "<CODE>",        // e.g., "VALIDATION_ERROR", "UNAUTHORIZED_ERROR"
  message: "<user-safe copy>",  // Human-readable, no internal prefixes
  details?: unknown       // Optional dev-only information
}
```

### Error Codes Reference

| Code | HTTP | Meaning | Example Message |
|------|------|---------|-----------------|
| `VALIDATION_ERROR` | 400 | Input validation failed | "imageBase64 is required" |
| `UNAUTHORIZED_ERROR` | 401 | Missing/invalid JWT | "Login required" |
| `FORBIDDEN_ERROR` | 403 | Access denied (not owner, not admin) | "Access denied for this hotel" |
| `NOT_FOUND_ERROR` | 404 | Resource not found | "Hotel" |
| `SERVICE_UNAVAILABLE` | 503 | External service misconfigured | "Google Vision is not configured" |
| `ERROR_ON_VALIDATION` | 400 | General validation failure | "Failed to create menu item" |

### Error Handling Flow

```mermaid
flowchart TD
    A[Route Handler] -->|throws AppError| B[Elysia Error Handler]
    B -->|serializes| C[{ success: false, error: "CODE", message: "User-safe text" }]
    C -->|returns to client| D[Frontend Display]

    style A fill:#e3f2fd,stroke:#1565c0
    style B fill:#fff3e0,stroke:#ef6c00
    style C fill:#e8f5e9,stroke:#2e7d32
```

### Never Do These

❌ **Never add internal prefixes** like `UNAUTHORIZED:` or `NOT_FOUND:` in messages  
❌ **Never put raw provider text** from Google Vision or TypeSafe in user messages  
❌ **Never return bare throws** without `throw` keyword (fails TypeScript `noEmit`)  
❌ **Never add failure response shapes** anywhere else than the error handler
```
## 7. Troubleshooting Guide

### Common Problems & Solutions

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| **400: "imageBase64 is required"** | Empty body or missing field | Ensure `imageBase64` key present in POST body; base64 string must not be empty |
| **400: "Invalid image data"** | Corrupt base64 or >8MB | Verify base64 is valid; compress image or reduce resolution if >8MB |
| **400: "This doesn't look like a menu photo"** | Image not detected as menu | • Ensure image shows clear menu text<br>• Good lighting, flat lay photography<br>• Avoid handwritten notes or non-menu text |
| **503: "Google Vision is not configured"** | No API key + using Google engine | Either: (1) Set `GOOGLE_VISION_API_KEY`, or (2) System will auto-fall back to Tesseract |
| **OCR text garbled/incorrect** | Poor image quality | • Use high-resolution photos (min 1200px width)<br>• Ensure text is horizontal/rotated < 15°<br>• Good contrast between text and background |
| **Items not classifying to correct categories** | Jev enrichment disabled | Set `TYPESAFE_API_KEY` and `JEV_MODEL` env vars, or configure manually |
| **Confidence always null** | Using Google Vision engine | Google Vision `DOCUMENT_TEXT_DETECTION` doesn't return image-level confidence; use Tesseract for confidence scores |
| **Devanagari/Nepali text not recognized** | Wrong language hint | Set `language` parameter to `"eng+nep"` or `"ne+hi"` in the request |
| **OCR timeout / worker crash** | Tesseract worker memory | Tesseract workers are terminated after each use; ensure Node memory >= 256MB for bulk operations |

### Diagnostic Commands

```bash
# 1. Check if env vars are loaded
bun -e "import('./src/config/env').then(m => console.log(m.default))"

# 2. Test OCR with Tesseract (no API key needed)
bun src/modules/menu/ocr.test.ts  # Run the test suite

# 3. Verify Google Vision connectivity
curl -X POST "https://vision.googleapis.com/v1/images:annotate?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"image":{"content":""},"features":[{"type":"DOCUMENT_TEXT_DETECTION"}]}]}'

# 4. Check current engine being used
# Response field "engine" will show "google-vision" or "tesseract"
```

### Logs to Check

- **Application logs**: `pino` formatted, look for `[ocr]` prefixed entries
- **Google Vision errors**: API response `error.message` in server logs
- **Tesseract warnings**: stdout/stderr from worker termination
- **Database errors**: Connection pool issues, FK violations on hotel scoping
```
## 8. Production Deployment Checklist

### Pre-Deployment

- [ ] **Set `GOOGLE_VISION_API_KEY`** in production `.env` (or leave empty for Tesseract)
- [ ] **Set `TYPESAFE_API_KEY`** if Jev enrichment desired
- [ ] **Configure `JWT_SECRET`** with strong random value
- [ ] **Set `DATABASE_URL`** to production PostgreSQL
- [ ] **Set `APP_NAME`**, `MODE=production`, correct `PORT`
- [ ] **Run `bun run db:push`** to apply schema changes
- [ ] **Seed first admin** if not already done

### OCR-Specific Checks

- [ ] **Google Vision**: Test API key validity with a sample image
- [ ] **Tesseract**: Verify Node environment has `tesseract.js` binary available
- [ ] **Language support**: Confirm `eng+nep` works for your menu languages
- [ ] **Image size limit**: Ensure 8MB max is appropriate for your use case
- [ ] **Menu gate**: Test with actual menu photos to validate `checkMenuImage` accuracy

### Security Checks

- [ ] **JWT validation**: Verify `checkAuthentication` middleware works
- [ ] **Hotel scoping**: Test that users can only OCR menus for their own hotel
- [ ] **Admin routes**: Verify `authCheckType: ["admin"]` protects cross-hotel endpoints
- [ ] **Rate limiting**: Ensure OCR endpoint isn't vulnerable to abuse (consider adding rate limit middleware)

### Monitoring & Logging

- [ ] **Structured logs**: Confirm OCR requests logged with `runOcr` entry point
- [ ] **Engine metrics**: Track ratio of `google-vision` vs `tesseract` usage
- [ ] **Error rates**: Monitor 503 errors for "Google Vision is not configured"
- [ ] **Response times**: OCR typically 2-5s; set appropriate timeouts
- [ ] **Fallback behavior**: Verify Tesseract gracefully takes over if Google fails

### Rollback Plan

- [ ] **Keep Tesseract as fallback**: Never removes local OCR capability
- [ ] **Document API key rotation**: Process for updating `GOOGLE_VISION_API_KEY`
- [ ] **Backup database**: Before `db:push` migrations that alter tables
- [ ] **Feature flag**: Consider adding env var to force engine selection if needed

### Post-Deployment Validation

```bash
# 1. Test basic OCR flow
curl -X POST "http://your-domain.com/api/hotels/<uuid>/menu/ocr" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<base64_image>"}'

# 2. Verify response structure
# Must contain: text, confidence, engine, items[], gate{}

# 3. Test both engines
# Without GOOGLE_VISION_API_KEY → should use "tesseract"
# With valid key → should use "google-vision"

# 4. Test error cases
# Missing image → 400 VALIDATION_ERROR
# Wrong hotel → 403 FORBIDDEN_ERROR
# Non-menu image → 400 VALIDATION_ERROR
```
```

---

*Documentation generated for hotel SaaS OCR system. Includes system architecture, OCR processing pipeline, configuration requirements, API endpoints, code snippets, error handling, troubleshooting guide, and production deployment checklist.*
