#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <arpa/inet.h>

int main(int argc, char *argv[]) {
    signal(SIGPIPE, SIG_IGN);

    int port = argc > 1 ? atoi(argv[1]) : 8080;
    int s = socket(AF_INET, SOCK_STREAM, 0), opt = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in a = {0};
    a.sin_family = AF_INET;
    a.sin_port = htons(port);
    a.sin_addr.s_addr = INADDR_ANY;

    bind(s, (struct sockaddr*)&a, sizeof(a));
    listen(s, 10);

    printf("Listening on port %d\n", port);

    while(1) {
        int c = accept(s, 0, 0);
        if (c < 0) continue;

        char b[4096];
        read(c, b, sizeof(b));

        const char *r = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
        write(c, r, strlen(r));
        close(c);
    }
}
