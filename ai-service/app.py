import os
import sys
import shutil
import tempfile

# 🌟 终极免死金牌：对 Windows GBK 终端的 stdout/stderr 编码冲突进行安全重设，
# 采用 'replace' 机制彻底免除任何 Unicode 字符（如音乐文件名中的表情 🐯 等）导致的 print 崩溃！
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(errors='replace')
    except Exception:
        pass

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import torch
import torchaudio
import numpy as np
import re

# Initialize FastAPI app
app = FastAPI(
    title="KiomPlayer AI Transcription & Forced Alignment Service",
    description="High-performance ASR + Word-level Forced Alignment service utilizing faster-whisper and Wav2Vec2",
    version="1.0.0"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for caching Whisper & PyTorch models
whisper_model = None
align_model = None
align_bundle = None

# Model default configs
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "large-v3")  # options: tiny, base, small, medium, large-v3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

def parse_lrc(lrc_content: str):
    """
    Parses standard LRC timestamps [mm:ss.xx] and returns a list of sorted (start_time, text) tuples.
    """
    lines = []
    # Pattern: [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
    pattern = re.compile(r'\[(\d+):(\d+)(?:[.:](\d+))?\](.*)')
    for line in lrc_content.splitlines():
        line = line.strip()
        match = pattern.match(line)
        if match:
            try:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                milliseconds = int(match.group(3)) if match.group(3) else 0
                
                # Format milliseconds standard length
                if match.group(3):
                    ms_str = match.group(3)
                    if len(ms_str) == 2:
                        milliseconds *= 10
                    elif len(ms_str) == 1:
                        milliseconds *= 100
                        
                time_in_seconds = minutes * 60 + seconds + milliseconds / 1000.0
                text = match.group(4).strip()
                
                # Filter out standard metadata tags
                if text and not any(text.lower().startswith(meta) for meta in ['ti:', 'ar:', 'al:', 'by:', 'offset:']):
                    lines.append((time_in_seconds, text))
            except Exception:
                continue
                
    lines.sort(key=lambda x: x[0])
    return lines

def parse_word_level_lrc(lrc_content: str):
    """
    Parses advanced word-level (syllable-level) enriched LRC/QRC-like lyrics.
    Extracts high-fidelity word-level timestamps directly if they exist.
    """
    # 1. Heuristically check if this is indeed a word-level LRC
    is_word_level = False
    for line in lrc_content.splitlines():
        brackets = re.findall(r'\[\d+:\d+(?:\.\d+)?\]', line)
        if len(brackets) >= 2:
            is_word_level = True
            break
            
    if not is_word_level:
        return None
        
    print("[ASR 引导对齐] 检测到极品内嵌逐字卡拉OK级歌词！正在直接免推理提取内嵌时间戳...")
    
    lyrics_data = []
    pattern = re.compile(r'\[(\d+):(\d+)(?:[.:](\d+))?\]')
    
    for line in lrc_content.splitlines():
        line = line.strip()
        if not line.startswith('['):
            continue
            
        matches = list(pattern.finditer(line))
        if not matches:
            continue
            
        # Filter out metadata lines like [ti:Title]
        first_text = line[matches[0].end():]
        if any(first_text.lower().startswith(meta) for meta in ['ti:', 'ar:', 'al:', 'by:', 'offset:']):
            continue
            
        syllables = []
        line_start_time = None
        
        for i in range(len(matches)):
            # Parse minutes, seconds, milliseconds
            minutes = int(matches[i].group(1))
            seconds = int(matches[i].group(2))
            milliseconds = int(matches[i].group(3)) if matches[i].group(3) else 0
            
            if matches[i].group(3):
                ms_str = matches[i].group(3)
                if len(ms_str) == 2:
                    milliseconds *= 10
                elif len(ms_str) == 1:
                    milliseconds *= 100
                    
            current_time = minutes * 60 + seconds + milliseconds / 1000.0
            
            if i == 0:
                line_start_time = current_time
                
            text_start = matches[i].end()
            text_end = matches[i+1].start() if i + 1 < len(matches) else len(line)
            word = line[text_start:text_end].strip()
            
            if word:
                syllables.append({
                    "time": round(current_time, 2),
                    "text": word
                })
                
        if syllables:
            full_text = "".join([s["text"] for s in syllables])
            lyrics_data.append({
                "time": round(line_start_time, 2),
                "text": full_text,
                "syllables": syllables
            })
            
    print(f"[ASR 引导对齐] 成功从内嵌歌词中无缝解析 {len(lyrics_data)} 个极品逐字卡拉OK段落！")
    return lyrics_data

