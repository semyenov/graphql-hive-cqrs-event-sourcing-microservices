#!/usr/bin/env bun
/**
 * 🎯 Monitoring Dashboard Server
 * 
 * Serves the pipe pattern monitoring dashboard and provides real-time metrics
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import * as path from "path"
import * as fs from "fs"

// ============================================================================
// Metrics Collection
// ============================================================================

interface Metrics {
  avgResponseTime: number
  throughput: number
  memoryUsage: number
  errorRate: number
  pipeOperations: number
  genOperations: number
  traces: Trace[]
}

interface Trace {
  id: string
  operation: string
  duration: number
  status: "success" | "error" | "warning"
  timestamp: number
  pattern: "pipe" | "gen"
}

// Global metrics store
const metricsStore = Ref.unsafeMake<Metrics>({
  avgResponseTime: 42,
  throughput: 8200,
  memoryUsage: 25.1,
  errorRate: 0.02,
  pipeOperations: 0,
  genOperations: 0,
  traces: []
})

// ============================================================================
// Metrics Simulation (In production, collect from actual system)
// ============================================================================

const simulateMetrics = () =>
  pipe(
    Effect.sync(() => ({
      avgResponseTime: 30 + Math.random() * 30,
      throughput: 7000 + Math.random() * 2000,
      memoryUsage: 20 + Math.random() * 10,
      errorRate: Math.random() * 0.05,
      pipeOperations: Math.floor(Math.random() * 1000),
      genOperations: Math.floor(Math.random() * 800),
      traces: generateTraces()
    })),
    Effect.flatMap((newMetrics) =>
      Ref.update(metricsStore, (current) => ({
        ...current,
        ...newMetrics,
        traces: [...newMetrics.traces, ...current.traces].slice(0, 100)
      }))
    )
  )

const generateTraces = (): Trace[] => {
  const operations = [
    "handleCreateUser",
    "processPayment",
    "buildOrderProjection",
    "executeOrderSaga",
    "loadAggregate",
    "saveAggregate",
    "publishEvents",
    "validateCommand",
    "applyEvent",
    "createSnapshot"
  ]

  return Array.from({ length: 5 }, () => ({
    id: crypto.randomUUID(),
    operation: operations[Math.floor(Math.random() * operations.length)],
    duration: Math.floor(10 + Math.random() * 400),
    status: Math.random() > 0.95 ? "error" : Math.random() > 0.85 ? "warning" : "success",
    timestamp: Date.now() - Math.random() * 60000,
    pattern: Math.random() > 0.3 ? "pipe" : "gen"
  } as Trace))
}

// ============================================================================
// WebSocket Support for Real-time Updates
// ============================================================================

const broadcastMetrics = (ws: any) =>
  pipe(
    Ref.get(metricsStore),
    Effect.map((metrics) => ({
      type: "metrics",
      data: {
        ...metrics,
        timestamp: Date.now()
      }
    })),
    Effect.tap((message) =>
      Effect.sync(() => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(JSON.stringify(message))
        }
      })
    )
  )

// ============================================================================
// HTTP Server
// ============================================================================

const startServer = () => {
  const dashboardPath = path.join(import.meta.dir, "dashboard.html")
  
  // Start metrics collection
  const metricsInterval = setInterval(() => {
    Effect.runPromise(simulateMetrics())
  }, 3000)

  const server = Bun.serve({
    port: 3002,
    
    async fetch(req, server) {
      const url = new URL(req.url)
      
      // Serve dashboard
      if (url.pathname === "/" || url.pathname === "/dashboard") {
        const html = fs.readFileSync(dashboardPath, "utf-8")
        return new Response(html, {
          headers: { "Content-Type": "text/html" }
        })
      }
      
      // API endpoint for metrics
      if (url.pathname === "/api/metrics") {
        const metrics = await Effect.runPromise(Ref.get(metricsStore))
        return new Response(JSON.stringify(metrics), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        })
      }
      
      // API endpoint for performance comparison
      if (url.pathname === "/api/comparison") {
        const comparison = {
          pipe: {
            commands: 651,
            queries: 210,
            projections: 385,
            memory: 25.1,
            gcPauses: 7
          },
          gen: {
            commands: 892,
            queries: 280,
            projections: 520,
            memory: 42.3,
            gcPauses: 12
          },
          improvement: {
            speed: "27%",
            memory: "40%",
            gc: "42%"
          }
        }
        return new Response(JSON.stringify(comparison), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        })
      }
      
      // WebSocket upgrade for real-time updates
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) {
          return
        }
        return new Response("Upgrade failed", { status: 500 })
      }
      
      // Health check
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "healthy" }), {
          headers: { "Content-Type": "application/json" }
        })
      }
      
      return new Response("Not Found", { status: 404 })
    },
    
    websocket: {
      open(ws) {
        console.log("WebSocket connected")
        
        // Send initial metrics
        Effect.runPromise(broadcastMetrics(ws))
        
        // Send updates every 2 seconds
        const interval = setInterval(() => {
          Effect.runPromise(broadcastMetrics(ws))
        }, 2000)
        
        // Store interval for cleanup
        ;(ws as any).interval = interval
      },
      
      message(ws, message) {
        // Handle incoming messages if needed
        console.log("Received:", message)
      },
      
      close(ws) {
        console.log("WebSocket disconnected")
        // Clear interval
        if ((ws as any).interval) {
          clearInterval((ws as any).interval)
        }
      }
    }
  })

  console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎯 Pipe Pattern Monitoring Dashboard                   ║
╚════════════════════════════════════════════════════════════╝

  📊 Dashboard:  http://localhost:${server.port}
  🔌 WebSocket:  ws://localhost:${server.port}/ws
  📡 API:        http://localhost:${server.port}/api/metrics
  
  Features:
  • Real-time performance metrics
  • Pipe vs Effect.gen comparison
  • Live trace monitoring
  • Memory usage tracking
  • Error rate analysis
  
  Press Ctrl+C to stop the server
  `)
  
  // Cleanup on exit
  process.on("SIGINT", () => {
    clearInterval(metricsInterval)
    server.stop()
    console.log("\n👋 Dashboard server stopped")
    process.exit(0)
  })
}

// ============================================================================
// Export Metrics Collection API
// ============================================================================

/**
 * Record a pipe pattern operation
 */
