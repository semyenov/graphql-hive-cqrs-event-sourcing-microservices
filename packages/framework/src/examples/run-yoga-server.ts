/**
 * Run Yoga Federation Server
 * 
 * Simple script to start the GraphQL Federation server
 */

import { startServer } from "./yoga-federation-server"

// Start the server
startServer().catch(error => {
  console.error("Failed to start server:", error)
  process.exit(1)
}) 