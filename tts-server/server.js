import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import http from 'http'
import { URL } from 'url'

const PORT = process.env.PORT || 3000
const VOICE = 'zh-CN-XiaoxiaoNeural'

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost`)
  const text = url.searchParams.get('text')

  if (!text) { res.writeHead(400); res.end('Missing ?text='); return }

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audio } = tts.toStream(text)

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    })

    audio.pipe(res)
    audio.on('error', () => { res.end() })
  } catch (e) {
    console.error(e)
    res.writeHead(500); res.end('TTS error')
  }
})

server.listen(PORT, () => console.log(`TTS server on port ${PORT}`))
