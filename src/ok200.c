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

#define MG_IO_TIMEOUT 5000
#define MG_MAX_RECV_SIZE 4096
#include "mongoose.h"
#include <time.h>

static void print_help(const char *prog_name) {
    printf("Usage: %s [PORT]\n", prog_name);
    printf("\n");
    printf("A minimal HTTP server that always responds with OK\n");
    printf("\n");
    printf("Arguments:\n");
    printf("  PORT    Port to listen on (default: 8080, range: 1-65535)\n");
    printf("\n");
    printf("Examples:\n");
    printf("  %s           # Listen on default port 8080\n", prog_name);
    printf("  %s 4242      # Listen on port 4242\n", prog_name);
    printf("\n");
}

static void fn(struct mg_connection *c, int ev, void *ev_data) {
    (void)ev_data;
    if (ev == MG_EV_HTTP_MSG) {
        const char *body = "OK";
        size_t body_len = 2;

        char date_str[64];
        time_t now = time(NULL);
        struct tm *gmt = gmtime(&now);

        strftime(date_str, sizeof(date_str), "%a, %d %b %Y %H:%M:%S GMT", gmt);

        // We don't use mg_http_reply() here to build a strict HTTP/1.1 200 OK response
        mg_printf(c,
                  "HTTP/1.1 200 OK\r\n"
                  "Content-Type: text/plain;charset=utf-8\r\n"
                  "Date: %s\r\n"
                  "Content-Length: %lu\r\n"
                  "\r\n"
                  "%s",
                  date_str, (unsigned long)body_len, body);
        c->is_resp = 0;
    }
}

int main(int argc, char *argv[]) {
    mg_log_set(MG_LL_ERROR);
    int port = 8080;
    int poll_interval = 1000;

    if (argc > 2) {
        fprintf(stderr, "Error: Too many arguments\n");
        print_help(argv[0]);
        return 1;
    }

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            print_help(argv[0]);
            return 0;
        }
    }

    if (argc > 1) {
        port = atoi(argv[1]);
        if (port <= 0 || port > 65535) {
            fprintf(stderr, "Error: Invalid port '%s' (must be 1-65535)\n", argv[1]);
            return 1;
        }
    }

    char addr[64];
    snprintf(addr, sizeof(addr), "http://0.0.0.0:%d", port);

    struct mg_mgr mgr;
    mg_mgr_init(&mgr);

    struct mg_connection *c = mg_http_listen(&mgr, addr, fn, NULL);
    if (c == NULL) {
        fprintf(stderr, "Failed to start server on port %d, maybe it's already in use?\n", port);
        mg_mgr_free(&mgr);
        return 1;
    }

    printf("Server running on port %d\n", port);
    for (;;) mg_mgr_poll(&mgr, poll_interval);

    mg_mgr_free(&mgr);
    return 0;
}
