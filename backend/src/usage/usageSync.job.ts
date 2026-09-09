import cron from 'node-cron'
import { prisma } from '../prisma.js'
import { syncSubscriptionUsage } from './service.js'

export function startUsageSyncJob() {
  cron.schedule('0 3 * * *', async () => {
    const credentials = await prisma.apiCredential.findMany()
    for (const credential of credentials) {
      try {
        await syncSubscriptionUsage(credential.subscriptionId)
      } catch (error) {
        console.error(`Usage sync failed for subscription ${credential.subscriptionId}:`, error)
      }
    }
  })
}
