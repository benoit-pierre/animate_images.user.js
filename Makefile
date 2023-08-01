.DEFAULT: all
.PHONY: all clean dist-clean fetch-thirdparty helpers lint re setup serve script

BUILD_DIR  ?= build
BUILD_INFO := $(BUILD_DIR)/meson-info/intro-buildoptions.json

USER_MK ?= user.mk

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

# Programs.
MESON_WITH_ENV = env AR='$(EMAR)' CC='$(strip $(CCACHE) $(EMCC))' STRIP='$(EMSTRIP)' $(MESON)

all: script

clean:
	rm --force --recursive $(BUILD_DIR)

dist-clean:
	-rm --force --recursive $(wildcard user.mk user-*.mk build/ build-*/ $(patsubst %.wrap,%/,$(wildcard subprojects/*.wrap)))

fetch-thirdparty:
	$(MESON) subprojects download --num-processes 3

re: clean
	@$(MAKE) --no-print-directory all

setup: $(BUILD_INFO)

$(BUILD_INFO):
	$(MESON_WITH_ENV) setup --cross-file=/dev/null -Dgif='$(GIF)' -Dwebp='$(WEBP)' -Dwasm='$(WASM)' $(BUILD_DIR)

helpers lint script serve: $(BUILD_INFO)
	$(MESON_WITH_ENV) compile -C $(BUILD_DIR) -v $@

$(USER_MK): Makefile
	printf '%s\n' \
		'# Programs.' \
		'CCACHE  ?= $(call find_program,CCACHE,ccache,sccache,env)' \
		'EMAR    ?= $(call find_program,EMAR,emar)' \
		'EMCC    ?= $(call find_program,EMCC,emcc)' \
		'EMSTRIP ?= $(call find_program,EMSTRIP,emstrip)' \
		'MESON   ?= $(call find_program,MESON,meson)' \
		'# Image formats.' \
		'GIF  ?= $(or $(GIF),true)' \
		'WEBP ?= $(or $(WEBP),true)' \
		'# Output options.' \
		'WASM ?= $(or $(WASM),true)' \
		>$@

ifeq (,$(filter clean %-clean %-build,$(MAKECMDGOALS)))
include $(USER_MK)
endif

# Containers support.

.PHONY: container-build docker-build docker-clean podman-build podman-clean

define container_run
$(strip $(call find_program,$1,$2) run --mount type=bind,source='$(CURDIR),target=/src' \
	--interactive --rm --tty $3 '$4emscripten/emsdk$(EMSDK_VERSION:%=:%)' \
	env MAKEFLAGS='$(filter-out --jobserver-%,$(MAKEFLAGS))' \
	make BUILD_DIR='$($1_BUILD)' USER_MK='$($1_USER_MK)' \
	-C /src container-build \
	)
endef

container-build:
	npm config set prefix='~/.local/' update-notifier=false
	npm install --global --no-audit 'esbuild$(ESBUILD_VERSION:%=@%)'
	python3 -m pip install --no-warn-script-location --user 'meson$(MESON_VERSION:%===%)' 'ninja$(NINJA_VERSION:%===%)'
	env PATH="$$HOME/.local/bin:$$PATH" $(MAKE) all

DOCKER_BUILD   ?= build-docker
DOCKER_USER_MK ?= user-docker.mk

docker-build:
	$(call container_run,DOCKER,docker,--user "$$UID:$$GID",)

docker-clean:
	rm --force --recursive '$(DOCKER_BUILD)' '$(DOCKER_USER_MK)'

PODMAN_BUILD   ?= build-podman
PODMAN_USER_MK ?= user-podman.mk

podman-build:
	$(call container_run,PODMAN,podman,,docker.io/)

podman-clean:
	rm --force --recursive '$(PODMAN_BUILD)' '$(PODMAN_USER_MK)'
