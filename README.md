# OK 200, the always OK web server

A minimal HTTP server that never disagrees, based on [Mongoose](https://github.com/cesanta/mongoose).

## Build

```bash
make
```

## Usage

```bash
./ok200 [port]
```

Default port is 8080.

## Example

```bash
$ ./ok200 4242
Server running on port 4242

$ curl -i http://localhost:4242/some/path
HTTP/1.1 200 OK
Content-Length: 2

OK
```

## Install

```bash
make install
```

## License

GPL-2.0-only
