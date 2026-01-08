CC ?= cc
CFLAGS ?= -Wall -Wextra -O2 -Isrc -fstack-protector-strong -D_FORTIFY_SOURCE=2 -fPIE

# Platform-specific linker flags
# Linux: PIE (ASLR) + full RELRO (GOT protection)
# macOS: PIE is enabled by default, RELRO not supported
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
    LDFLAGS ?= -pie -Wl,-z,relro,-z,now
else
    LDFLAGS ?=
endif

DESTDIR ?=
PREFIX ?= /usr/local
BINARY_REL ?= bin
SRC = src/ok200.c src/mongoose.c
TARGET = ok200

.PHONY: all clean install uninstall

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	install -d $(DESTDIR)$(PREFIX)/$(BINARY_REL)
	install -m 755 $(TARGET) $(DESTDIR)$(PREFIX)/$(BINARY_REL)

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/$(BINARY_REL)/$(TARGET)
