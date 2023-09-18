import multicastdns, {type MulticastDns} from 'multicast-dns'
import {
  CoreV1Api,
  KubeConfig,
  makeInformer,
  NetworkingV1Api,
  type V1Ingress,
  type V1Node,
  type V1Service,
} from '@kubernetes/client-node'
import {promisify} from 'node:util'
import {config} from './config.js'
import {logger} from './logger.js'

export function createDaemon(): {
  start: () => Promise<void>
  stop: () => Promise<void>
} {
  // Key: service name/ingress host, value: node IP
  const routingRules = new Map<string, string>()
  const ingresses = new Map<string, Set<string>>()
  const nodeIPs = new Set<string>()
  const serviceNames = new Set<string>()

  const kc = new KubeConfig()
  if (config.loadConfigFromCluster) {
    kc.loadFromCluster()
  } else {
    kc.loadFromDefault()
  }

  let mdns: MulticastDns | undefined

  const k8sApi = kc.makeApiClient(CoreV1Api)
  const k8sNetApi = kc.makeApiClient(NetworkingV1Api)

  const serviceInformer = makeInformer(
    kc,
    '/api/v1/namespaces/default/services',
    () => k8sApi.listNamespacedService(config.namespace),
  )

  serviceInformer.on('add', (service: V1Service) => {
    const serviceName = (service.metadata?.name || '').replace(/\.local$/, '')
    if (service.metadata?.labels?.provider === 'kubernetes' || !serviceName) {
      return
    }

    logger.info('Service discovered: %s', serviceName)
    serviceNames.add(serviceName)

    rebalanceServices()
  })

  serviceInformer.on('delete', (service: V1Service) => {
    const serviceName = service.metadata?.name
    if (service.metadata?.labels?.provider === 'kubernetes' || !serviceName) {
      return
    }

    logger.info('Service removed: %s', serviceName)
    serviceNames.delete(serviceName)

    rebalanceServices()
  })

  serviceInformer.on('error', async (err: unknown) => {
    logger.error(err)

    // Restart service informer after 5sec
    await delay(5000)
    serviceInformer.start()
  })

  const nodeInformer = makeInformer(kc, '/api/v1/nodes', () =>
    k8sApi.listNode(),
  )

  nodeInformer.on('add', (node: V1Node) => {
    const {ip, hostname = 'unknown hostname'} = getAddresses(node)
    if (!ip) {
      return
    }

    logger.info('Node discovered at %s (%s)', ip, hostname)
    nodeIPs.add(ip)

    rebalanceServices()
  })

  nodeInformer.on('delete', (node: V1Node) => {
    const {ip, hostname = 'unknown hostname'} = getAddresses(node)
    if (!ip) {
      return
    }

    logger.info('Node removed at %s (%s)', ip, hostname)
    nodeIPs.delete(ip)

    rebalanceServices()
  })

  nodeInformer.on('error', async (err: unknown) => {
    logger.error(err)

    // Restart node informer after 5sec
    await delay(5000)
    nodeInformer.start()
  })

  const ingressInformer = makeInformer(
    kc,
    '/apis/networking.k8s.io/v1/ingresses',
    () => k8sNetApi.listIngressForAllNamespaces(),
  )

  ingressInformer.on('add', (ingress: V1Ingress) => {
    const ingressName = ingress.metadata?.name || ''
    const rules = ingress.spec?.rules || []
    if (!ingressName || rules.length === 0) {
      return
    }

    const hosts = new Set<string>()
    for (const rule of rules) {
      if (!rule.host || rule.host?.includes('*')) {
        continue
      }

      logger.info('Ingress rule discovered for host: %s', rule.host)
      hosts.add(rule.host)
    }

    ingresses.set(ingressName, hosts)

    rebalanceServices()
  })

  ingressInformer.on('delete', (ingress: V1Ingress) => {
    const ingressName = ingress.metadata?.name || ''
    if (!ingressName) {
      return
    }

    logger.info('Ingress removed: %s', ingressName)
    ingresses.delete(ingressName)

    rebalanceServices()
  })

  ingressInformer.on('error', (err: unknown) => {
    logger.error(err)

    ingressInformer.start()
  })

  function rebalanceServices() {
    if (serviceNames.size === 0 || nodeIPs.size === 0) {
      routingRules.clear()
      return
    }

    const services = shuffle(Array.from(serviceNames))
    const nodes = shuffle(Array.from(nodeIPs))

    let nodeIndex = 0
    for (const serviceName of services) {
      const node = nodes[nodeIndex] || ''
      routingRules.set(serviceName, node)

      if (++nodeIndex >= nodes.length) {
        nodeIndex = 0
      }
    }

    const ingressHosts = new Set(...ingresses.values())
    for (const ingressHost of ingressHosts) {
      const node = nodes[nodeIndex] || ''
      routingRules.set(ingressHost, node)

      if (++nodeIndex >= nodes.length) {
        nodeIndex = 0
      }
    }
  }

  function start() {
    return new Promise<void>((resolve, reject) => {
      let started = false
      mdns = multicastdns()
        .on('error', (err) => {
          if (!started) {
            reject(err)
            return
          }

          logger.warn(
            'MDNS error: %s',
            err instanceof Error ? err.message : `${err}`,
          )
        })
        .on('ready', () => {
          started = true

          serviceInformer.start()
          ingressInformer.start()
          nodeInformer.start()
          resolve()
        })
        .on('query', function onQuery(query) {
          for (const question of query.questions || []) {
            if (!mdns) {
              return
            }

            const serviceName = question.name.replace(/\.local$/, '')
            const ingressHost = question.name
            const nodeIP =
              routingRules.get(serviceName) || routingRules.get(ingressHost)

            if (!nodeIP) {
              return
            }

            if (question.type !== 'A') {
              continue
            }

            logger.info(
              'Responding to request for %s with IP %s',
              question.name,
              nodeIP,
            )

            mdns.respond({
              answers: [
                {
                  name: question.name,
                  type: 'A',
                  ttl: config.dnsTTL,
                  data: nodeIP,
                },
              ],
            })
          }
        })
    })
  }

  async function stop() {
    if (!mdns) {
      return
    }

    await Promise.all([
      nodeInformer.stop(),
      serviceInformer.stop(),
      ingressInformer.stop(),
      promisify(mdns.destroy)(),
    ])
  }

  return {start, stop}
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getAddresses(node: V1Node): {
  hostname: string | undefined
  ip: string | undefined
} {
  const addresses = node.status?.addresses || []
  if (addresses.length === 0) {
    return {hostname: undefined, ip: undefined}
  }

  const ip = addresses.find((addr) => addr.type === 'InternalIP')?.address
  if (!ip) {
    return {hostname: undefined, ip: undefined}
  }

  const hostname =
    addresses.find((addr) => addr.type === 'Hostname')?.address ||
    'unknown hostname'

  return {hostname, ip}
}

function shuffle(array: string[]): string[] {
  let currentIndex = array.length
  let randomIndex

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    const prev = array[randomIndex] || ''
    const next = array[currentIndex] || ''

    array[currentIndex] = prev
    array[randomIndex] = next
  }

  return array
}
