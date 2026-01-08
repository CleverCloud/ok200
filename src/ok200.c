/*
 * Copyright (c) 2025 CleverCloud

 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * SPDX-License-Identifier: GPL-2.0-only
 */

/* Mongoose configuration - must be before mongoose.h */
#define MG_IO_TIMEOUT 5000
#define MG_MAX_RECV_SIZE 4096

/* Buffer sizes and limits */
#define BUFFER_SIZE 256
#define POLL_INTERVAL_MS 1000
#define MAX_PATHS 5

/* Response bodies - use sizeof to avoid length mismatch errors */
#define BODY_OK "OK"
#define BODY_NOT_OK "Not OK"
#define BODY_OK_LEN (sizeof(BODY_OK) - 1)
#define BODY_NOT_OK_LEN (sizeof(BODY_NOT_OK) - 1)

#include "mongoose.h"

#include <errno.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>  /* For getopt */

/* Flag for graceful shutdown */
static volatile sig_atomic_t running = 1;

static void signal_handler(int sig) {
    (void)sig;
    running = 0;
}

struct server_config {
    int backend_port;
    const char *bind_addr;
    const char *backend_paths[MAX_PATHS];
    int path_count;
};

static void print_help(const char *prog_name);
static int parse_port(const char *s);
static void parse_args(int argc, char *argv[], int *port, struct server_config *cfg);

static int parse_port(const char *s) {
    if (s == NULL) return -1;
    char *end;
    errno = 0;
    long port = strtol(s, &end, 10);
    if (errno == ERANGE || *end != '\0' || port <= 0 || port > 65535) {
        return -1;
    }
    return (int)port;
}

static void add_path(struct server_config *cfg, const char *path) {
    if (cfg->path_count >= MAX_PATHS) {
        fprintf(stderr, "Warning: Maximum number of paths (%d) reached, ignoring '%s'\n", MAX_PATHS, path);
        return;
    }
    if (path != NULL && path[0] != '\0') {
        cfg->backend_paths[cfg->path_count++] = path;
    }
}

static void parse_args(int argc, char *argv[], int *port, struct server_config *cfg) {
    /* Check environment variables CC_HEALTH_CHECK_PATH_0, CC_HEALTH_CHECK_PATH_1, etc. */
    char env_name[32];
    for (int i = 0; i < MAX_PATHS; i++) {
        snprintf(env_name, sizeof(env_name), "CC_HEALTH_CHECK_PATH_%d", i);
        const char *env_path = getenv(env_name);
        if (env_path != NULL && env_path[0] != '\0') {
            add_path(cfg, env_path);
        }
    }

    int opt;
    bool has_p_option = false;
    while ((opt = getopt(argc, argv, "hb:a:p:")) != -1) {
        switch (opt) {
            case 'h':
                print_help(argv[0]);
                exit(0);
            case 'b':
                if ((cfg->backend_port = parse_port(optarg)) < 0) {
                    fprintf(stderr, "Error: Invalid backend port '%s' (must be 1-65535)\n", optarg);
                    exit(1);
                }
                break;
            case 'a':
                cfg->bind_addr = optarg;
                break;
            case 'p':
                /* -p option overrides environment variables */
                if (!has_p_option) {
                    cfg->path_count = 0;  /* Clear paths from env vars */
                    has_p_option = true;
                }
                add_path(cfg, optarg);
                break;
            case '?':
            default:
                /* getopt already printed an error message */
                print_help(argv[0]);
                exit(1);
        }
    }
    if (optind < argc) {
        if ((*port = parse_port(argv[optind])) < 0) {
            fprintf(stderr, "Error: Invalid port '%s' (must be 1-65535)\n", argv[optind]);
            exit(1);
        }
    }
}