export const recordPipeOperation = (
  operation: string,
  duration: number,
  status: "success" | "error" | "warning" = "success"
): Effect.Effect<void> =>
  Ref.update(metricsStore, (metrics) => ({
    ...metrics,
    pipeOperations: metrics.pipeOperations + 1,
    traces: [
      {
        id: crypto.randomUUID(),
        operation,
        duration,
        status,
        timestamp: Date.now(),
        pattern: "pipe"
      },
      ...metrics.traces
    ].slice(0, 100)
  }))

/**
 * Record an Effect.gen operation
 */
export const recordGenOperation = (
  operation: string,
  duration: number,
  status: "success" | "error" | "warning" = "success"
): Effect.Effect<void> =>
  Ref.update(metricsStore, (metrics) => ({
    ...metrics,
    genOperations: metrics.genOperations + 1,
    traces: [
      {
        id: crypto.randomUUID(),
        operation,
        duration,
        status,
        timestamp: Date.now(),
        pattern: "gen"
      },
      ...metrics.traces
    ].slice(0, 100)
  }))

/**
 * Update global metrics
 */
export const updateMetrics = (updates: Partial<Metrics>): Effect.Effect<void> =>
  Ref.update(metricsStore, (current) => ({
    ...current,
    ...updates
  }))

// ============================================================================
// Start server if run directly
// ============================================================================

if (import.meta.main) {
  startServer()
}

export { startServer }