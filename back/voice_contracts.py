"""Application contracts, not provider payloads. No audio is persisted."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class VoiceOptions(Strict):
    mode: Literal['fluency', 'coaching'] = 'fluency'
    level: Literal['unknown', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] = 'unknown'
    topic: str = Field(default='', max_length=300)
    scenario: Literal['free', 'coffee', 'debate', 'interview'] = 'free'
    goal: str = Field(default='', max_length=200)
    voice: str = Field(default='Kore', max_length=40)
    consent: Literal[True]
    save_summary: bool = False


class Strength(Strict):
    turn_id: str = Field(max_length=60)
    excerpt: str = Field(min_length=1, max_length=300)
    explanation_es: str = Field(min_length=1, max_length=500)


class Observation(Strict):
    turn_id: str = Field(max_length=60)
    category: Literal['grammar', 'vocabulary', 'natural_phrasing', 'pronunciation']
    original_excerpt: str = Field(min_length=1, max_length=300)
    suggested_alternative: str = Field(min_length=1, max_length=300)
    explanation_es: str = Field(min_length=1, max_length=500)
    evidence_type: Literal['transcript', 'audio']
    confidence: Literal['high', 'medium', 'low']
    is_optional_improvement: bool


class Evaluation(Strict):
    strengths: list[Strength] = Field(max_length=3)
    improvements: list[Observation] = Field(max_length=3)
    practice: str = Field(min_length=1, max_length=600)
    insufficient_evidence: bool


def validate_evaluation(value, turns):
    result = Evaluation.model_validate(value).model_dump()
    evidence = {t['id']: t['text'] for t in turns if t['role'] == 'user' and t['final']}
    result['strengths'] = [s for s in result['strengths']
                           if s['excerpt'] in evidence.get(s['turn_id'], '')]
    seen = set()
    valid = []
    for item in result['improvements']:
        key = (item['turn_id'], item['original_excerpt'], item['category'])
        # Evaluation receives text only: never infer pronunciation/audio evidence.
        if (item['confidence'] == 'low' or item['category'] == 'pronunciation'
                or item['evidence_type'] != 'transcript' or key in seen
                or item['original_excerpt'] not in evidence.get(item['turn_id'], '')):
            continue
        seen.add(key)
        valid.append(item)
    result['improvements'] = valid
    if not result['strengths'] and not valid:
        result['insufficient_evidence'] = True
    return result
