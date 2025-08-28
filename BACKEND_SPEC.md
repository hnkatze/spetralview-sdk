# 🚀 Backend API Specification - SpectraView

## 📋 Resumen
Backend para recibir, almacenar y servir sesiones de grabación de SpectraView. Maneja eventos en tiempo real, almacenamiento optimizado y reproducción de sesiones.

## 🏗️ Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    SDK      │────▶│   API        │────▶│  PostgreSQL │
│  (Browser)  │     │  (Fastify)   │     │   + Redis   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Visualizer  │
                    │   (React)    │
                    └──────────────┘
```

## 📡 API Endpoints

### 1. **Session Management**

#### `POST /api/sessions/start`
Inicia una nueva sesión de grabación.

**Request:**
```json
{
  "sessionId": "uuid-v4",
  "userId": "user-123",
  "appId": "yalo-pos",
  "startTime": 1234567890,
  "metadata": {
    "url": "https://app.example.com",
    "referrer": "https://google.com",
    "userAgent": "Mozilla/5.0...",
    "screen": {
      "width": 1920,
      "height": 1080,
      "colorDepth": 24
    },
    "viewport": {
      "width": 1200,
      "height": 800
    },
    "language": "es-MX",
    "platform": "Win32"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid-v4",
  "message": "Session started"
}
```

#### `POST /api/sessions/:sessionId/events`
Recibe batch de eventos de una sesión.

**Request:**
```json
{
  "sessionId": "uuid-v4",
  "userId": "user-123",
  "appId": "yalo-pos",
  "events": {
    "compressed": true,
    "data": "base64_compressed_data" // o array si no está comprimido
  },
  "customEvents": [
    {
      "type": "custom",
      "eventType": "checkout_started",
      "data": { "value": 99.99 },
      "timestamp": 1234567890
    }
  ],
  "errors": [
    {
      "type": "javascript_error",
      "message": "Cannot read property...",
      "stack": "...",
      "timestamp": 1234567890
    }
  ],
  "metadata": {
    "timestamp": 1234567890,
    "eventCount": 50,
    "customEventCount": 5,
    "errorCount": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "received": {
    "events": 50,
    "customEvents": 5,
    "errors": 1
  }
}
```

#### `POST /api/sessions/:sessionId/heartbeat`
Mantiene la sesión activa.

**Request:**
```json
{
  "timestamp": 1234567890,
  "stats": {
    "eventCount": 150,
    "errorCount": 2,
    "clickCount": 45
  }
}
```

#### `POST /api/sessions/:sessionId/end`
Finaliza una sesión.

**Request:**
```json
{
  "endTime": 1234567890,
  "stats": {
    "eventCount": 500,
    "errorCount": 5,
    "clickCount": 120
  }
}
```

### 2. **Replay & Analytics**

#### `GET /api/sessions/:sessionId`
Obtiene información de una sesión.

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "userId": "user-123",
  "appId": "yalo-pos",
  "startTime": 1234567890,
  "endTime": 1234567999,
  "duration": 109,
  "stats": {
    "totalEvents": 500,
    "errors": 5,
    "clicks": 120
  },
  "metadata": {
    "url": "https://app.example.com",
    "userAgent": "...",
    "viewport": { "width": 1200, "height": 800 }
  }
}
```

#### `GET /api/sessions/:sessionId/replay`
Obtiene todos los eventos para reproducción.

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "events": [
    {
      "type": 2,
      "data": { /* rrweb fullsnapshot */ },
      "timestamp": 1234567890
    },
    {
      "type": 3,
      "data": { /* rrweb incremental */ },
      "timestamp": 1234567891
    }
  ],
  "customEvents": [...],
  "errors": [...]
}
```

#### `GET /api/sessions`
Lista sesiones con filtros.

**Query Parameters:**
- `appId`: Filtrar por aplicación
- `userId`: Filtrar por usuario
- `from`: Fecha inicio (ISO 8601)
- `to`: Fecha fin (ISO 8601)
- `hasErrors`: Boolean
- `limit`: Número de resultados (default: 50)
- `offset`: Paginación

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "userId": "user-123",
      "appId": "yalo-pos",
      "startTime": 1234567890,
      "duration": 120,
      "errorCount": 2,
      "eventCount": 450
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### 3. **WebSocket (Opcional)**

#### `WS /api/sessions/:sessionId/live`
Stream en tiempo real de eventos.

```javascript
// Cliente
ws.send(JSON.stringify({ type: 'subscribe', sessionId: 'uuid' }));

// Servidor envía eventos mientras ocurren
ws.on('message', (data) => {
  const event = JSON.parse(data);
  // Reproducir evento en tiempo real
});
```

## 💾 Esquema de Base de Datos

### PostgreSQL Schema

```sql
-- Sesiones principales
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(100),
  ticket_id VARCHAR(100),
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Stats
  event_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  
  -- TTL
  ttl_hours INTEGER DEFAULT 72,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '72 hours',
  
  -- Índices
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_sessions_app_user ON sessions(app_id, user_id);
CREATE INDEX idx_sessions_ticket ON sessions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_created ON sessions(created_at DESC);

-- Eventos de sesión (rrweb)
CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Event data
  event_type INTEGER NOT NULL, -- rrweb type (2=snapshot, 3=incremental, etc)
  event_data JSONB NOT NULL, -- Compressed rrweb event
  timestamp BIGINT NOT NULL, -- Client timestamp
  
  -- Metadata
  sequence_number INTEGER NOT NULL, -- Order within session
  size_bytes INTEGER, -- Size of event data
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para replay
CREATE INDEX idx_events_session_seq ON session_events(session_id, sequence_number);
CREATE INDEX idx_events_session_time ON session_events(session_id, timestamp);

-- Eventos custom y errores
CREATE TABLE custom_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_custom_events_session ON custom_events(session_id, timestamp);
CREATE INDEX idx_custom_events_type ON custom_events(event_type);

-- Errores
CREATE TABLE session_errors (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  error_type VARCHAR(50) NOT NULL,
  message TEXT,
  stack TEXT,
  timestamp BIGINT NOT NULL,
  metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_errors_session ON session_errors(session_id);
CREATE INDEX idx_errors_type ON session_errors(error_type);

-- Vista materializada para analytics
CREATE MATERIALIZED VIEW session_analytics AS
SELECT 
  app_id,
  DATE(started_at) as date,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(duration_seconds) as avg_duration,
  SUM(error_count) as total_errors,
  SUM(click_count) as total_clicks,
  AVG(event_count) as avg_events_per_session
FROM sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY app_id, DATE(started_at);

-- Refresh cada hora
CREATE INDEX idx_analytics_app_date ON session_analytics(app_id, date DESC);
```

### Redis Schema

```javascript
// Cache de sesiones activas
HSET session:uuid {
  "userId": "user-123",
  "appId": "yalo-pos",
  "startTime": 1234567890,
  "lastActivity": 1234567999,
  "eventCount": 150
}
EXPIRE session:uuid 3600  // 1 hora

// Buffer de eventos temporales
RPUSH events:uuid:buffer {compressed_event_data}
EXPIRE events:uuid:buffer 300  // 5 minutos

// Rate limiting
INCR rate:apikey:xxx
EXPIRE rate:apikey:xxx 60  // 1 minuto
```

## 🔧 Implementación Backend (Node.js/Fastify)

### Estructura del proyecto
```
backend/
├── src/
│   ├── server.js          # Entry point
│   ├── config/
│   │   ├── database.js    # PostgreSQL config
│   │   └── redis.js       # Redis config
│   ├── routes/
│   │   ├── sessions.js    # Session endpoints
│   │   └── analytics.js   # Analytics endpoints
│   ├── services/
│   │   ├── SessionService.js
│   │   ├── EventService.js
│   │   └── CompressionService.js
│   ├── models/
│   │   ├── Session.js
│   │   └── Event.js
│   └── utils/
│       ├── compression.js
│       └── validation.js
├── migrations/
│   └── 001_initial_schema.sql
└── package.json
```

### Ejemplo de implementación

```javascript
// server.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import postgres from '@fastify/postgres';
import redis from '@fastify/redis';

const fastify = Fastify({
  logger: true,
  bodyLimit: 10485760 // 10MB
});

// Plugins
await fastify.register(cors);
await fastify.register(compress);
await fastify.register(postgres, {
  connectionString: process.env.DATABASE_URL
});
await fastify.register(redis, {
  url: process.env.REDIS_URL
});

// Routes
import sessionRoutes from './routes/sessions.js';
fastify.register(sessionRoutes, { prefix: '/api' });

// Start
await fastify.listen({ port: 3001, host: '0.0.0.0' });
```

```javascript
// routes/sessions.js
export default async function routes(fastify) {
  // Start session
  fastify.post('/sessions/start', async (request, reply) => {
    const { sessionId, userId, appId, metadata } = request.body;
    
    // Save to PostgreSQL
    await fastify.pg.query(`
      INSERT INTO sessions (id, user_id, app_id, metadata)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, userId, appId, metadata]);
    
    // Cache in Redis
    await fastify.redis.hset(`session:${sessionId}`, {
      userId,
      appId,
      startTime: Date.now()
    });
    
    return { success: true, sessionId };
  });
  
  // Receive events
  fastify.post('/sessions/:sessionId/events', async (request, reply) => {
    const { sessionId } = request.params;
    const { events, customEvents, errors } = request.body;
    
    // Decompress events if needed
    let decompressedEvents = events;
    if (events.compressed) {
      const buffer = Buffer.from(events.data, 'base64');
      const decompressed = await pako.inflate(buffer, { to: 'string' });
      decompressedEvents = JSON.parse(decompressed);
    }
    
    // Batch insert events
    if (decompressedEvents.length > 0) {
      const values = decompressedEvents.map((event, index) => [
        sessionId,
        event.type,
        event,
        event.timestamp,
        index
      ]);
      
      await fastify.pg.transact(async client => {
        await client.query(format(`
          INSERT INTO session_events 
          (session_id, event_type, event_data, timestamp, sequence_number)
          VALUES %L
        `, values));
      });
    }
    
    // Update session stats
    await fastify.pg.query(`
      UPDATE sessions 
      SET event_count = event_count + $1,
          error_count = error_count + $2,
          last_activity = NOW()
      WHERE id = $3
    `, [decompressedEvents.length, errors.length, sessionId]);
    
    return { 
      success: true, 
      received: {
        events: decompressedEvents.length,
        customEvents: customEvents.length,
        errors: errors.length
      }
    };
  });
  
  // Get session for replay
  fastify.get('/sessions/:sessionId/replay', async (request, reply) => {
    const { sessionId } = request.params;
    
    // Check cache first
    const cached = await fastify.redis.get(`replay:${sessionId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Get from database
    const result = await fastify.pg.query(`
      SELECT event_data, timestamp 
      FROM session_events 
      WHERE session_id = $1 
      ORDER BY sequence_number
    `, [sessionId]);
    
    const events = result.rows.map(row => row.event_data);
    
    // Cache for 1 hour
    await fastify.redis.setex(
      `replay:${sessionId}`, 
      3600, 
      JSON.stringify({ sessionId, events })
    );
    
    return { sessionId, events };
  });
}
```

## 🚀 Optimizaciones

### 1. **Compresión**
- Los eventos se comprimen con pako/gzip antes de enviar
- Almacenar comprimidos en la BD (JSONB se comprime automáticamente)
- ~70% reducción en tamaño

### 2. **Batching**
- SDK envía eventos cada 50 eventos o 30 segundos
- Inserción batch en PostgreSQL
- Reduce overhead de red

### 3. **Cache Strategy**
```javascript
// Cache layers
1. Redis: Sesiones activas (1 hora)
2. Redis: Replay data (1 hora después de acceso)
3. PostgreSQL: Almacenamiento permanente
4. S3 (opcional): Archival después de 30 días
```

### 4. **TTL y Cleanup**
```sql
-- Job diario para limpiar sesiones expiradas
DELETE FROM sessions 
WHERE expires_at < NOW();

-- O mover a tabla de archivo
INSERT INTO sessions_archive 
SELECT * FROM sessions 
WHERE created_at < NOW() - INTERVAL '30 days';
```

### 5. **Particionamiento**
```sql
-- Particionar por fecha para mejor performance
CREATE TABLE session_events_2024_01 PARTITION OF session_events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## 📊 Monitoreo y Métricas

### Métricas clave
- **Latencia de ingesta**: < 100ms p95
- **Throughput**: 1000 eventos/segundo por instancia
- **Almacenamiento**: ~1MB por sesión de 5 minutos
- **Cache hit rate**: > 80% para replays

### Health checks
```javascript
// GET /health
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "uptime": 3600,
  "sessions_active": 45,
  "events_per_minute": 5000
}
```

## 🔒 Seguridad

### 1. **Autenticación**
```javascript
// API Key validation
fastify.addHook('onRequest', async (request, reply) => {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey || !isValidApiKey(apiKey)) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});
```

### 2. **Rate Limiting**
```javascript
await fastify.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  redis: fastify.redis
});
```

### 3. **Validación**
```javascript
// Zod schemas
const SessionStartSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().optional(),
  appId: z.string(),
  metadata: z.object({}).passthrough()
});
```

## 🐳 Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/spectraview
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: spectraview
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  
volumes:
  postgres_data:
```

## 📈 Escalabilidad

### Horizontal Scaling
```nginx
# nginx.conf
upstream spectraview_api {
  least_conn;
  server api1:3001;
  server api2:3001;
  server api3:3001;
}
```

### Estimaciones de capacidad
- **1 instancia**: ~1000 sesiones concurrentes
- **PostgreSQL**: 100GB soporta ~100K sesiones de 5 min
- **Redis**: 1GB RAM para 1000 sesiones activas
- **Bandwidth**: ~100KB/s por sesión activa

## 🔄 Migración y Backup

```bash
# Backup
pg_dump spectraview > backup.sql
redis-cli BGSAVE

# Restore
psql spectraview < backup.sql
```

---

## 📝 Notas de Implementación

1. **Compresión es crítica**: Sin ella, el almacenamiento se dispara
2. **Cache agresivo**: La mayoría de replays son de sesiones recientes
3. **TTL automático**: No guardar sesiones más de X días (GDPR)
4. **Particionamiento**: Esencial para escalar más allá de 1M sesiones
5. **CDN para assets**: Los snapshots iniciales pueden ser grandes

---

*Última actualización: Diciembre 2024*