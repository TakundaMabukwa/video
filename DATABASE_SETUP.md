# PostgreSQL Database Setup Guide

## 1. Install PostgreSQL on Droplet

```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Update packages
apt update

# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

## 2. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE video_system;
CREATE USER video_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE video_system TO video_user;
\q
```

## 3. Configure PostgreSQL for Remote Access

```bash
# Edit postgresql.conf
nano /etc/postgresql/*/main/postgresql.conf

# Find and change:
listen_addresses = '*'

# Edit pg_hba.conf
nano /etc/postgresql/*/main/pg_hba.conf

# Add this line (replace with your server IP):
host    video_system    video_user    your_server_ip/32    md5

# Restart PostgreSQL
systemctl restart postgresql
```

## 4. Create Tables

```bash
# Connect to database
sudo -u postgres psql -d video_system

# Copy and paste the schema from database-schema.sql
# Or upload the file and run:
\i /path/to/database-schema.sql
```

## 5. Configure Application

Create `.env` file in project root:

```env
# Server Configuration
TCP_PORT=7611
UDP_PORT=6611
API_PORT=3000
SERVER_IP=0.0.0.0

# PostgreSQL Database
DB_HOST=your_droplet_ip
DB_PORT=5432
DB_NAME=video_system
DB_USER=video_user
DB_PASSWORD=your_secure_password
```

## 6. Test Connection

```bash
# Install dependencies
npm install

# Test database connection
npm run dev

# You should see: "Database connected successfully"
```

## 7. Firewall Configuration

```bash
# Allow PostgreSQL port (if needed)
ufw allow 5432/tcp

# Or restrict to specific IP
ufw allow from your_server_ip to any port 5432
```

## Quick Commands

```bash
# Check PostgreSQL status
systemctl status postgresql

# View logs
tail -f /var/log/postgresql/postgresql-*.log

# Connect to database
psql -h your_droplet_ip -U video_user -d video_system

# List tables
\dt

# View table structure
\d videos
\d alerts
\d devices
\d images
```

## Backup & Restore

```bash
# Backup
pg_dump -h your_droplet_ip -U video_user video_system > backup.sql

# Restore
psql -h your_droplet_ip -U video_user video_system < backup.sql
```
