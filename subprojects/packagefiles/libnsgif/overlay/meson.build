project(
  'libnsgif',
  'c',
  version: '0.2.1',
)

nsgif_lib = library(
  'nsgif',
  [
    'src/gif.c',
    'src/lzw.c',
  ],
  gnu_symbol_visibility: 'hidden',
  include_directories: include_directories('include'),
  install: true,
)

libnsgif_dep = declare_dependency(
  include_directories: include_directories('include'),
  link_with: nsgif_lib,
)

meson.override_dependency('libnsgif', libnsgif_dep)
