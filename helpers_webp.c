#include <assert.h>
#include <stdlib.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "webp/decode.h"
#include "webp/demux.h"


typedef struct
{
    WebPAnimInfo     anim_info;
    WebPData         webp_data;
    WebPAnimDecoder *decoder;
    int              frame_index;
    uint8_t         *frame_rgba;
    int              frame_timestamp;
    int              prev_frame_timestamp;
} webp_reader_t;


EMSCRIPTEN_KEEPALIVE
webp_reader_t *webp_reader_create(const uint8_t *data, size_t data_size)
{
    WebPAnimDecoderOptions  decoder_options;
    const char             *err_str;
    webp_reader_t          *reader;

    reader = malloc(sizeof (webp_reader_t));
    if (NULL == reader)
    {
        err_str = "reader allocation failed";
        goto err_1;
    }

    WebPDataInit(&reader->webp_data);
    reader->webp_data.bytes = data;
    reader->webp_data.size = data_size;

    if (!WebPAnimDecoderOptionsInit(&decoder_options))
    {
        err_str = "decoder options initialization failed";
        goto err_2;
    }

    decoder_options.color_mode = MODE_RGBA;
    decoder_options.use_threads = 0;

    reader->decoder = WebPAnimDecoderNew(&reader->webp_data, &decoder_options);
    if (NULL == reader->decoder)
    {
        err_str = "decoder creation failed";
        goto err_2;
    }

    if (!WebPAnimDecoderGetInfo(reader->decoder, &reader->anim_info))
    {
        err_str = "failed to get animation info";
        goto err_3;
    }

    reader->frame_index = -1;
    reader->frame_rgba = NULL;
    reader->frame_timestamp = -1;
    reader->prev_frame_timestamp = 0;

    return reader;

err_3:
    WebPAnimDecoderDelete(reader->decoder);
err_2:
    free(reader);
err_1:
    emscripten_throw_string(err_str);
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
void webp_reader_destroy(webp_reader_t *reader)
{
    WebPAnimDecoderDelete(reader->decoder);
    free(reader);
}

EMSCRIPTEN_KEEPALIVE
uint32_t webp_reader_canvas_width(const webp_reader_t *reader)
{
    return reader->anim_info.canvas_width;
}

EMSCRIPTEN_KEEPALIVE
uint32_t webp_reader_canvas_height(const webp_reader_t *reader)
{
    return reader->anim_info.canvas_height;
}

EMSCRIPTEN_KEEPALIVE
uint32_t webp_reader_frame_count(const webp_reader_t *reader)
{
    return reader->anim_info.frame_count;
}

EMSCRIPTEN_KEEPALIVE
uint32_t webp_reader_loop_count(const webp_reader_t *reader)
{
    return reader->anim_info.loop_count;
}

EMSCRIPTEN_KEEPALIVE
void webp_reader_rewind(webp_reader_t *reader)
{
    reader->frame_index = -1;
    reader->frame_rgba = NULL;
    reader->frame_timestamp = -1;
    reader->prev_frame_timestamp = 0;
    WebPAnimDecoderReset(reader->decoder);
}

EMSCRIPTEN_KEEPALIVE
void webp_reader_decode_next_frame(webp_reader_t *reader)
{
    reader->prev_frame_timestamp = reader->frame_timestamp;
    assert(-1 <= reader->frame_index && reader->frame_index < (int)reader->anim_info.frame_count);
    if (++reader->frame_index == reader->anim_info.frame_count)
    {
        webp_reader_rewind(reader);
        reader->frame_index = 0;
    }
    if (!WebPAnimDecoderGetNext(reader->decoder, &reader->frame_rgba, &reader->frame_timestamp))
    {
        reader->frame_rgba = NULL;
        reader->frame_timestamp = 0;
        emscripten_throw_string("failed to decode next frame");
    }
}

EMSCRIPTEN_KEEPALIVE
int webp_reader_frame_index(const webp_reader_t *reader)
{
    return reader->frame_index;
}

EMSCRIPTEN_KEEPALIVE
int webp_reader_frame_duration(const webp_reader_t *reader)
{
    return reader->frame_timestamp - reader->prev_frame_timestamp;
}

EMSCRIPTEN_KEEPALIVE
const uint8_t *webp_reader_frame_rgba(const webp_reader_t *reader)
{
    return reader->frame_rgba;
}
