import os
import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
from faster_whisper import WhisperModel
import imageio_ffmpeg

# Setup ffmpeg in PATH
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = os.path.dirname(ffmpeg_exe)
if ffmpeg_dir not in os.environ['PATH']:
    os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ['PATH']

VIDEOS = [
    {
        "id": "qrF0dlei5Pg",
        "title": "MidiShift Tutorial! Double your MIDI devices",
        "url": "https://www.youtube.com/watch?v=qrF0dlei5Pg"
    },
    {
        "id": "J5rELr1MsK8",
        "title": "How to connect multiple apps to one Midi device!!",
        "url": "https://www.youtube.com/watch?v=J5rELr1MsK8"
    },
    {
        "id": "4EUFJPWb7Ys",
        "title": "MidiView tutorial. Free MidiMonitor software!",
        "url": "https://www.youtube.com/watch?v=4EUFJPWb7Ys"
    }
]

DATA_DIR = os.path.join(os.getcwd(), "video_transcripts")
os.makedirs(DATA_DIR, exist_ok=True)

# 1. Fetch YT subtitles properly
ytt = YouTubeTranscriptApi()
for v in VIDEOS:
    vid = v["id"]
    sub_path = os.path.join(DATA_DIR, f"{vid}_subtitles_yt.json")
    txt_path = os.path.join(DATA_DIR, f"{vid}_subtitles_yt.txt")
    print(f"\n[Subtitles] Extracting YT subtitles for {vid} ({v['title']})...")
    try:
        t_list = ytt.list(vid)
        transcript = None
        for t in t_list:
            if t.language_code.startswith("en"):
                transcript = t.fetch()
                break
        if not transcript:
            for t in t_list:
                transcript = t.fetch()
                break
        
        snippets_data = []
        text_lines = []
        for snippet in transcript:
            # snippet has .start, .duration, .text
            start = snippet.start
            dur = snippet.duration
            text = snippet.text
            mins = int(start // 60)
            secs = int(start % 60)
            snippets_data.append({
                "start": start,
                "duration": dur,
                "text": text
            })
            text_lines.append(f"[{mins:02d}:{secs:02d}] {text}")
            
        with open(sub_path, "w", encoding="utf-8") as f:
            json.dump(snippets_data, f, indent=2, ensure_ascii=False)
            
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(text_lines))
            
        print(f" -> OK: {len(text_lines)} lineas guardadas en {txt_path}")
    except Exception as e:
        print(f" -> ERROR en subtitulos de {vid}: {e}")

# 2. Transcribe using faster-whisper (model medium.en already cached)
model_path = r"D:\huggingface_cache\hub\models--Systran--faster-whisper-medium.en\snapshots\a29b04bd15381511a9af671baec01072039215e3"
print(f"\n[Whisper] Cargando modelo Whisper medium.en desde {model_path}...")
model = WhisperModel(model_path, device="cpu", compute_type="int8")
print("[Whisper] Modelo cargado con exito!")

for v in VIDEOS:
    vid = v["id"]
    audio_path = os.path.join(DATA_DIR, f"{vid}.mp3")
    whisper_json_path = os.path.join(DATA_DIR, f"{vid}_whisper_medium.json")
    whisper_txt_path = os.path.join(DATA_DIR, f"{vid}_whisper_medium.txt")
    
    if os.path.exists(whisper_txt_path) and os.path.getsize(whisper_txt_path) > 100:
        print(f"\n[Whisper] Ya existe transcripcion para {vid}. Omitiendo.")
        continue
        
    print(f"\n[Whisper] Transcribiendo {vid} ({v['title']})...")
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        word_timestamps=False,
        language="en",
        condition_on_previous_text=True
    )
    
    seg_list = []
    text_lines = []
    for seg in segments:
        mins = int(seg.start // 60)
        secs = int(seg.start % 60)
        line = f"[{mins:02d}:{secs:02d}] {seg.text.strip()}"
        text_lines.append(line)
        seg_list.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip()
        })
        print(f"  {line}")
        
    with open(whisper_json_path, "w", encoding="utf-8") as f:
        json.dump(seg_list, f, indent=2, ensure_ascii=False)
        
    with open(whisper_txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(text_lines))
        
    print(f" -> OK: Transcripcion de Whisper guardada en {whisper_txt_path}")

print("\n=== COMPLETADO EXITOSAMENTE ===")
