@echo off
REM Phase 2 Endpoint Testing Script for Windows
REM Tests all Phase 2 features to verify they work correctly

set BASE_URL=http://localhost:3000
echo Testing Phase 2 Endpoints on %BASE_URL%
echo ========================================
echo.

REM Test 1: /api/alerts/by-priority
echo 1. Testing GET /api/alerts/by-priority
curl -s "%BASE_URL%/api/alerts/by-priority"
echo.
echo ---
echo.

REM Test 2: /api/alerts/stats
echo 2. Testing GET /api/alerts/stats
curl -s "%BASE_URL%/api/alerts/stats"
echo.
echo ---
echo.

REM Test 3: /api/alerts/unattended
echo 3. Testing GET /api/alerts/unattended?minutes=30
curl -s "%BASE_URL%/api/alerts/unattended?minutes=30"
echo.
echo ---
echo.

REM Test 4: /api/alerts/active
echo 4. Testing GET /api/alerts/active
curl -s "%BASE_URL%/api/alerts/active"
echo.
echo ---
echo.

REM Test 5: /api/alerts (with filters)
echo 5. Testing GET /api/alerts?status=new^&limit=10
curl -s "%BASE_URL%/api/alerts?status=new&limit=10"
echo.
echo ---
echo.

REM Test 6: Record speeding event
echo 6. Testing POST /api/speeding/record
curl -s -X POST "%BASE_URL%/api/speeding/record" -H "Content-Type: application/json" -d "{\"vehicleId\":\"TEST-VEHICLE-001\",\"driverId\":\"DRV-TEST-001\",\"speed\":125,\"speedLimit\":80,\"latitude\":-26.2041,\"longitude\":28.0473}"
echo.
echo ---
echo.

REM Test 7: Get driver rating
echo 7. Testing GET /api/drivers/DRV-TEST-001/rating
curl -s "%BASE_URL%/api/drivers/DRV-TEST-001/rating"
echo.
echo ---
echo.

REM Test 8: Get speeding events
echo 8. Testing GET /api/drivers/DRV-TEST-001/speeding-events?days=7
curl -s "%BASE_URL%/api/drivers/DRV-TEST-001/speeding-events?days=7"
echo.
echo ---
echo.

REM Test 9: Health check
echo 9. Testing GET /health
curl -s "%BASE_URL%/health"
echo.
echo ---
echo.

echo ========================================
echo Phase 2 Endpoint Testing Complete
echo ========================================
pause
