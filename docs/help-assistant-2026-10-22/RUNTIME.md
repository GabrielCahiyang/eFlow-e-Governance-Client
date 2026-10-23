# Local runtime

This installation is for **Windows, GTX 1070 Max-Q (8 GB), compute capability 6.1, CUDA 12.4**. The browser needs microphone permission on HTTPS or localhost. The AI laptop runs all three models.

## Installed pieces

External AI repository: `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration`.

| Component | Installed runtime |
|---|---|
| Answer selection | Existing Qwen3.5:2b Q4_K_M registry entry and model queue |
| Transcription | Official `mudler/parakeet.cpp` Windows CPU release v0.6.1, Redux Q8 GGUF |
| Speech token generation | Kitten-TTS 2 C++ engine, patched to allow GPU layers, linked against the complete installed llama-cpp-python 0.3.36 ABI |
| Waveform decoder | Kitten's `student_w4` TorchScript decoder, PyTorch 2.6.0+cu124, isolated `.speech-gpu-venv` |
| Voice | Built-in Bruno; no voice sample or cloning required |

The main AI environment is preserved. The ASR worker/data tools are in `server/.speech-venv`; CUDA decoding is in `server/.speech-gpu-venv`. Their pinned requirements are recorded in the external server repository. No raw microphone recording is retained by the application; temporary request audio and generated audio are cleaned after use. Synthetic QA WAV files in this evidence folder are intentional test artifacts.

## Why a custom build was needed

The packaged C++ engine hardcodes CPU model layers. Its custom packed ternary kernels were very slow on this machine. A trial reuse of a foreign CUDA backend failed; that loader workaround was removed. The production build instead links **all matching llama/GGML libraries and the exact matching headers** from the installed 0.3.36 wheel's llama revision `0c1e57098bba43ac29e6e3b677cdceebdd22334f`.

The speech weights are expanded losslessly from Kitten's TQ2_1 storage to F16 by `server/help_assistant/repack.py`. The converter preserves the original ternary scales and verifies finite values. Q4 storage produced non-finite CUDA logits on this GPU and is not the production path. Actual F16 GPU logits and generated audio were verified.

The CPU-traced waveform graph also contains an explicit CPU device constant. Moving parameters alone was insufficient. The isolated decoder moves that constant to CUDA, disables expensive profiling compilation, and verifies finite audio. This uses Kitten's own decoder and voice conditioning. The first graph load is retained between Help turns to avoid reloading it for every sentence.

## Rebuild inputs and commands

- Kitten C++ source commit: `bfab0cbd31a5697e5cba4779f7eed78368eeede0` from the official `py-interface` branch.
- Text-processing submodule: `1988d61ca82d51ad11cb4a541ac61e1f46677eb4`.
- Source checkout: `C:/Users/gabri/.cache/eflow-speech/src` (short path avoids Windows long-path checkout failures).
- Reproducible upstream diff: external `server/help_assistant/native/kitten-runtime.patch`.
- Isolated offline native target: `server/help_assistant/native/CMakeLists.txt`.
- Build command, from the external repository: `cmd /c server\build_help_speech_compat.cmd`.
- Build outputs: `C:/Users/gabri/.cache/eflow-speech/build-compat/eflow-kitten-worker.exe` for resident private token generation, plus `kitten-tts.exe` for standalone checks. The worker uses the repository's `native/token_worker.cpp`; the vendor-engine patch includes non-mapped model loading to reduce memory pressure on this host.
- VS 2019 C++ tools, CMake 3.31.6 and Ninja 1.11.1.4 were used. Seven llama/GGML headers must come from the exact revision above, in `C:/Users/gabri/.cache/eflow-speech/compat-include`.
- F16 conversion: `server/.venv/Scripts/python.exe server/help_assistant/repack.py .cache/kitten-tts/KittenML/kitten-tts-2/main/cpp/model-tq2_1.gguf .cache/kitten-tts/KittenML/kitten-tts-2/main/cpp/model-gpu-f16.gguf f16`.
- Install CUDA decoder dependencies only in `.speech-gpu-venv`, using `server/speech-gpu-requirements.txt`. They must not replace the main model environment's Torch installation.

The exact installed model/voice hashes are recorded in [installed-assets.json](installed-assets.json). Preserve that matched cached bundle. The upstream model's `main` currently advertises a different voices file; do not replace voice conditioning or config independently based on a moving `main` URL. Readiness is written only after the local synthetic speech/recognition round-trip succeeds.

## Starting and checking

1. Start eFlow normally with `npm run dev` in EflowWeb. Its gateway owns port 8322 and frontend port 5173.
2. Start the external AI repository normally with its existing launcher (`python server/start.py`). It supervises the private API and existing Cloudflare publisher. Avoid starting a second process on 8321.
3. Sign in and open **Help → Talk to eFlow AI → eFlow Live** in the modal header. The mic beside Send is separate dictation into the editable draft.
4. The voice readiness indicator is backed by `server/.speech-venv/voice-ready.json`; the API also checks runtime files exist. If speech fails, typed help remains available with a visible error.

For a standalone native speech check, run `server/.venv/Scripts/python.exe -m help_assistant.local_smoke` from the external `server` directory **while other inference is idle**. This utility uses synthetic phrases and no business records. For real gateway acceptance, `scripts/verify-help-local.py` accepts QA credentials in `EFLOW_HELP_QA_EMAIL` and `EFLOW_HELP_QA_PASSWORD`; it never prints or persists the session token.

## Primary sources

- [Kitten-TTS 2 C++ runtime](https://github.com/KittenML/kitten-tts-2-cpp)
- [Kitten-TTS 2 model](https://huggingface.co/KittenML/kitten-tts-2)
- [Parakeet C++ runtime](https://github.com/mudler/parakeet.cpp)
- [Redux GGUF models](https://huggingface.co/mudler/parakeet-cpp-gguf)
- [Official CUDA PyTorch installation versions](https://pytorch.org/get-started/previous-versions/)
