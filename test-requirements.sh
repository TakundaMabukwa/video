#!/bin/bash

echo "=================================="
echo "REQUIREMENTS VERIFICATION TESTS"
echo "=================================="
echo ""

BASE_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0

function test_endpoint() {
  test_count=$((test_count + 1))
  local name=$1
  local url=$2
  local method=${3:-GET}
  local data=$4
  
  echo -n "Test $test_count: $name... "
  
  if [ "$method" = "POST" ]; then
    response=$(curl -s -X POST "$BASE_URL$url" -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}")
  else
    response=$(curl -s "$BASE_URL$url" -w "\n%{http_code}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
    pass_count=$((pass_count + 1))
    return 0
  else
    echo -e "${RED}FAIL${NC} (HTTP $http_code)"
    echo "Response: $body"
    return 1
  fi
}

echo "=== ALERT MANAGEMENT TESTS ==="
echo ""

test_endpoint "Get active alerts" "/api/alerts/active"
test_endpoint "Get alerts by priority" "/api/alerts/by-priority"
test_endpoint "Get unattended alerts" "/api/alerts/unattended?minutes=30"
test_endpoint "Get alert stats" "/api/alerts/stats"

echo ""
echo "=== SCREENSHOT TESTS ==="
echo ""

test_endpoint "Get recent screenshots" "/api/screenshots/recent?limit=10"
test_endpoint "Get alert screenshots only" "/api/screenshots/recent?alertsOnly=true"

echo ""
echo "=== DASHBOARD TESTS ==="
echo ""

test_endpoint "Executive dashboard (7 days)" "/api/dashboard/executive?days=7"
test_endpoint "Executive dashboard (30 days)" "/api/dashboard/executive?days=30"

echo ""
echo "=== DRIVER RATING TESTS ==="
echo ""

# Create test driver first
curl -s -X POST "$BASE_URL/api/speeding/record" \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"TEST001","driverId":"DRV_TEST","speed":120,"speedLimit":100}' > /dev/null

test_endpoint "Get driver rating" "/api/drivers/DRV_TEST/rating"
test_endpoint "Get driver speeding events" "/api/drivers/DRV_TEST/speeding-events?days=7"

echo ""
echo "=== VIDEO BUFFER TESTS ==="
echo ""

test_endpoint "Get buffer status" "/api/buffers/status"

echo ""
echo "=== VEHICLE TESTS ==="
echo ""

test_endpoint "Get all vehicles" "/api/vehicles"
test_endpoint "Get connected vehicles" "/api/vehicles/connected"
test_endpoint "Get server stats" "/api/stats"

echo ""
echo "=== HEALTH CHECK ==="
echo ""

test_endpoint "Health check" "/health"

echo ""
echo "=================================="
echo "TEST RESULTS"
echo "=================================="
echo -e "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $((test_count - pass_count))${NC}"
echo -e "Success Rate: $((pass_count * 100 / test_count))%"
echo "=================================="

if [ $pass_count -eq $test_count ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
  exit 1
fi
