"""Uncached local model timings. No account, network tunnel, microphone or speaker claim."""
import argparse
import asyncio
from array import array
import base64
import io
import json
from pathlib import Path
import sys
import time
import wave

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--server-root',type=Path,default=root.parent/'Ollama reactjs LLM DeepSeek Integration'/'server')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
sys.path.insert(0,str(args.server_root.resolve()))
from help_assistant.speech_service import SpeechService
from help_assistant.parakeet_runtime import ParakeetRuntime

receipt={'scope':'Direct local runtime, uncached synthetic speech; no chat/gateway/tunnel or audible playback measurement',
         'speechModel':'Kitten-TTS 2 F16','asrModel':'Parakeet Redux Q8 CPU, 4 threads','samples':[]}
def save(sample):
    receipt['samples'].append(sample)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(sample),flush=True)

async def main():
    text='Open the project main table.'
    for pair in range(3):
        service=SpeechService()
        try:
            for temperature in ('cold','warm'):
                start=time.monotonic()
                result=await service.native_speech(text)
                elapsed=time.monotonic()-start
                with wave.open(io.BytesIO(base64.b64decode(result['audio']))) as audio:
                    duration=audio.getnframes()/audio.getframerate()
                save({'stage':'tts','pair':pair+1,'state':temperature,'characters':len(text),
                      'seconds':round(elapsed,3),'audio_seconds':round(duration,3),
                      'real_time_factor':round(elapsed/duration,3),'cached':False,**service.kitten.last_timing})
        finally:
            await service.close()
    with wave.open(str(root/'tests/e2e/fixtures/help-microphone.wav')) as fixture:
        assert fixture.getnchannels()==1 and fixture.getsampwidth()==2
        rate=fixture.getframerate();samples=array('h',fixture.readframes(fixture.getnframes()))
    pcm=array('h',(samples[min(len(samples)-1,int(i*rate/16000))] for i in range(int(len(samples)*16000/rate))))
    output=io.BytesIO()
    with wave.open(output,'wb') as audio:
        audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(16000);audio.writeframes(pcm.tobytes())
    for pair in range(3):
        runtime=ParakeetRuntime()
        try:
            for temperature in ('cold','warm'):
                start=time.monotonic();result=await runtime.transcribe(output.getvalue())
                save({'stage':'asr','pair':pair+1,'state':temperature,'seconds':round(time.monotonic()-start,3),
                      'audio_seconds':round(len(pcm)/16000,3),'recognized':bool(result['text'].strip())})
        finally:
            await runtime.close()

asyncio.run(main())
