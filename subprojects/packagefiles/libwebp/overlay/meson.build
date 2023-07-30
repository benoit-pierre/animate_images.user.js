project(
  'libwebp',
  'c',
  version: '1.3.1',
)

cc = meson.get_compiler('c')

webp_lib = library(
  'webp',
  [
    'src/dec/alpha_dec.c',
    'src/dec/buffer_dec.c',
    'src/dec/frame_dec.c',
    'src/dec/io_dec.c',
    'src/dec/quant_dec.c',
    'src/dec/tree_dec.c',
    'src/dec/vp8_dec.c',
    'src/dec/vp8l_dec.c',
    'src/dec/webp_dec.c',
    'src/demux/anim_decode.c',
    'src/demux/demux.c',
    'src/dsp/alpha_processing.c',
    # 'src/dsp/alpha_processing_neon.c',
    # 'src/dsp/alpha_processing_sse2.c',
    # 'src/dsp/alpha_processing_sse41.c',
    'src/dsp/cpu.c',
    'src/dsp/dec.c',
    # 'src/dsp/dec_neon.c',
    # 'src/dsp/dec_sse2.c',
    # 'src/dsp/dec_sse41.c',
    'src/dsp/dec_clip_tables.c',
    # 'src/dsp/dec_neon.c',
    'src/dsp/filters.c',
    # 'src/dsp/filters_neon.c',
    # 'src/dsp/filters_sse2.c',
    'src/dsp/lossless.c',
    # 'src/dsp/lossless_neon.c',
    # 'src/dsp/lossless_sse2.c',
    # 'src/dsp/lossless_sse41.c',
    'src/dsp/upsampling.c',
    # 'src/dsp/upsampling_neon.c',
    # 'src/dsp/upsampling_sse2.c',
    # 'src/dsp/upsampling_sse41.c',
    'src/dsp/yuv.c',
    # 'src/dsp/yuv_neon.c',
    # 'src/dsp/yuv_sse2.c',
    # 'src/dsp/yuv_sse41.c',
    'src/utils/bit_reader_utils.c',
    'src/utils/color_cache_utils.c',
    'src/utils/huffman_utils.c',
    'src/utils/quant_levels_dec_utils.c',
    'src/utils/random_utils.c',
    'src/utils/thread_utils.c',
    'src/utils/utils.c',
  ],
  c_args: [
    '-DEMSCRIPTEN',
    # '-DWEBP_HAVE_NEON',
    # '-DWEBP_HAVE_SSE2',
    # '-DWEBP_HAVE_SSE41',
    '-DWEBP_REDUCE_CSP=1',
    '-DWEBP_REDUCE_SIZE=1',
  ],
  gnu_symbol_visibility: 'hidden',
)

libwebp_dep = declare_dependency(
  include_directories: include_directories('src'),
  link_with: webp_lib,
)

meson.override_dependency('libwebpdemux', libwebp_dep)
