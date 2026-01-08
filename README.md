# OK 200, the always OK web server

A minimal HTTP server that never disagrees, based on [Mongoose](https://github.com/cesanta/mongoose). Can also proxy backend health.

## Build

```bash
make
```

## Usage

```bash
./ok200 [OPTIONS] [PORT]
```

Default port is 8080.

### Options

- `-a ADDR` - Address to bind to (default: 0.0.0.0)
- `-b PORT` - Backend port to check (if set, proxies health check)
- `-p PATH` - Backend path to check (can be specified multiple times, max 5)
- `-h` - Show help message

Port must be in range 1-65535.

### Environment Variables

- `CC_HEALTH_CHECK_PATH_0`, `CC_HEALTH_CHECK_PATH_1`, ... - Backend paths to check (max 5, overridden by `-p` options)

When multiple paths are specified, all must return 2xx for OK response.

### Behavior

- Backend requests are made to `127.0.0.1` on the specified port
- Backend connection timeout is 5 seconds
- Graceful shutdown on SIGINT (Ctrl+C) or SIGTERM

## Examples

### Always OK mode (default)

```bash
$ ./ok200 4242
Server running on 0.0.0.0:4242

$ curl -i http://localhost:4242/some/path
HTTP/1.1 200 OK
Content-Length: 2

OK
```

### Bind to localhost only

```bash
$ ./ok200 -a 127.0.0.1 8080
Server running on 127.0.0.1:8080
```

### Backend health check mode

If a backend port is specified with `-b`, when a request is received, the server will check the backend with a GET request on the specified port. If the backend responds with a 2xx status code, the server responds HTTP Code 200 with body "OK". If the backend is down or responds with a non-2xx status code, the server responds HTTP Code 503 with body "Not OK".

```bash
$ ./ok200 -b 3000 8080
Server running on 0.0.0.0:8080, checking backend on port 3000 (path: /)

# If backend on port 3000 returns 2xx:
$ curl http://localhost:8080/
OK

# If backend is down or returns non-2xx:
$ curl http://localhost:8080/
Not OK
```

### Check specific backend path

```bash
$ ./ok200 -b 3000 -p /health 8080
Server running on 0.0.0.0:8080, checking backend on port 3000 (paths: /health)
```

### Check multiple backend paths

All paths must return 2xx for the server to respond OK.

```bash
$ ./ok200 -b 3000 -p /health -p /ready 8080
Server running on 0.0.0.0:8080, checking backend on port 3000 (paths: /health, /ready)
```

Using environment variables:

```bash
$ CC_HEALTH_CHECK_PATH_0=/health CC_HEALTH_CHECK_PATH_1=/ready ./ok200 -b 3000
```

## Install

```bash
make install
```

## Test

```bash
bun test
```

## License

GPL-2.0-only
