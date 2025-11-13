CC ?= cc
CFLAGS ?= -Wall -Wextra -O2

DESTDIR ?=
PREFIX ?= /usr/local
BINARY_REL ?= bin
SRC = ok200.c
TARGET = ok200

.PHONY: all clean install uninstall

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	install -d $(DESTDIR)$(PREFIX)/$(BINARY_REL)
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/$(BINARY_REL)

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/$(BINARY_REL)/$(TARGET)
