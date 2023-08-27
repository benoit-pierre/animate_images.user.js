.ONESHELL:
SHELL = bash
.SHELLFLAGS = -eo pipefail -c

.DEFAULT: all
.PHONY: all clean config dist-clean fetch-thirdparty helpers lint re setup serve script

BUILD_DIR  ?= build
BUILD_INFO := $(BUILD_DIR)/meson-info/intro-buildoptions.json

CONFIG ?= config.ini

define which
$(eval p:=$(and $1,$(shell which $(firstword $1))))$(and $p,$p $(wordlist 2,$(words $1),$1))
endef

define find_program
$(strip $(or $(call $1),\
	$(call which,$2),\
	$(call which,$3),\
	$(call which,$4),\
	$(call which,$5),\
	$(error Program '$2' not found or not executable)))
endef

define config
[binaries]
ar    = '$(call find_program,EMAR,emar)'
c     = ['$(call find_program,CCACHE,ccache,sccache,env)', '$(call find_program,EMCC,emcc)']
strip = '$(call find_program,EMSTRIP,emstrip)'

[project options]
# Image formats.
gif  = $(or $(GIF),true)
webp = $(or $(WEBP),true)
# Output options.
wasm = $(or $(WASM),true)

# vim: ft=cfg
endef

define newline


endef

# Programs.
MESON ?= meson

all: script

clean:
	rm --force --recursive $(BUILD_DIR)

config: $(CONFIG)

dist-clean:
	-rm --force --recursive $(wildcard config.ini config-*.ini build/ build-*/ $(patsubst %.wrap,%*/,$(wildcard subprojects/*.wrap)))

fetch-thirdparty:
	$(MESON) subprojects download --num-processes 3

re: clean
	@$(MAKE) --no-print-directory all

setup: $(BUILD_INFO)

$(BUILD_INFO): $(CONFIG)
	$(strip $(MESON) setup --auto-features=disabled --cross-file=$(CONFIG) $(if $(wildcard $(BUILD_INFO)),--wipe) $(BUILD_DIR))

helpers lint script serve: $(BUILD_INFO)
	$(MESON) compile -C $(BUILD_DIR) -v $@

$(CONFIG): Makefile
	cat >$@ <<'EOF'
	$(config)
	EOF

# Containers support.

.PHONY: container-build container-config

container-build:
	npm config set prefix='~/.local/' update-notifier=false
	npm install --global --no-audit 'esbuild$(ESBUILD_VERSION:%=@%)'
	python3 -m pip install --no-warn-script-location --user 'meson$(MESON_VERSION:%===%)' 'ninja$(NINJA_VERSION:%===%)'
	env PATH="$$HOME/.local/bin:$$PATH" $(MAKE) all

container-config: config

define container_rules
$1        ?= $2
$1_BUILD  ?= build-$2
$1_CONFIG ?= config-$2.ini
.PHONY: $(patsubst %,$2-%,build clean config)
$2-build $2-config:
	$$(strip $$(call find_program,$1,$2) run --mount type=bind,source='$$(CURDIR),target=/src' \
		--interactive --rm --tty $3 '$4emscripten/emsdk$$(EMSDK_VERSION:%=:%)' \
		env MAKEFLAGS='$$(filter-out --jobserver-%,$$(MAKEFLAGS))' \
		make BUILD_DIR='$$($1_BUILD)' CONFIG='$$($1_CONFIG)' \
		-C /src $$(@:$2-%=container-%) \
	)
$2-clean:
	rm --force --recursive '$$($1_BUILD)' '$$($1_CONFIG)'
endef

# For completion.
docker-build docker-config docker-clean podman-config podman-build podman-clean:

$(eval $(call container_rules,DOCKER,docker,--user "$$$$UID:$$$$GID",))
$(eval $(call container_rules,PODMAN,podman,,docker.io/))