static void print_help(const char *prog_name) {
    printf("Usage: %s [OPTIONS] [PORT]\n", prog_name);
    printf("\n");
    printf("A minimal HTTP server that responds with OK, or proxies backend health\n");
    printf("\n");
    printf("Arguments:\n");
    printf("  PORT    Port to listen on (default: 8080, range: 1-65535)\n");
    printf("\n");
    printf("Options:\n");
    printf("  -a ADDR   Address to bind to (default: 0.0.0.0)\n");
    printf("  -b PORT   Backend port to check (if set, proxies health check)\n");
    printf("  -p PATH   Backend path to check (can be specified multiple times)\n");
    printf("  -h        Show this help message\n");
    printf("\n");
    printf("Environment:\n");
    printf("  CC_HEALTH_CHECK_PATH_0, CC_HEALTH_CHECK_PATH_1, ...\n");
    printf("            Backend paths to check (overridden by -p options)\n");
    printf("\n");
    printf("When multiple paths are specified, all must return 2xx for OK response.\n");
    printf("\n");
    printf("Examples:\n");
    printf("  %s                         # Listen on 0.0.0.0:8080, always return OK\n", prog_name);
    printf("  %s 4242                    # Listen on 0.0.0.0:4242\n", prog_name);
    printf("  %s -a 127.0.0.1            # Listen only on localhost\n", prog_name);
    printf("  %s -b 3000                 # Check backend on port 3000 (path: /)\n", prog_name);
    printf("  %s -b 3000 -p /health      # Check /health endpoint\n", prog_name);
    printf("  %s -b 3000 -p /health -p /ready  # Check both endpoints\n", prog_name);
    printf("\n");
}

/*
 * Send HTTP response manually instead of using mg_http_reply().
 * Mongoose pads Content-Length with spaces (e.g., "Content-Length: 2          \r\n")
 * which some load balancers reject as invalid.
 */
static void send_response(struct mg_connection *c, bool is_ok) {
    const char *body;
    size_t body_len;
    int status;
    const char *reason;

    if (is_ok) {
        body = BODY_OK;
        body_len = BODY_OK_LEN;
        status = 200;
        reason = "OK";
    } else {
        body = BODY_NOT_OK;
        body_len = BODY_NOT_OK_LEN;
        status = 503;
        reason = "Service Unavailable";
    }

    char date[BUFFER_SIZE];
    time_t now = time(NULL);
    struct tm tm_storage;
    struct tm *tm_info = gmtime_r(&now, &tm_storage);
    if (tm_info == NULL) {
        /* Fallback if gmtime_r fails */
        strncpy(date, "Thu, 01 Jan 1970 00:00:00 GMT", sizeof(date) - 1);
        date[sizeof(date) - 1] = '\0';
    } else {
        strftime(date, sizeof(date), "%a, %d %b %Y %H:%M:%S GMT", tm_info);
    }

    mg_printf(c, "HTTP/1.1 %d %s\r\n"
                    "Content-Type: text/plain;charset=utf-8\r\n"
                    "Date: %s\r\n"
                    "Content-Length: %lu\r\n"
                    "Connection: close\r\n"
                    "\r\n%s",
              status, reason, date, (unsigned long)body_len, body);
    c->is_resp = 0;
}

struct multi_backend_request {
    unsigned long client_id;
    int total_paths;
    int completed;
    int success_count;
    bool responded;
};

struct backend_request {
    struct multi_backend_request *parent;
    bool completed;
};

/*
 * Find a connection by ID. Needed because client connection pointer
 * may become invalid if client disconnects while backend request is in flight.
 */
static struct mg_connection *find_connection(struct mg_mgr *mgr, unsigned long id) {
    for (struct mg_connection *c = mgr->conns; c != NULL; c = c->next) {
        if (c->id == id) return c;
    }
    return NULL;
}

static void try_respond_multi(struct mg_connection *backend, bool is_ok) {
    struct backend_request *req = (struct backend_request *)backend->fn_data;
    if (req == NULL || req->completed) return;

    struct multi_backend_request *parent = req->parent;
    if (parent == NULL || parent->responded) {
        req->completed = true;
        return;
    }

    req->completed = true;
    parent->completed++;
    if (is_ok) {
        parent->success_count++;
    }

    /* Check if all requests are complete */
    if (parent->completed >= parent->total_paths) {
        /* All paths must succeed for OK response */
        bool all_ok = (parent->success_count == parent->total_paths);

        struct mg_connection *client = find_connection(backend->mgr, parent->client_id);
        if (client != NULL && !client->is_closing) {
            send_response(client, all_ok);
        }
        parent->responded = true;
        free(parent);
    }
}

