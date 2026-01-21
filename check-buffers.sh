#!/bin/bash
# Check buffer status

echo "📊 Current Buffer Status"
echo "========================"
curl -s http://localhost:3000/api/buffers/status | jq '.'
echo ""
echo "📊 Alert Buffer Stats"
echo "====================="
curl -s http://localhost:3000/api/alerts/buffers/stats | jq '.'
