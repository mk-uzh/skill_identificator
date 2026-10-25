# Migrations

One-off scripts that change data already on disk. They are not pipeline steps:
each runs once, is named after the date it was written, and stays here as a
record of why an existing database looks the way it does.

A fresh load never needs them — the schema files already carry the final shape.

* `2026-10-25_rename_bronze_tables.py` — renames the bronze tables to the
  `tbl_brz_` scheme after the naming convention changed.
