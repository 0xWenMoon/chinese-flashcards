import WebSocket from 'ws'
import http from 'http'
import { URL } from 'url'
import { PassThrough } from 'stream'

const PORT = process.env.PORT || 3000
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const VOICE = 'zh-CN-XiaoxiaoNeural'

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function ts() { return new Date().toISOString() }

function buildSsml(text, voice) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voice}'><prosody rate='-5%' pitch='+0Hz'>${escaped}</prosody></voice></speak>`
}

function synthesize(text, voice) {
  return new Promise((resolve, reject) => {
    const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}&ConnectionId=${uid()}`

    const ws = new WebSocket(wssUrl, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })

    const chunks = []
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error('TTS timeout')) }, 10000)

    ws.on('open', () => {
      ws.send(
        `X-Timestamp:${ts()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      )
      ws.send(
        `X-RequestId:${uid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts()}\r\nPath:ssml\r\n\r\n` +
        buildSsml(text, voice)
      )
    })

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Find \r\n\r\n separator between header and audio
        for (let i = 0; i < data.length - 3; i++) {
          if (data[i] === 13 && data[i+1] === 10 && data[i+2] === 13 && data[i+3] === 10) {
            const header = data.slice(0, i).toString()
            if (header.includes('Path:audio')) chunks.push(data.slice(i + 4))
            break
          }
        }
      } else {
        const msg = data.toString()
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout)
          ws.close()
          resolve(Buffer.concat(chunks))
        }
      }
    })

    ws.on('error', (e) => { clearTimeout(timeout); reject(e) })
    ws.on('close', (code) => {
      if (chunks.length === 0) { clearTimeout(timeout); reject(new Error(`WS closed: ${code}`)) }
    })
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost`)
  const text = url.searchParams.get('text')
  const voice = url.searchParams.get('voice') || VOICE

  if (!text) { res.writeHead(400); res.end('Missing ?text='); return }

  try {
    const audio = await synthesize(text, voice)
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': audio.length,
    })
    res.end(audio)
  } catch (e) {
    console.error('TTS error:', e.message)
    res.writeHead(500); res.end('TTS error: ' + e.message)
  }
})

server.listen(PORT, () => console.log(`TTS server on port ${PORT}`))