def load_whisper():
    global whisper_model
    if whisper_model is None:
        print(f"Loading faster-whisper model '{WHISPER_MODEL_SIZE}' on device '{DEVICE}'...")
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return whisper_model

def get_uniform_syllables(text: str, start_time: float, end_time: float):
    """
    Fallback method: Uniformly split text into characters (Chinese/Japanese) or words (English)
    to generate highly reliable syllables with pseudo-timestamps.
    """
    duration = max(0.1, end_time - start_time)
    
    # Simple language segmentation heuristic: English/Latin words are space-separated
    words = []
    # If the text has spaces, treat it as space-separated words (e.g. English)
    if " " in text.strip():
        words = text.split()
    else:
        # Otherwise treat as CJK character sequence
        words = list(text.strip())
        
    if not words:
        return []
        
    num_words = len(words)
    time_per_word = duration / num_words
    
    syllables = []
    for i, w in enumerate(words):
        w_time = start_time + (i * time_per_word)
        syllables.append({
            "time": round(w_time, 2),
            "text": w
        })
    return syllables

def perform_forced_alignment(audio_path: str, text: str, start_time: float, end_time: float):
    """
    Advanced CTC Alignment using torchaudio & Wav2Vec2 with automatic high-precision
    Chinese Pinyin phonetic mapping to solve Wav2Vec2 vocabulary constraints.
    """
    global align_model, align_bundle
    
    # 🌟 终极纯净防护：自动擦除行内任何可能残留的类似 [00:15.30] 的逐字卡拉OK时间戳符号干扰，确保纯文字高精度对齐！
    text = re.sub(r'\[\d+:\d+(?:\.\d+)?\]', '', text)
    if not text.strip():
        return get_uniform_syllables(text, start_time, end_time)
        
    try:
        # Lazy loading torchaudio alignment pipeline on CPU to ensure 100% stability against CUDA/cuDNN DLL conflicts
        ALIGN_DEVICE = "cpu"
        
        if align_model is None:
            print("[ASR 引导对齐] Loading torchaudio Wav2Vec2 CTC alignment model on CPU...")
            # Using multi-lingual Wav2Vec2 alignment model bundle
            import torchaudio.pipelines as pipelines
            align_bundle = pipelines.MMS_FA
            align_model = align_bundle.get_model().to(ALIGN_DEVICE)
            align_model.eval()

        # Load specific segment of audio
        waveform, sample_rate = torchaudio.load(audio_path)
        
        # 🌟 强制声道转换：Wav2Vec2 强声学模型只支持单声道 (Mono)，如果是双声道 (Stereo) 会发生张量尺寸冲突，必须在此做降维合并！
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Resample to 16kHz if necessary (Wav2Vec2 FA strictly requires 16k)
        if sample_rate != align_bundle.sample_rate:
            resampler = torchaudio.transforms.Resample(sample_rate, align_bundle.sample_rate).to(ALIGN_DEVICE)
            waveform = resampler(waveform.to(ALIGN_DEVICE))
            sample_rate = align_bundle.sample_rate
            
        # Extract audio chunk matching segment time
        start_frame = int(start_time * sample_rate)
        end_frame = int(end_time * sample_rate)
        
        # Guard rails for clipping
        if start_frame >= waveform.shape[1]:
            return get_uniform_syllables(text, start_time, end_time)
        waveform_chunk = waveform[:, start_frame:min(waveform.shape[1], end_frame)].to(ALIGN_DEVICE)
        
        # 🌟 HIGH-PRECISION PHONETIC MAPPING FOR CHINESE (解决字典查不到汉字的世纪级难题) 🌟
        from pypinyin import pinyin, Style
        
        char_map = []
        for c in text:
            # Check if character is a Chinese Hanzi
            if '\u4e00' <= c <= '\u9fa5':
                py_res = pinyin(c, style=Style.NORMAL)
                py = py_res[0][0] if py_res else ""
                # Keep only pure letters
                py_clean = "".join([ch for ch in py.lower() if ch.isalpha()])
                if py_clean:
                    char_map.append({"char": c, "pinyin": py_clean, "is_chinese": True})
                else:
                    char_map.append({"char": c, "pinyin": "*", "is_chinese": True})
            elif c == " ":
                char_map.append({"char": " ", "pinyin": "|", "is_chinese": False})
            else:
                char_map.append({"char": c, "pinyin": c.lower(), "is_chinese": False})
                
        dictionary = align_bundle.get_dict()
        
        tokens = []
        token_to_char_index = []
        for char_idx, item in enumerate(char_map):
            for letter in item["pinyin"]:
                if letter in dictionary:
                    tokens.append(dictionary[letter])
                    token_to_char_index.append(char_idx)
                    
        if not tokens:
            return get_uniform_syllables(text, start_time, end_time)

        with torch.inference_mode():
            emission, _ = align_model(waveform_chunk)
            
        # Get frame emission indices
        import torchaudio.functional as F
        targets = torch.tensor([tokens], dtype=torch.int, device=ALIGN_DEVICE)
        alignments, scores = F.forced_align(emission, targets, blank=0)
        
        # Decode frames into timings
        alignments = alignments[0] # Single batch
        frames = len(alignments)
        chunk_dur = waveform_chunk.shape[1] / sample_rate
        
        # Back-map frame timings back to character indices with duration tracking
        char_active_frames = {}
        token_idx = 0
        
        for i, align in enumerate(alignments):
            if align.item() > 0:
                if token_idx < len(token_to_char_index):
                    char_idx = token_to_char_index[token_idx]
                    if char_idx not in char_active_frames:
                        char_active_frames[char_idx] = []
                    char_active_frames[char_idx].append(i)
                token_idx += 1
                
        # Generate syllables with high-fidelity linear interpolation fallback
        syllables = []
        for char_idx, item in enumerate(char_map):
            if item["char"] != " ":
                active_frames = char_active_frames.get(char_idx)
                
                if active_frames:
                    # High-precision time from active spectrogram frames
                    c_time = start_time + (active_frames[0] / frames) * chunk_dur
                    c_end = start_time + ((active_frames[-1] + 1) / frames) * chunk_dur
                    # Set elegant safeguard minimum duration of 150ms to ensure smooth transition
                    c_dur = max(0.15, c_end - c_time)
                else:
                    # Search backward for closest aligned time
                    prev_time = start_time
                    for j in range(char_idx - 1, -1, -1):
                        if j in char_active_frames:
                            prev_time = start_time + (char_active_frames[j][0] / frames) * chunk_dur
                            break
                    # Search forward for closest aligned time
                    next_time = end_time
                    for j in range(char_idx + 1, len(char_map)):
                        if j in char_active_frames:
                            next_time = start_time + (char_active_frames[j][0] / frames) * chunk_dur
                            break
                    # Interpolated mid-point
                    c_time = prev_time + (next_time - prev_time) / 2
                    c_dur = 0.25 # Standard soft transition duration for skipped chars
                    
                syllables.append({
                    "time": round(c_time, 2),
                    "duration": round(c_dur, 2),
                    "text": item["char"]
                })
                
        if syllables:
            return syllables
        else:
            return get_uniform_syllables(text, start_time, end_time)
            
    except Exception as e:
        print(f"[ForcedAlignment Warning] Alignment failed: {e}. Falling back to uniform division.")
        import traceback
        traceback.print_exc()
        return get_uniform_syllables(text, start_time, end_time)

