import http from 'http'
import https from 'https'
import { URL } from 'url'

const PORT = process.env.PORT || 3000

// Youdao dictionary TTS — real MP3, no auth required, works in China
// type=1: American English, type=2: Chinese Mandarin
function fetchAudio(text) {
  return new Promise((resolve, reject) => {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`
    const req = https.get(url, {
      headers: {
        'Referer': 'https://dict.youdao.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Upstream ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost`)
  const text = url.searchParams.get('text')

  if (!text) { res.writeHead(400); res.end('Missing ?text='); return }

  // Strip punctuation Youdao can't handle
  const clean = text.replace(/[。，、！？；：""''「」【】《》\.\,\!\?\;\:]/g, '').trim()
  if (!clean) { res.writeHead(400); res.end('Empty text'); return }

  try {
    const audio = await fetchAudio(clean)
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
