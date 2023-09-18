/* eslint-disable no-process-env */
export const config = {
  logLevel: process.env['LOG_LEVEL'] || 'info',
  namespace: process.env['KUBERNETES_NAMESPACE'] || 'default',
  dnsTTL: intVal(process.env['DNS_TTL'], 30),
  loadConfigFromCluster:
    typeof process.env['KUBERNETES_SERVICE_HOST'] !== 'undefined',
}

function intVal(val: string | undefined, defaultValue: number): number {
  const num = typeof val === 'string' ? parseInt(val, 10) : defaultValue
  return isNaN(num) ? defaultValue : num
}