@app.on_event("startup")
def startup_event():
    # Warm up Whisper model on boot
    load_whisper()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "whisper_model": WHISPER_MODEL_SIZE
    }

@app.post("/api/v1/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    task: str = Form("transcribe"), # transcribe or translate
    language: str = Form(None),     # auto-detect or specific language code (e.g. 'zh', 'en')
    lrc_text: str = Form(None)
):
    """
    Audio transcription endpoint.
    Accepts audio file upload and returns high-fidelity lyrics JSON with syllables.
    Optionally accepts a same-name LRC file content for precise guided forced alignment.
    """
    # 1. Create a safe temporary file to save the uploaded audio
    temp_dir = tempfile.mkdtemp()
    temp_audio_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"\n[ASR] 成功接收音频上传: {file.filename} | 暂存路径: {temp_audio_path}")
        
        # 2. Check if external guided lyrics (.lrc) is provided
        if lrc_text:
            print(f"[ASR 引导对齐] 检测到参考歌词文本，正在深度分析格式特征...")
            
            # 🌟 终极逐字模式提取：如果歌词本就自带高保真逐字时间戳，直接免神经网络推理瞬发输出！
            word_level_data = parse_word_level_lrc(lrc_text)
            if word_level_data:
                print(f"[ASR 引导对齐] 极品逐字卡拉OK歌词提取大获成功！跳过神经网络推理，直接以 100% 精度瞬发输出！")
                return {
                    "success": True,
                    "language": language or "auto",
                    "lyrics": word_level_data
                }
                
            print(f"[ASR 引导对齐] 检测到本地同名参考歌词为常规行级歌词 (.lrc)！正在解析并启动 Wav2Vec2 强对齐...")
            parsed_lines = parse_lrc(lrc_text)
            
            if parsed_lines:
                print(f"[ASR 引导对齐] 成功解析 {len(parsed_lines)} 行歌词。正在执行精确的 100% 引导强对齐...")
                
                # Fetch total audio duration to bound the last line
                metadata = torchaudio.info(temp_audio_path)
                audio_duration = metadata.num_frames / metadata.sample_rate
                
                lyrics_data = []
                for idx, (start_time, text_cleaned) in enumerate(parsed_lines):
                    # Bound end_time using the next line's start time, or total audio duration
                    end_time = parsed_lines[idx+1][0] if idx + 1 < len(parsed_lines) else audio_duration
                    
                    print(f"  [-] [LRC引导对齐中] [{start_time:.2f}s -> {end_time:.2f}s] -> \"{text_cleaned}\"")
                    
                    # Perform alignment
                    syllables = perform_forced_alignment(
                        audio_path=temp_audio_path,
                        text=text_cleaned,
                        start_time=start_time,
                        end_time=end_time
                    )
                    
                    print(f"     [-] [对撞对齐] 完成 CTC 毫秒级对撞，对齐字词个数: {len(syllables)}")
                    
                    lyrics_data.append({
                        "time": round(start_time, 2),
                        "text": text_cleaned,
                        "syllables": syllables
                    })
                    
                print(f"\n[AI Alignment] LRC 引导强对齐大获成功！共计对齐 {len(lyrics_data)} 行段落句。正在向客户端回传...")
                return {
                    "success": True,
                    "language": language or "auto",
                    "lyrics": lyrics_data
                }
            else:
                print("[ASR 引导对齐 Warning] LRC 文本未能成功解析任何句，将降级为常规 ASR 自动转写流程。")
                
        # 3. Fallback to Lazy load and run Whisper Model for unconstrained ASR
        whisper = load_whisper()
        print(f"[ASR] 正在初始化 {WHISPER_MODEL_SIZE} 推理网络，硬件加速设备: {DEVICE} ({COMPUTE_TYPE})")
        
        # Setup transcription params
        segments, info = whisper.transcribe(
            temp_audio_path,
            task=task,
            language=language,
            beam_size=5,
            vad_filter=False
        )
        
        print(f"[ASR] 成功探测语种: {info.language} (置信度: {info.language_probability:.2%}) | 正在执行切片转写...")
        
        lyrics_data = []
        for idx, segment in enumerate(segments):
            text_cleaned = segment.text.strip()
            if not text_cleaned:
                continue
                
            print(f"  [-] [转写中] [{segment.start:.2f}s -> {segment.end:.2f}s] -> \"{text_cleaned}\"")
            
            # Perform alignment for this segment chunk
            syllables = perform_forced_alignment(
                audio_path=temp_audio_path,
                text=text_cleaned,
                start_time=segment.start,
                end_time=segment.end
            )
            
            print(f"     [-] [对撞对齐] 完成 CTC 毫秒级对撞，对齐字词个数: {len(syllables)}")
            
            # Format to KiomPlayer native lyric format
            lyrics_data.append({
                "time": round(segment.start, 2),
                "text": text_cleaned,
                "syllables": syllables
            })
            
        print(f"\n[AI Alignment] 成功为该歌曲对齐 {len(lyrics_data)} 个段落句！正在向客户端回传卡拉OK JSON...")
        return {
            "success": True,
            "language": info.language,
            "lyrics": lyrics_data
        }
        
    except Exception as e:
        print(f"[Server Error] Transcription endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # 4. Clean up temporary audio files safely
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass

@app.post("/api/v1/align_line")
async def align_line(
    file: UploadFile = File(...),
    text: str = Form(...),
    start_time: float = Form(...),
    end_time: float = Form(...)
):
    """
    Intelligent single lyric line calibration endpoint.
    Aligns text onto a specific time range using highly-precise CPU Wav2Vec2 CTC.
    """
    temp_dir = tempfile.mkdtemp()
    temp_audio_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"\n[AI 单句纠错] 收到校准请求! 文本: \"{text}\" | 时间范围: {start_time:.2f}s -> {end_time:.2f}s")
        
        # Run precise CPU forced alignment!
        syllables = perform_forced_alignment(
            audio_path=temp_audio_path,
            text=text,
            start_time=start_time,
            end_time=end_time
        )
        
        print(f"[AI 单句纠错] 校准完成! 毫秒级字对齐个数: {len(syllables)}")
        return {
            "success": True,
            "syllables": syllables
        }
    except Exception as e:
        print(f"[Server Error] Single line alignment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
