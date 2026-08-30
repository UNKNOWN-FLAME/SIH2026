# ADR-003: Use betterproto for Protobuf Python Bindings

**Status:** Accepted
**Date:** 2026-08-27
**Deciders:** VajraX Architecture Team

## Context

All Edge-to-Cloud messages are serialized with Protocol Buffers (proto3). The Python
services at both the Edge and Cloud tiers need auto-generated data classes from the
`.proto` schema files in `proto/`.

Two code-generation options exist for Python:

1. **Official `protobuf` package** (`google-protobuf`) — generates `Message` subclasses
   with descriptor-based field access (`msg.field`, `msg.HasField(...)`, `msg.SerializeToString()`).
   Verbose API, non-Pythonic, poor IDE autocompletion, requires descriptor pool.

2. **`betterproto`** (`python-betterproto`) — generates Python `@dataclass` classes with
   full PEP 526 type annotations. Clean Pythonic API: `bytes(msg)` to serialize,
   `MsgType().parse(b)` to deserialize. Generated classes are standard dataclasses — no
   special base class required.

## Decision

Use **betterproto** (version `>=2.0.0b6`) for Protobuf Python code generation.

Generated bindings are written to `shared/schemas/proto_generated/` by `make proto-gen`.
This directory is excluded from git (`.gitignore`) and regenerated during builds.

## Rationale

- **Type annotations**: generated fields have proper Python type hints (`float`, `str`,
  `datetime`, `bytes`) — IDEs provide full autocompletion and mypy catches type errors.
- **Dataclass compatibility**: generated messages can be passed to functions expecting
  standard Python dataclasses, and `dataclasses.asdict()` works out of the box.
- **Pydantic integration**: betterproto dataclasses can be converted to/from Pydantic
  models with `Model.model_validate(dataclasses.asdict(proto_msg))` — useful for
  the Cloud API response serialization layer.
- **Simpler serialization API**: `bytes(SensorReading(...))` vs `reading.SerializeToString()`.
- **Smaller generated code**: betterproto generates ~30% fewer lines than the official
  codegen for equivalent schemas.

## Alternative Considered

**Official `google-protobuf` package.** Not chosen because:
- Descriptor-pool API is verbose and unfamiliar to most Python engineers.
- Generated classes do not have type-annotated fields in IDEs without stubs.
- No clean Pydantic integration path.

## Consequences

- `betterproto` and `grpcio-tools` must be installed in the dev environment (`[dev]` extras in `pyproject.toml`).
- `make proto-gen` must be run after any `.proto` file change; CI must include this step before running tests.
- The generated `shared/schemas/proto_generated/` directory is git-ignored; a fresh clone requires running `make proto-gen` before any tests pass.
- If betterproto drops a feature we need or becomes unmaintained, migration to the official `protobuf` package is a ~2-hour effort (update imports, change serialize/parse calls, regenerate).
