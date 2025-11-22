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

- `-b PORT` - Backend port to check (if set, proxies health check)
- `-h` - Show help message

## Examples

### Always OK mode (default)

```bash
$ ./ok200 4242
Server running on port 4242

$ curl -i http://localhost:4242/some/path
HTTP/1.1 200 OK
Content-Length: 2

OK
```

### Backend health check mode

If a backend port is specified with `-b`, when a request is received, the server will check the backend with a GET request on the specified port. If the backend responds with a 2xx status code, the server responds HTTP Code 200 with body "OK". If the backend is down or responds with a non-2xx status code, the server responds HTTP Code 503 with body "Not OK".

```bash
$ ./ok200 -b 3000 8080
Server running on port 8080, checking backend on port 3000

# If backend on port 3000 returns 2xx:
$ curl http://localhost:8080/
OK

# If backend is down or returns non-2xx:
$ curl http://localhost:8080/
Not OK
```

## Install

```bash
make install
```

## License

GPL-2.0-only
