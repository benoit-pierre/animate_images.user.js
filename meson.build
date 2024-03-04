project(
  'animate_images.user.js',
  'c',
  version: '1.0.5',
  meson_version: '>=0.64',
  default_options: [
    'b_lto=true',
    'buildtype=minsize',
    'debug=false',
    'default_library=static',
    'warning_level=2',
    'wrap_mode=forcefallback',
  ],
)

fs = import('fs')

cflags = '''
-fno-exceptions
-s STRICT=1
'''.split()

ldflags = '''
--closure=1
--emit-symbol-map
--no-entry
-s ALLOW_MEMORY_GROWTH=1
-s ASSERTIONS=0
-s AUTO_JS_LIBRARIES=0
-s AUTO_NATIVE_LIBRARIES=0
-s DYNAMIC_EXECUTION=0
-s ENVIRONMENT=web
-s EXPORTED_FUNCTIONS=['_malloc','_free']
-s EXPORT_NAME=WebPModule
-s FILESYSTEM=0
-s INITIAL_MEMORY=4MB
-s MALLOC=emmalloc
-s MODULARIZE=1
-s SINGLE_FILE=1
-s STACK_SIZE=8kb
-s SUPPORT_ERRNO=0
-s SUPPORT_LONGJMP=0
-s USE_ES6_IMPORT_META=0
'''.split()

if get_option('wasm')
  ldflags += '''
  -s WASM=1
  -s WASM_BIGINT=1
  '''.split()
else
  ldflags += '''
  -s WASM=0
  '''.split()
endif

ldflags += {
  'plain': [],
  '0': '-O0',
  '1': '-O1',
  '2': '-O2',
  '3': '-O3',
  'g': '-Og',
  's': '-Oz',
}[get_option('optimization')]

add_global_arguments(cflags, language: 'c')
add_global_link_arguments(cflags + ldflags, language: 'c')

formats_list = []
formats_support = {}

helpers_deps = []
helpers_srcs = []

foreach _spec : [
  ['GIF', 'libnsgif', 'libnsgif'],
  ['WebP', 'libwebp', 'libwebpdemux'],
]
  _name = _spec[0]
  _prj = _spec[1]
  _dep = _spec[2]
  _fmt = _name.to_lower()
  _supported = get_option(_fmt)
  if _supported
    subproject(_prj)
    helpers_deps += dependency(_dep)
    helpers_srcs += 'helpers_@0@.c'.format(_fmt)
  endif
  formats_list += _supported ? [_name] : []
  formats_support += {'@0@_SUPPORT'.format(_fmt.to_upper()): _supported.to_string()}
endforeach

entrypoint = fs.copyfile('entrypoint.mjs')

meta = fs.read('script.meta')
foreach _k, _v : {
  'formats': ' & '.join(formats_list),
  'version': meson.project_version(),
}
  meta = meta.replace('${' + _k + '}', _v)
endforeach

formats = configure_file(
  configuration: formats_support,
  input: 'formats.mjs',
  output: 'formats.mjs',
)

helpers = executable(
  'helpers',
  helpers_srcs,
  dependencies: helpers_deps,
  name_suffix: 'mjs',
)

main = fs.copyfile('main.mjs')

script = custom_target(
  'script',
  build_by_default: true,
  command: [
    find_program('esbuild'),
    '--banner:js=' + meta,
    '--outfile=@OUTPUT@',
    '--bundle',
    '--minify',
    '@INPUT0@',
  ],
  input: [
    entrypoint,
    formats,
    helpers,
    main,
  ],
  output: 'animate_images.user.js',
)

lint_files = []
foreach _f : [
  'entrypoint.mjs',
  'formats.mjs',
  'main.mjs',
  'test/test.mjs',
]
  lint_files += meson.project_source_root() / _f
endforeach

run_target(
  'lint',
  command: [
    find_program('eslint', disabler: true, required: false),
    lint_files,
  ],
)

run_target(
  'serve',
  command: [
    find_program('miniserve', disabler: true, required: false),
    '--index=test.html', meson.project_source_root() / 'test',
  ],
  depends: [
    helpers,
    main,
  ],
)

summary(
  {
    'GIF': get_option('gif'),
    'WebP': get_option('webp'),
  },
  bool_yn: true,
  section: 'Image formats',
)

summary(
  {
    'WebAssembly': get_option('wasm'),
  },
  bool_yn: true,
  section: 'Output options',
)
