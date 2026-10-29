// Narration, one clip per scene, with a start/end time for every word so captions and animations can follow the voice.
// Uses ElevenLabs when ELEVENLABS_API_KEY is set (a calm female voice, slightly slowed); otherwise a macOS `say` stand-in with estimated word times.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = `${ROOT}public/voice/`;
const MANIFEST = `${ROOT}src/voice.json`;
const narration = JSON.parse(await readFile(`${ROOT}src/narration.json`, "utf8"));

const KEY = process.env.ELEVENLABS_API_KEY?.trim();
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.05, use_speaker_boost: true, speed: 0.9 };
const SAY_VOICE = process.env.SAY_VOICE ?? "Samantha";
const SAY_RATE = process.env.SAY_RATE ?? "150";
/** Extra silence after each sentence, so the stand-in voice doesn't rush. */
const SENTENCE_PAUSE_MS = 300;
const provider = KEY ? "elevenlabs" : "say";

/** Caption words, the spoken text, and where each caption word sits in the spoken text. */
function spoken(text) {
  const words = text.split(/\s+/).filter(Boolean);
  let out = "";
  const spans = words.map((w) => {
    const [, core, tail] = w.match(/^(.*?)([.,:;!?]*)$/);
    const say = (narration.say[core] ?? core) + tail;
    const start = out.length + (out ? 1 : 0);
    out += (out ? " " : "") + say;
    return { text: w, start, end: out.length };
  });
  return { words, text: out, spans };
}

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function wavSeconds(buf) {
  let byteRate = 0;
  for (let i = 12; i < buf.length - 8; ) {
    const id = buf.toString("ascii", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(i + 16);
    if (id === "data") return size / byteRate;
    i += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in WAV");
}

/** Spreads the clip over the words by length, with longer pauses after punctuation. */
function estimateWords(spans, seconds) {
  const lead = 0.15;
  const ends = (s, i) => i < spans.length - 1 && /[.!?]$/.test(s.text);
  const weight = (s) => s.end - s.start + 1 + (/[.!?]$/.test(s.text) ? 9 : /[,:;]$/.test(s.text) ? 5 : 0);
  const total = spans.reduce((n, s) => n + weight(s), 0);
  const pause = SENTENCE_PAUSE_MS / 1000;
  const pauses = spans.filter(ends).length * pause;
  let t = lead;
  const per = (seconds - lead - 0.2 - pauses) / total;
  return spans.map((s, i) => {
    const start = t;
    const end = t + (s.end - s.start + 1) * per;
    t += weight(s) * per + (ends(s, i) ? pause : 0);
    return { text: s.text, start: +start.toFixed(3), end: +end.toFixed(3) };
  });
}

async function eleven(scene, sp, i) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text: sp.text,
      model_id: MODEL,
      voice_settings: SETTINGS,
      previous_text: i > 0 ? spoken(narration.scenes[i - 1].text).text : undefined,
      next_text: i < narration.scenes.length - 1 ? spoken(narration.scenes[i + 1].text).text : undefined,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const audio = Buffer.from(body.audio_base64, "base64");
  const { character_start_times_seconds: starts, character_end_times_seconds: ends } = body.alignment;
  const words = sp.spans.map((s) => ({ text: s.text, start: starts[s.start], end: ends[s.end - 1] }));
  const seconds = Math.max(ends.at(-1) + 0.15, (audio.length * 8) / 128_000);
  return { audio, ext: "mp3", seconds, words };
}

function macSay(scene, sp, file) {
  const text = sp.text.replace(/([.!?])\s+/g, `$1 [[slnc ${SENTENCE_PAUSE_MS}]] `);
  execFileSync("say", ["-v", SAY_VOICE, "-r", SAY_RATE, "-o", file, "--file-format=WAVE", "--data-format=LEI16@44100", text]);
}

await mkdir(OUT, { recursive: true });
const previous = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : { scenes: [] };
const voiceLabel = provider === "elevenlabs" ? `ElevenLabs ${MODEL} · voice ${VOICE_ID}` : `macOS say · ${SAY_VOICE} · rate ${SAY_RATE} · ${SENTENCE_PAUSE_MS} ms between sentences (stand-in)`;
console.log(`Voice: ${voiceLabel}`);

const scenes = [];
for (const [i, scene] of narration.scenes.entries()) {
  const sp = spoken(scene.text);
  const name = `${String(i + 1).padStart(2, "0")}-${scene.id}`;
  const key = hash(`${voiceLabel}|${JSON.stringify(SETTINGS)}|${sp.text}`);
  const old = previous.scenes.find((s) => s.id === scene.id);
  if (old?.key === key && existsSync(`${ROOT}public/${old.file}`)) {
    scenes.push(old);
    console.log(`  = ${name} (unchanged)`);
    continue;
  }
  for (const ext of ["mp3", "wav"]) await rm(`${OUT}${name}.${ext}`, { force: true });

  let entry;
  if (provider === "elevenlabs") {
    const r = await eleven(scene, sp, i);
    await writeFile(`${OUT}${name}.${r.ext}`, r.audio);
    entry = { file: `voice/${name}.${r.ext}`, seconds: +r.seconds.toFixed(3), words: r.words };
  } else {
    const file = `${OUT}${name}.wav`;
    macSay(scene, sp, file);
    const seconds = wavSeconds(await readFile(file));
    entry = { file: `voice/${name}.wav`, seconds: +seconds.toFixed(3), words: estimateWords(sp.spans, seconds) };
  }
  scenes.push({ id: scene.id, key, ...entry });
  console.log(`  ✓ ${name} ${entry.seconds.toFixed(1)}s`);
}

await writeFile(MANIFEST, `${JSON.stringify({ provider, voice: voiceLabel, scenes }, null, 1)}\n`);
const total = scenes.reduce((n, s) => n + s.seconds, 0);
console.log(`Wrote src/voice.json · ${scenes.length} clips · ${total.toFixed(1)}s of speech`);
