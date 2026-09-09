import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import multer from 'multer'
import { router } from './routes.js'

export const app = express()
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'ec-labs-subscription-api' }))
app.use('/api', router)
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }))

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return response.status(400).json({ error: 'File must be 2MB or smaller' })
  response.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error' })
}
app.use(errorHandler)
