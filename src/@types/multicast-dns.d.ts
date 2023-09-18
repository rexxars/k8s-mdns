declare module 'multicast-dns' {
  import type {RemoteInfo} from 'node:dgram'
  import type {Question, Answer, Packet} from 'dns-packet'

  export interface MulticastDnsOptions {
    /**
     * Whether or not to use udp multicasting
     */
    multicast?: boolean

    /**
     * Network interface to use. Defaults to all.
     */
    interface?: string

    /**
     * UDP port to use
     */
    port?: number

    /**
     * UDP IP to use for multicasting
     */
    ip?: string

    /**
     * Multicast TTL, in seconds
     */
    ttl?: number

    /**
     * Whether or not to receive your own packets
     */
    loopback?: boolean

    /**
     * Set the `reuseAddr` option when creating the socket
     * See {@link https://nodejs.org/api/dgram.html#dgramcreatesocketoptions-callback | Node.js docs}
     */
    reuseAddr?: boolean
  }

  class MulticastDns {
    on(event: 'error', handler: (err: Error) => void): this
    on(
      event: 'packet',
      handler: (message: Packet, rinfo: RemoteInfo) => void,
    ): this
    on(
      event: 'query',
      handler: (message: Packet, rinfo: RemoteInfo) => void,
    ): this
    on(
      event: 'response',
      handler: (message: Packet, rinfo: RemoteInfo) => void,
    ): this
    on(event: 'ready', handler: () => void): this
    on(event: 'warning', handler: (err: Error) => void): this

    send(value: Packet): void
    send(value: Packet, rinfo: RemoteInfo): void
    send(value: Packet, callback: (err: Error | undefined) => void)
    send(
      value: Packet,
      rinfo: RemoteInfo,
      callback?: (err: Error | undefined) => void,
    )

    respond(
      response: Packet | Answer[],
      callback: (err: Error | undefined) => void,
    )
    respond(
      response: Packet | Answer[],
      rinfo?: RemoteInfo,
      callback?: (err: Error | undefined) => void,
    )

    response(response: Packet | Answer[], rinfo: RemoteInfo): void
    response(
      response: Packet | Answer[],
      callback: (err: Error | undefined) => void,
    )
    response(
      response: Packet | Answer[],
      rinfo: RemoteInfo,
      callback?: (err: Error | undefined) => void,
    )

    query(
      question: Packet | Question[] | string,
      callback: (err: Error | undefined) => void,
    ): void
    query(
      question: Packet | Question[] | string,
      rinfo: RemoteInfo,
      callback?: (err: Error | undefined) => void,
    ): void
    query(
      question: Packet | Question[] | string,
      type: string,
      callback: (err: Error | undefined) => void,
    ): void
    query(
      question: Packet | Question[] | string,
      type: string,
      rinfo: RemoteInfo,
    ): void
    query(
      question: Packet | Question[] | string,
      type?: string,
      rinfo?: RemoteInfo,
      callback?: (err: Error | undefined) => void,
    ): void

    destroy(callback?: (err: Error | undefined) => void)

    update(): this
  }

  export type MulticastDns = MulticastDns

  const multicastdns: (options?: MulticastDnsOptions) => MulticastDns

  export = multicastdns
}
