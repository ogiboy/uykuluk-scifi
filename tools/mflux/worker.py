import argparse
import json
import os
import sys
import time
from pathlib import Path

from huggingface_hub import snapshot_download
from mflux.models.common.config import ModelConfig
from mflux.models.flux2.variants import Flux2Klein

MODEL_REPOSITORY = "mlx-community/flux2-klein-4b-4bit"
MODEL_REVISION = "860e87183ceb29e39627c0612ebd66d8ea66e68c"
RUNTIME_VERSION = "0.18.0"
INSTALL_MANIFEST_NAME = "install-manifest.json"
SMOKE_PROMPT = "Cinematic scientific illustration of a distant exoplanet, accurate orbital rings, no text."
MAX_PROMPT_CHARACTERS = 20_000


class WorkerFailure(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def parse_args():
    parser = argparse.ArgumentParser(
        description="UykulukSciFi fixed MFLUX local-model worker"
    )
    parser.add_argument(
        "--operation", choices=("setup", "verify", "smoke", "generate"), required=True
    )
    parser.add_argument("--runtime-path", required=True)
    parser.add_argument("--output-path")
    parser.add_argument("--prompt-path")
    parser.add_argument("--seed", type=int)
    return parser.parse_args()


def install_manifest_path(runtime_path: Path) -> Path:
    return runtime_path / INSTALL_MANIFEST_NAME


def model_inventory(model_path: Path):
    files = []
    for candidate in sorted(model_path.rglob("*")):
        if not candidate.is_file() or ".cache" in candidate.parts:
            continue
        resolved = candidate.resolve()
        if not resolved.is_relative_to(model_path.resolve()):
            raise WorkerFailure("model-file-outside-runtime")
        files.append(
            {
                "path": candidate.relative_to(model_path).as_posix(),
                "bytes": candidate.stat().st_size,
            }
        )
    if not files:
        raise WorkerFailure("model-inventory-empty")
    return files


def write_install_manifest(runtime_path: Path, model_path: Path):
    manifest = {
        "schemaVersion": 1,
        "runtimeVersion": RUNTIME_VERSION,
        "modelRepository": MODEL_REPOSITORY,
        "modelRevision": MODEL_REVISION,
        "files": model_inventory(model_path),
    }
    target = install_manifest_path(runtime_path)
    temporary = target.with_name(f".{target.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)


def verify_model(runtime_path: Path, model_path: Path):
    if not model_path.is_dir():
        raise WorkerFailure("model-directory-missing")
    target = install_manifest_path(runtime_path)
    if not target.is_file():
        raise WorkerFailure("install-manifest-missing")
    try:
        manifest = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise WorkerFailure("install-manifest-invalid") from error
    expected_identity = {
        "schemaVersion": 1,
        "runtimeVersion": RUNTIME_VERSION,
        "modelRepository": MODEL_REPOSITORY,
        "modelRevision": MODEL_REVISION,
    }
    if any(manifest.get(key) != value for key, value in expected_identity.items()):
        raise WorkerFailure("install-identity-mismatch")
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise WorkerFailure("install-inventory-invalid")
    root = model_path.resolve()
    for entry in files:
        if not isinstance(entry, dict):
            raise WorkerFailure("install-inventory-invalid")
        relative = entry.get("path")
        expected_bytes = entry.get("bytes")
        if not isinstance(relative, str) or not isinstance(expected_bytes, int):
            raise WorkerFailure("install-inventory-invalid")
        candidate = (model_path / relative).resolve()
        if not candidate.is_relative_to(root):
            raise WorkerFailure("model-file-outside-runtime")
        if not candidate.is_file() or candidate.stat().st_size != expected_bytes:
            raise WorkerFailure("model-file-missing-or-changed")


def generation_prompt(args):
    if args.operation == "smoke":
        return SMOKE_PROMPT
    if not args.prompt_path:
        raise WorkerFailure("generation-prompt-missing")
    try:
        prompt = Path(args.prompt_path).read_text(encoding="utf-8")
    except OSError as error:
        raise WorkerFailure("generation-prompt-unreadable") from error
    if not prompt.strip() or len(prompt) > MAX_PROMPT_CHARACTERS:
        raise WorkerFailure("generation-prompt-invalid")
    return prompt


def execute():
    args = parse_args()
    runtime_path = Path(args.runtime_path).resolve()
    model_path = runtime_path / "model"
    runtime_path.mkdir(parents=True, exist_ok=True)

    if args.operation == "setup":
        snapshot_download(
            repo_id=MODEL_REPOSITORY,
            revision=MODEL_REVISION,
            local_dir=str(model_path),
        )
        write_install_manifest(runtime_path, model_path)
        verify_model(runtime_path, model_path)
        return {"status": "ok", "operation": "setup"}

    verify_model(runtime_path, model_path)
    if args.operation == "verify":
        return {"status": "ok", "operation": "verify"}
    if not args.output_path:
        raise WorkerFailure("generation-output-missing")
    if args.operation == "generate" and (args.seed is None or args.seed < 0):
        raise WorkerFailure("generation-seed-invalid")

    output_path = Path(args.output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model = Flux2Klein(
        model_config=ModelConfig.flux2_klein_4b(), model_path=str(model_path)
    )
    started_at = time.monotonic()
    image = model.generate_image(
        seed=42 if args.operation == "smoke" else args.seed,
        prompt=generation_prompt(args),
        num_inference_steps=4,
        width=1024,
        height=576,
        guidance=1.0,
    )
    image.save(output_path)
    return {
        "status": "ok",
        "operation": args.operation,
        "durationMs": round((time.monotonic() - started_at) * 1000),
    }


def main():
    try:
        print(json.dumps(execute(), separators=(",", ":")), flush=True)
    except WorkerFailure as error:
        print(
            json.dumps({"status": "error", "code": error.code}, separators=(",", ":")),
            flush=True,
        )
        return 1
    except Exception:
        print(
            json.dumps({"status": "error", "code": "mflux-runtime-failure"}),
            flush=True,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
