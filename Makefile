CC ?= cc
CFLAGS ?= -Wall -Wextra -O2 -Isrc

DESTDIR ?=
PREFIX ?= /usr/local
BINARY_REL ?= bin
SRC = src/ok200.c src/mongoose.c
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
