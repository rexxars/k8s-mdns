# k8s-mdns

Daemon that responds to mdns queries for services found in kubernetes, with a random kubernetes node IP.

You probably don't want to be using this. It would mean every Kubernetes node found would have to be able to respond to requests for any service, eg with an ingress controller or similar. Also randomly shuffles traffic around when nodes/services are discovered/removed, so somewhat unpredictable.

Made mainly for fun/to play with multicast DNS.

## Configuration

There are a few optional environment variables to configure:

- `LOG_LEVEL` - Pino log level. Defaults to `info`. Must be one of `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.
- `KUBERNETES_NAMESPACE` - The kubernetes namespace to look for services in. Defaults to `default`.
- `DNS_TTL` - Number of seconds to respond with for DNS TTL. Defaults to 30.

## License

MIT-licensed. See LICENSE.