static void backend_fn(struct mg_connection *c, int ev, void *ev_data) {
    if (c->fn_data == NULL) return;

    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *)ev_data;
        /* Use mg_http_status() helper — more robust and clear. Consider any
         * 2xx (200..299) status as OK for health-check semantics. */
        int status = mg_http_status(hm);
        bool is_ok = (status >= 200 && status < 300);
        try_respond_multi(c, is_ok);
        c->is_closing = 1;
    } else if (ev == MG_EV_ERROR) {
        try_respond_multi(c, false);
    } else if (ev == MG_EV_CLOSE) {
        try_respond_multi(c, false);
        free(c->fn_data);
        c->fn_data = NULL;
    }
}

static void fn(struct mg_connection *c, int ev, void *ev_data) {
    (void)ev_data;
    if (ev != MG_EV_HTTP_MSG) return;

    struct server_config *cfg = (struct server_config *)c->fn_data;
    if (cfg == NULL || cfg->backend_port == 0) {
        send_response(c, true);
        return;
    }

    /* Determine paths to check */
    int path_count = cfg->path_count > 0 ? cfg->path_count : 1;
    const char *default_path = "/";

    /* Allocate parent request to track all backend requests */
    struct multi_backend_request *parent = calloc(1, sizeof(*parent));
    if (parent == NULL) {
        send_response(c, false);
        return;
    }
    parent->client_id = c->id;
    parent->total_paths = path_count;

    /* Start a backend request for each path */
    for (int i = 0; i < path_count; i++) {
        const char *path = (cfg->path_count > 0) ? cfg->backend_paths[i] : default_path;

        /* Build URL and request path - ensure path starts with "/" */
        char url[BUFFER_SIZE];
        char req_path[BUFFER_SIZE];
        if (path[0] != '/') {
            snprintf(req_path, sizeof(req_path), "/%s", path);
        } else {
            snprintf(req_path, sizeof(req_path), "%s", path);
        }
        snprintf(url, sizeof(url), "http://127.0.0.1:%d%s", cfg->backend_port, req_path);

        struct backend_request *req = calloc(1, sizeof(*req));
        if (req == NULL) {
            /* Mark this path as failed */
            parent->completed++;
            continue;
        }
        req->parent = parent;

        struct mg_connection *bc = mg_http_connect(c->mgr, url, backend_fn, req);
        if (bc == NULL) {
            free(req);
            parent->completed++;
            continue;
        }

        mg_printf(bc, "GET %s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nConnection: close\r\n\r\n",
                  req_path, cfg->backend_port);
    }

    /* If all connections failed immediately, respond now */
    if (parent->completed >= parent->total_paths && !parent->responded) {
        send_response(c, false);
        parent->responded = true;
        free(parent);
    }
}

int main(int argc, char *argv[]) {
    mg_log_set(MG_LL_ERROR);
    int port = 8080;
    static struct server_config cfg = {0};

    parse_args(argc, argv, &port, &cfg);

    /* Default bind address */
    const char *bind_addr = cfg.bind_addr ? cfg.bind_addr : "0.0.0.0";

    char addr[BUFFER_SIZE];
    snprintf(addr, sizeof(addr), "http://%s:%d", bind_addr, port);

    /* Set up signal handlers for graceful shutdown */
    struct sigaction sa;
    sa.sa_handler = signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    struct mg_mgr mgr;
    mg_mgr_init(&mgr);

    struct mg_connection *c = mg_http_listen(&mgr, addr, fn, &cfg);
    if (c == NULL) {
        fprintf(stderr, "Failed to start server on %s:%d, maybe it's already in use?\n", bind_addr, port);
        mg_mgr_free(&mgr);
        return 1;
    }

    if (cfg.backend_port > 0) {
        printf("Server running on %s:%d, checking backend on port %d", bind_addr, port, cfg.backend_port);
        if (cfg.path_count > 0) {
            printf(" (%s: ", cfg.path_count == 1 ? "path" : "paths");
            for (int i = 0; i < cfg.path_count; i++) {
                printf("%s%s", cfg.backend_paths[i], (i < cfg.path_count - 1) ? ", " : "");
            }
            printf(")");
        } else {
            printf(" (path: /)");
        }
        printf("\n");
    } else {
        printf("Server running on %s:%d\n", bind_addr, port);
    }
    fflush(stdout);

    while (running) {
        mg_mgr_poll(&mgr, POLL_INTERVAL_MS);
    }

    printf("\nShutting down...\n");
    mg_mgr_free(&mgr);
    return 0;
}
