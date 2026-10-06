"""Check model availability; --handshake also opens one short billed Live session.
Never prints credentials, transcripts, provider error bodies or audio data.
"""
import argparse
import asyncio
import base64
import json
import os
import sys
import struct
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import httpx
from dotenv import load_dotenv
from back.voice import ENDPOINT, MODELS, setup, wire_logger
from back.voice_contracts import VoiceOptions

load_dotenv(Path(__file__).resolve().parent.parent / '.env')


async def check(handshake, loopback=False, sample=False):
    key = os.getenv('AI_API_KEY')
    if not key:
        print('AI_API_KEY is not configured');return
    async with httpx.AsyncClient(timeout=20) as client:
        available = []
        token = ''
        for _ in range(10):
            response = await client.get('https://generativelanguage.googleapis.com/v1beta/models', headers={'x-goog-api-key': key}, params={'pageSize':1000, 'pageToken':token})
            print('Model list HTTP:', response.status_code)
            response.raise_for_status()
            for model in response.json().get('models', []):
                name = model['name'].removeprefix('models/')
                if 'live' in name or 'native-audio' in name or 'bidiGenerateContent' in model.get('supportedGenerationMethods', []):
                    available.append(name)
                    print('Live candidate:', name, 'methods:', model.get('supportedGenerationMethods', []))
            token = response.json().get('nextPageToken', '')
            if not token:break
        print('Live candidates:', len(available))
    model = os.getenv('LIVE_MODEL', 'gemini-3.8-live')
    if not handshake or model not in available or model not in MODELS:
        print('Handshake skipped' if not handshake else 'Configured model unavailable; no session started');return
    from websockets.asyncio.client import connect
    started = time.monotonic()
    async with connect(ENDPOINT, additional_headers={'x-goog-api-key': key}, logger=wire_logger, open_timeout=15, close_timeout=2, max_size=512000) as ws:
        await ws.send(json.dumps(setup(VoiceOptions(consent=True), model)))
        event = json.loads(await asyncio.wait_for(ws.recv(), 20))
        print('Setup accepted:', 'setupComplete' in event, 'model:', model, 'voice: Kore')
        if 'setupComplete' not in event:return
        if sample:
            # Public PCM fixture explicitly linked by Google's Live API guide.
            async with httpx.AsyncClient(timeout=15) as client:
                media=await client.get('https://storage.googleapis.com/generativeai-downloads/data/hello_are_you_there.pcm')
                media.raise_for_status();pcm=media.content
            if len(pcm)>320000 or len(pcm)%2:raise ValueError('Unexpected sample')
            for offset in range(0,len(pcm),640):
                await ws.send(json.dumps({'realtimeInput':{'audio':{'data':base64.b64encode(pcm[offset:offset+640]).decode(),'mimeType':'audio/pcm;rate=16000'}}}))
                await asyncio.sleep(.02)
            # Supply trailing silence, as a microphone continues doing between turns.
            for _ in range(60):
                await ws.send(json.dumps({'realtimeInput':{'audio':{'data':base64.b64encode(bytes(640)).decode(),'mimeType':'audio/pcm;rate=16000'}}}))
                await asyncio.sleep(.02)
            await ws.send(json.dumps({'realtimeInput':{'audioStreamEnd':True}}))
            transcription=False;reply=False
            async with asyncio.timeout(30):
                while not (transcription and reply):
                    event=json.loads(await ws.recv());content=event.get('serverContent',{})
                    transcription=transcription or bool(content.get('inputTranscription',{}).get('text'))
                    reply=reply or any(p.get('inlineData') for p in content.get('modelTurn',{}).get('parts',[]))
            print('Official sample PCM input bytes:',len(pcm),'transcribed:',transcription,'reply audio:',reply)
            return
        await ws.send(json.dumps({'clientContent': {'turns': [{'role': 'user', 'parts': [{'text': 'Say hello in English in one short sentence.'}]}], 'turnComplete': True}}))
        collected = bytearray()
        received_audio = False
        event_shapes = set()
        while True:
            event = json.loads(await asyncio.wait_for(ws.recv(), 20))
            shape=','.join(sorted(event.get('serverContent',{})))
            if shape not in event_shapes:
                event_shapes.add(shape);print('Response event fields:',shape,flush=True)
            for part in event.get('serverContent', {}).get('modelTurn', {}).get('parts', []):
                audio = part.get('inlineData')
                if audio:
                    if not received_audio:
                        print('Audio received:', audio.get('mimeType'), 'first-chunk-ms:', round((time.monotonic()-started)*1000))
                    received_audio = True
                    if not loopback:return
                    collected.extend(base64.b64decode(audio['data']))
                    if len(collected)>480000:raise ValueError('Test audio limit')
            if (event.get('serverContent', {}).get('turnComplete') or event.get('serverContent',{}).get('generationComplete')) and collected:
                break
        # Synthetic provider-generated speech, not a user's microphone or voice.
        samples = struct.unpack('<'+'h'*(len(collected)//2), collected)
        converted = [round((samples[i]+samples[min(i+1,len(samples)-1)])/2)
                     for i in (int(n*1.5) for n in range(int(len(samples)/1.5)))]
        pcm = struct.pack('<'+'h'*len(converted), *converted)
        print('Sending synthetic PCM bytes:',len(pcm),flush=True)
        for offset in range(0,len(pcm),640):
            await ws.send(json.dumps({'realtimeInput':{'audio':{'data':base64.b64encode(pcm[offset:offset+640]).decode(),'mimeType':'audio/pcm;rate=16000'}}}))
            await asyncio.sleep(.02)
        await ws.send(json.dumps({'realtimeInput':{'audioStreamEnd':True}}))
        transcription=False;reply=False
        try:
            async with asyncio.timeout(30):
                while not (transcription and reply):
                    event=json.loads(await ws.recv());content=event.get('serverContent',{})
                    print('Input-cycle event fields:',','.join(sorted(content)),flush=True)
                    transcription=transcription or bool(content.get('inputTranscription',{}).get('text'))
                    reply=reply or any(p.get('inlineData') for p in content.get('modelTurn',{}).get('parts',[]))
        except TimeoutError:
            print('Input-cycle timeout. Transcription:',transcription,'reply:',reply,flush=True)
            raise
        print('Synthetic PCM16 input bytes:',len(pcm),'input transcribed:',transcription,'reply audio received:',reply)


if __name__ == '__main__':
    parser = argparse.ArgumentParser();parser.add_argument('--handshake', action='store_true');parser.add_argument('--loopback',action='store_true');parser.add_argument('--sample',action='store_true')
    args=parser.parse_args()
    try:asyncio.run(check(args.handshake or args.loopback or args.sample,args.loopback,args.sample))
    except Exception as exc:
        print('Check failed:', type(exc).__name__);sys.exit(1)
