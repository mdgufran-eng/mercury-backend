#!/usr/bin/env node
/**
 * Tiny callback receiver — logs every POST/GET to the console.
 * Usage: node scripts/callback-receiver.mjs [port]
 *
 * Set your callback URLs to: http://localhost:<port>/<any-path>
 */

import http from 'node:http'

const PORT = Number(process.argv[2] ?? 9999)
let count = 0

const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    count++
    const body = Buffer.concat(chunks).toString()
    const timestamp = new Date().toISOString()

    console.log('\n' + '─'.repeat(60))
    console.log(`[${count}] ${timestamp}`)
    console.log(`${req.method} ${req.url}`)
    console.log('Headers:')
    for (const [k, v] of Object.entries(req.headers)) {
      console.log(`  ${k}: ${v}`)
    }
    if (body) {
      console.log('Body:')
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2))
      } catch {
        console.log(body)
      }
    }
    console.log('─'.repeat(60))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, received: count }))
  })
})

server.listen(PORT, () => {
  console.log(`Callback receiver listening on http://localhost:${PORT}`)
  console.log('Use any path, e.g.:')
  console.log(`  http://localhost:${PORT}/project-created`)
  console.log(`  http://localhost:${PORT}/job-finished`)
  console.log('\nWaiting for callbacks...')
})
