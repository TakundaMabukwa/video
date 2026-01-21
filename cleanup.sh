#!/bin/bash
# Auto-cleanup - removes all logs and recordings

rm -rf /root/video/logs/*
rm -rf /root/video/recordings/*
find /root/video/hls -type f -mmin +60 -delete

echo "Cleanup completed at $(date)"
