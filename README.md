# Shulepoa Attendance

Fingerprint attendance for Kenyan schools: ZKTeco clock-in, parent SMS, live registers and PDF reports.
Live at https://attedance.shulepoa.co.ke (that spelling is the real address).

Next.js frontend, five FastAPI services, PostgreSQL.

## Run it on a new computer (Windows)

You need Git, Node.js 20, Python 3.12 and PostgreSQL.

```powershell
git clone https://github.com/dennisngugiwambui/Biometrics-system.git
cd Biometrics-system
```

**1. Create an empty database of its own.** Do not share a database with the School ERP.

```sql
CREATE DATABASE school_biometric;
```

**2. Backend**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
```

Open `backend\.env` and set `DATABASE_URL` and `SECRET_KEY`. Then create the tables and the owner account
for `/management` (its temporary password is written to `FIRST-LOGIN.txt`, which git ignores):

```powershell
$env:DATABASE_URL = "postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/school_biometric"
.venv\Scripts\python -m alembic upgrade heads
cd school_service
..\.venv\Scripts\python create_platform_admin.py you@example.com
cd ..\..
```

**3. Frontend**

```powershell
cd frontend
npm install
copy .env.example .env
cd ..
```

**4. Start everything** from the project folder:

```powershell
.\start-backend-services.ps1
.\start-frontend.ps1
```

Open http://localhost:3000. API docs are at http://localhost:8000/docs.

## Deploying

`deploy/deploy-attendance.sh` ships to the live server from Git Bash. It needs the SSH key, which is not in this repository.

## Secrets

Real values live only in `.env` files, which git ignores. Never commit them.
