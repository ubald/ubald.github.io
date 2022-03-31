.POSIX:
DESTDIR=public
HUGO_VERSION=0.76.3

.PHONY: all
all: get clean serve build

.PHONY: get
get:
	@echo "Checking for hugo"
	@if ! [ -x "$$(command -v hugo)" ]; then\
		echo "Getting Hugo";\
	    wget -q -P tmp/ https://github.com/gohugoio/hugo/releases/download/v$(HUGO_VERSION)/hugo_extended_$(HUGO_VERSION)_Linux-64bit.tar.gz;\
		tar xf tmp/hugo_extended_$(HUGO_VERSION)_Linux-64bit.tar.gz -C tmp/;\
		sudo mv -f tmp/hugo /usr/local/bin/;\
		rm -rf tmp/;\
		hugo version;\
	fi

.PHONY: clean
clean:
	@echo "Cleaning old build"
	cd $(DESTDIR) && rm -rf *

.PHONY: serve
serve:
	@echo "Generating site"
	hugo serve

.PHONY: build
build:
	@echo "Generating site"
	hugo --gc --environment production -d $(DESTDIR)