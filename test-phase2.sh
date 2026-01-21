#!/bin/bash

# Phase 2 Endpoint Testing Script
# Tests all Phase 2 features to verify they work correctly

BASE_URL="http://localhost:3000"
echo "Testing Phase 2 Endpoints on $BASE_URL"
echo "========================================"
echo ""

# Test 1: /api/alerts/by-priority
echo "1. Testing GET /api/alerts/by-priority"
curl -s "$BASE_URL/api/alerts/by-priority" | jq '.'
echo ""
echo "---"
echo ""

# Test 2: /api/alerts/stats
echo "2. Testing GET /api/alerts/stats"
curl -s "$BASE_URL/api/alerts/stats" | jq '.'
echo ""
echo "---"
echo ""

# Test 3: /api/alerts/unattended
echo "3. Testing GET /api/alerts/unattended?minutes=30"
curl -s "$BASE_URL/api/alerts/unattended?minutes=30" | jq '.'
echo ""
echo "---"
echo ""

# Test 4: /api/alerts/active
echo "4. Testing GET /api/alerts/active"
curl -s "$BASE_URL/api/alerts/active" | jq '.'
echo ""
echo "---"
echo ""

# Test 5: /api/alerts (with filters)
echo "5. Testing GET /api/alerts?status=new&limit=10"
curl -s "$BASE_URL/api/alerts?status=new&limit=10" | jq '.'
echo ""
echo "---"
echo ""

# Test 6: Record speeding event
echo "6. Testing POST /api/speeding/record"
curl -s -X POST "$BASE_URL/api/speeding/record" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "TEST-VEHICLE-001",
    "driverId": "DRV-TEST-001",
    "speed": 125,
    "speedLimit": 80,
    "latitude": -26.2041,
    "longitude": 28.0473
  }' | jq '.'
echo ""
echo "---"
echo ""

# Test 7: Get driver rating
echo "7. Testing GET /api/drivers/DRV-TEST-001/rating"
curl -s "$BASE_URL/api/drivers/DRV-TEST-001/rating" | jq '.'
echo ""
echo "---"
echo ""

# Test 8: Get speeding events
echo "8. Testing GET /api/drivers/DRV-TEST-001/speeding-events?days=7"
curl -s "$BASE_URL/api/drivers/DRV-TEST-001/speeding-events?days=7" | jq '.'
echo ""
echo "---"
echo ""

# Test 9: Health check
echo "9. Testing GET /health"
curl -s "$BASE_URL/health" | jq '.'
echo ""
echo "---"
echo ""

echo "========================================"
echo "Phase 2 Endpoint Testing Complete"
echo "========================================"
