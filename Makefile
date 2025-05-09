.PHONY: build clean

DIST_DIR := dist

build:
	yarn install --no-immutable
	yarn build

clean:
	rm -rf $(DIST_DIR)

