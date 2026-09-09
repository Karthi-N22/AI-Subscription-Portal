import 'dotenv/config'
import { app } from './app.js'
import { startUsageSyncJob } from './usage/usageSync.job.js'

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => console.log(`EC LABS API listening on http://localhost:${port}`))
startUsageSyncJob()
