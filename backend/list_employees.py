"""
list_employees.py — View seeded employees through the app's own API.

Logs in (default admin dev.malhotra@example.com / Password123!) and pages
through GET /api/employees, printing a compact table. Supports the same
filters as the endpoint.

Usage (from backend/, with uvicorn running on 127.0.0.1:8000):
    .venv/bin/python list_employees.py
    .venv/bin/python list_employees.py --department DevOps
    .venv/bin/python list_employees.py --search "priya"
    .venv/bin/python list_employees.py --location Bangalore --limit 100

Env overrides:
    SANDY_API_BASE       default http://127.0.0.1:8000
    SANDY_LOGIN_EMAIL    default dev.malhotra@example.com
    SANDY_LOGIN_PASSWORD default Password123!
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.getenv("SANDY_API_BASE", "http://127.0.0.1:8000").rstrip("/")
EMAIL = os.getenv("SANDY_LOGIN_EMAIL", "dev.malhotra@example.com")
PASSWORD = os.getenv("SANDY_LOGIN_PASSWORD", "Password123!")


def _post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _get_json(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def login() -> str:
    resp = _post_json(f"{BASE}/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    return resp["access_token"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--department")
    ap.add_argument("--level")
    ap.add_argument("--business-unit", dest="business_unit")
    ap.add_argument("--location")
    ap.add_argument("--search")
    ap.add_argument("--limit", type=int, default=50,
                    help="max total employees to print (paged at 100; use a large value e.g. 1000 to list all)")
    args = ap.parse_args()

    try:
        token = login()
    except Exception as e:
        print(f"login failed: {e}", file=sys.stderr)
        print("is uvicorn running?  .venv/bin/uvicorn app.main:app --reload", file=sys.stderr)
        sys.exit(1)

    params = {"page": 1, "limit": min(args.limit, 100)}
    for k, v in (("department", args.department), ("level", args.level),
                 ("business_unit", args.business_unit), ("location", args.location),
                 ("search", args.search)):
        if v:
            params[k] = v

    seen = 0
    page = 1
    page_size = min(args.limit, 100)
    print(f"{'ID':<8} {'Name':<22} {'Role':<26} {'Lvl':<5} {'Dept':<18} {'Location'}")
    print("-" * 100)
    while seen < args.limit:
        params["page"] = page
        params["limit"] = page_size
        url = f"{BASE}/api/employees?{urllib.parse.urlencode(params)}"
        rows = _get_json(url, token)
        if not rows:
            break
        for e in rows:
            if seen >= args.limit:
                break
            print(f"{e['employee_id']:<8} {(e['name'] or '')[:21]:<22} "
                  f"{(e['role'] or '')[:25]:<26} {(e['level'] or ''):<5} "
                  f"{(e['department'] or '')[:17]:<18} {e['location'] or ''}")
            seen += 1
        if len(rows) < page_size:
            break
        page += 1
    print(f"\n{seen} employee(s) shown.")


if __name__ == "__main__":
    main()