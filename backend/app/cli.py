"""Management commands.

    python -m app.cli migrate            alembic upgrade head
    python -m app.cli seed [--reset]     create the Acme Corporation demo workspace
    python -m app.cli bootstrap          migrate + seed (idempotent) — used by Docker and local setup
    python -m app.cli create-user EMAIL NAME COMPANY   create a user + new workspace (prompts for password)
"""

import argparse
import asyncio
import getpass
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import configure_logging


def migrate() -> None:
    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(cfg, "head")


async def _seed(reset: bool) -> None:
    from app.db.session import SessionLocal, engine
    from app.seed import DEMO_PASSWORD, seed

    async with SessionLocal() as s:
        created = await seed(s, force=reset)
    await engine.dispose()
    if created:
        print(f"Seeded Acme Corporation. Sign in as adil@acme.com / {DEMO_PASSWORD}")


async def _create_user(email: str, name: str, company: str, password: str) -> None:
    from app.api.v1.auth import _unique_slug, slugify
    from app.core.security import hash_password
    from app.db.session import SessionLocal, engine
    from app.models import BrandSystem, Membership, Organization, User
    from app.services.brand import DEFAULT_COLORS, DEFAULT_FONTS

    async with SessionLocal() as db:
        user = User(email=email.lower(), name=name, password_hash=hash_password(password))
        org = Organization(name=company, slug=await _unique_slug(db, slugify(company)))  # type: ignore[arg-type]
        db.add_all([user, org])
        await db.flush()
        db.add(Membership(user_id=user.id, organization_id=org.id, role="owner"))
        db.add(BrandSystem(organization_id=org.id, name=f"{company} Brand", is_default=True, colors=DEFAULT_COLORS, fonts=DEFAULT_FONTS, company_profile={"name": company}))
        await db.commit()
    await engine.dispose()
    print(f"Created {email} as owner of {company}")


def main() -> None:
    s = get_settings()
    configure_logging(s.log_level, s.log_json)
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    p_seed = sub.add_parser("seed")
    p_seed.add_argument("--reset", action="store_true", help="drop and recreate the demo workspace")
    p_boot = sub.add_parser("bootstrap")
    p_boot.add_argument("--reset", action="store_true")
    p_user = sub.add_parser("create-user")
    p_user.add_argument("email")
    p_user.add_argument("name")
    p_user.add_argument("company")
    args = parser.parse_args()

    if args.cmd in ("migrate", "bootstrap"):
        migrate()
    if args.cmd in ("seed", "bootstrap"):
        asyncio.run(_seed(args.reset))
    if args.cmd == "create-user":
        pw = getpass.getpass("Password (min 10 chars): ")
        if len(pw) < 10:
            raise SystemExit("Password too short")
        asyncio.run(_create_user(args.email, args.name, args.company, pw))


if __name__ == "__main__":
    main()
