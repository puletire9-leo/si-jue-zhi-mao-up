#!/bin/sh
echo "测试分类接口:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/selection/categories
echo ""
echo "测试健康检查:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/actuator/health
echo ""
