# PostgreSQL Bootstrap

Use these on the droplet that will host Postgres for the alert worker and video worker.

1. Create the role and database:

```bash
sudo -u postgres psql -f postgres/bootstrap_cluster.sql
```

2. Create the schema in the new database:

```bash
sudo -u postgres psql -d video_system -f postgres/bootstrap_schema.sql
```

3. Point the app envs at that DB server:

```env
DB_HOST=<postgres-server-ip>
DB_PORT=5432
DB_NAME=video_system
DB_USER=video_user
DB_PASSWORD=<same password you set in bootstrap_cluster.sql>
```

Notes:
- `video_user` is created by the bootstrap script.
- Replace `CHANGE_ME_VIDEO_DB_PASSWORD` before running it.
- The schema includes the alert/video columns expected by current runtime code.
- `gen_random_uuid()` requires `pgcrypto`, which the schema script enables.
