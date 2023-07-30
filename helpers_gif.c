#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "nsgif.h"


typedef struct
{
    nsgif_t        *gif;
    int             frame_count;
    int             frame_index;
    nsgif_bitmap_t *frame_bitmap;
    uint8_t         data[];

} gif_reader_t;


#define XCALL(Reader, Fn, ...) \
    ({ nsgif_error err__ = nsgif_##Fn((Reader)->gif, ## __VA_ARGS__); \
     NSGIF_OK == err__ ? 0 : (emscripten_throw_string(nsgif_strerror(err__)), 1); })

#define INFO(Reader, Field)  nsgif_get_info((Reader)->gif)->Field


static void *_bitmap_create(int width, int height)
{
    return calloc(width * height, 4);
}

static void _bitmap_destroy(void *bitmap)
{
    free(bitmap);
}

static unsigned char *_bitmap_get_buffer(void *bitmap)
{
    return bitmap;
}

static const nsgif_bitmap_cb_vt _bitmap_callbacks =
{
    _bitmap_create,
    _bitmap_destroy,
    _bitmap_get_buffer,
    NULL,
    NULL,
    NULL,
    NULL,
};


EMSCRIPTEN_KEEPALIVE
gif_reader_t *gif_reader_create(uint8_t *data, size_t data_size)
{
    const char   *err_str;
    gif_reader_t *reader;
    nsgif_error   err;

    err_str = NULL;

    reader = malloc(sizeof (gif_reader_t) + data_size);
    if (NULL == reader)
    {
        err_str = "reader allocation failed";
        goto err_1;
    }

    err = nsgif_create(&_bitmap_callbacks, NSGIF_BITMAP_FMT_R8G8B8A8, &reader->gif);
    if (NSGIF_OK != err)
        goto err_2;

    memcpy(reader->data, data, data_size);

    err = nsgif_data_scan(reader->gif, data_size, data);
    if (NSGIF_OK != err && NSGIF_ERR_END_OF_DATA != err)
        goto err_3;

    reader->frame_count = (int)INFO(reader, frame_count);
    assert(reader->frame_count >= 0);
    if (!reader->frame_count)
    {
        err_str = "gif has no frame";
        goto err_3;
    }

    reader->frame_index = -1;
    reader->frame_bitmap = NULL;

    return reader;

err_3:
    nsgif_destroy(reader->gif);
err_2:
    free(reader);
err_1:
    emscripten_throw_string(err_str == NULL ? err_str : nsgif_strerror(err));
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
void gif_reader_destroy(gif_reader_t *reader)
{
    nsgif_destroy(reader->gif);
    free(reader);
}

EMSCRIPTEN_KEEPALIVE
uint32_t gif_reader_canvas_width(const gif_reader_t *reader)
{
    return INFO(reader, width);
}

EMSCRIPTEN_KEEPALIVE
uint32_t gif_reader_canvas_height(const gif_reader_t *reader)
{
    return INFO(reader, height);
}

EMSCRIPTEN_KEEPALIVE
uint32_t gif_reader_frame_count(const gif_reader_t *reader)
{
    return reader->frame_count;
}

EMSCRIPTEN_KEEPALIVE
uint32_t gif_reader_loop_count(const gif_reader_t *reader)
{
    return INFO(reader, loop_max);
}

EMSCRIPTEN_KEEPALIVE
void gif_reader_rewind(gif_reader_t *reader)
{
    if (XCALL(reader, reset))
        return;
    reader->frame_index = -1;
}

EMSCRIPTEN_KEEPALIVE
void gif_reader_decode_next_frame(gif_reader_t *reader)
{
    if (++reader->frame_index == reader->frame_count)
    {
       if (XCALL(reader, reset))
           return;
       reader->frame_index = 0;
    }

    XCALL(reader, frame_decode, reader->frame_index, &reader->frame_bitmap);
}

EMSCRIPTEN_KEEPALIVE
int gif_reader_frame_index(const gif_reader_t *reader)
{
    return reader->frame_index;
}

EMSCRIPTEN_KEEPALIVE
int gif_reader_frame_duration(const gif_reader_t *reader)
{
    uint32_t delay;

    delay = nsgif_get_frame_info(reader->gif, reader->frame_index)->delay;

    return delay > INT32_MAX ? INT32_MAX : delay * 10;
}

EMSCRIPTEN_KEEPALIVE
const uint8_t *gif_reader_frame_rgba(const gif_reader_t *reader)
{
    return reader->frame_bitmap;
}
