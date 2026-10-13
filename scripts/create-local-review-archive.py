"""Portable, credential-free DayFlow ZIP writer (standard POSIX entry names).

Run from package-local-preview.mjs. Requires Python 3 stdlib only.
Zip files made by Windows PowerShell Compress-Archive can contain backslash
entry separators; Linux unzip then rejects them. Explicitly normalize them.
"""
from pathlib import Path, PurePosixPath
import os
import secrets
import sys
import zipfile


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Expected staged source directory and ZIP destination")
    source = Path(sys.argv[1]).resolve(strict=True)
    destination = Path(sys.argv[2]).resolve(strict=False)
    if not source.is_dir():
        raise SystemExit("Staged source is not a directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".tmp-" + secrets.token_hex(5))

    try:
        with zipfile.ZipFile(
            temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8
        ) as archive:
            for root, dirs, files in os.walk(source, followlinks=False):
                parent = Path(root)
                for dirname in dirs:
                    if (parent / dirname).is_symlink():
                        raise ValueError("Review bundle contains a directory symlink")
                for filename in sorted(files):
                    item = parent / filename
                    if item.is_symlink() or not item.is_file():
                        raise ValueError("Review bundle contains a nonregular file")
                    member = item.relative_to(source).as_posix()
                    archive.write(item, arcname=member)

        with zipfile.ZipFile(temporary, "r") as archive:
            names = archive.namelist()
            if len(names) < 20:
                raise ValueError("Review archive has too few files")
            forbidden = {
                ".artifacts", ".git", "node_modules", ".env", "test-results", "coverage"
            }
            for name in names:
                parts = PurePosixPath(name).parts
                if (
                    not name
                    or "\\" in name
                    or name.startswith("/")
                    or ".." in parts
                    or set(parts) & forbidden
                    or any(part.lower().startswith(".env.") for part in parts)
                    or any(word in name.lower() for word in [
                        "secret", "credential", "login-local-only", "password",
                    ])
                ):
                    raise ValueError("Review archive contains a forbidden path")
            mandatory = {
                "START_DAYFLOW_LOCAL.bat",
                "OPEN_THIS_FIRST.txt",
                "apps/web/dist/index.html",
                "scripts/start-local-preview.mjs",
                "package.json",
            }
            if not mandatory.issubset(set(names)):
                raise ValueError("Review ZIP is missing a runnable component")
            broken = archive.testzip()
            if broken is not None:
                raise ValueError("Review ZIP CRC mismatch")

        os.replace(temporary, destination)
        print("DAYFLOW_LOCAL_REVIEW_ARCHIVE_PRIVACY_CHECK=PASS")
        print("DAYFLOW_LOCAL_REVIEW_ARCHIVE_POSIX_PATHS=PASS")
    finally:
        if temporary.exists():
            temporary.unlink()


if __name__ == "__main__":
    main()
