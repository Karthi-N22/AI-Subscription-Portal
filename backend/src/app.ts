import cors from 'cors'
import express from 'express'
import { router } from './routes.js'

export const app = express()
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'ec-labs-subscription-api' }))
app.use('/api', router)
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }))
