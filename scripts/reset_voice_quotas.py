"""Explicit operator action: clear voice quota leases, preserving learner data."""
import argparse
import json
import time

from dotenv import load_dotenv
from back.storage import ROOT, database, storage_backend


def reset_voice_quotas(apply=False):
    now = time.time()
    with database() as conn:
        leases = [json.loads(row[0]) for row in conn.execute(
            "SELECT payload FROM records WHERE kind='voice_sessions'")]
        active = sum(r.get('status') == 'active' and r.get('expires_at', 0) > now for r in leases)
        result = {'backend': storage_backend(), 'quota_records': len(leases), 'active_sessions': active,
                  'reset': False, 'remaining_records': len(leases)}
        if apply:
            if active:
                raise RuntimeError('Hay conversaciones activas. Finalízalas antes de reiniciar las cuotas.')
            conn.execute("DELETE FROM records WHERE kind='voice_sessions'")
            result['remaining_records'] = conn.execute(
                "SELECT count(*) FROM records WHERE kind='voice_sessions'").fetchone()[0]
            if result['remaining_records']:
                raise RuntimeError('No se pudo verificar el reinicio; la transacción se revierte.')
            result['reset'] = True
        return result


def main():
    parser = argparse.ArgumentParser(description='Inspeccionar o reiniciar las cuotas internas de voz de Lingora.')
    parser.add_argument('--apply', action='store_true', help='Reiniciar las cuotas globales y de todos los usuarios.')
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    try:
        print(json.dumps(reset_voice_quotas(args.apply), ensure_ascii=False))
    except RuntimeError as exc:
        print(str(exc))
        return 1
    except Exception:
        print('No se pudo acceder a la base configurada. No se modificaron las cuotas.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
