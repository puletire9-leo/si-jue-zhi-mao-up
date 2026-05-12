#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
手动评分脚本
用于修复导入后没有自动评分的问题
"""
import requests
import json
import sys
import argparse


def check_scoring_config(base_url: str) -> dict:
    """检查评分配置"""
    try:
        response = requests.get(f"{base_url}/api/v1/scoring/config", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                "status": "success",
                "dimensions": len(data.get("data", {}).get("dimensions", [])),
                "grades": len(data.get("data", {}).get("grade_thresholds", [])),
                "data": data.get("data", {})
            }
        else:
            return {
                "status": "error",
                "message": f"获取评分配置失败: {response.status_code}",
                "text": response.text
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"请求失败: {str(e)}"
        }


def trigger_scoring(base_url: str, scope: str = "all") -> dict:
    """
    触发评分计算

    Args:
        base_url: API 基础 URL
        scope: "all" - 所有数据, "current_week" - 仅本周数据

    Returns:
        评分结果
    """
    try:
        response = requests.post(
            f"{base_url}/api/v1/scoring/recalculate",
            json={"scope": scope},
            timeout=300
        )

        if response.status_code == 200:
            result = response.json()
            return {
                "status": "success",
                "total_scored": result.get("data", {}).get("totalScored", 0),
                "grade_stats": result.get("data", {}).get("gradeStats", []),
                "data": result
            }
        else:
            return {
                "status": "error",
                "message": f"评分请求失败: {response.status_code}",
                "text": response.text
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"请求失败: {str(e)}"
        }


def check_products_without_score(base_url: str) -> dict:
    """检查没有评分的产品数量"""
    try:
        # 查询没有 score 或 grade 的产品数量
        # 这个查询需要直接访问数据库，这里我们通过 API 检查
        response = requests.get(
            f"{base_url}/api/v1/selection/all/list",
            params={"page": 1, "size": 1},
            timeout=10
        )

        if response.status_code == 200:
            # 返回提示信息
            return {
                "status": "info",
                "message": "请检查后端日志确认没有评分的数量"
            }
        else:
            return {
                "status": "error",
                "message": f"查询失败: {response.status_code}"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"请求失败: {str(e)}"
        }


def main():
    parser = argparse.ArgumentParser(description="评分系统修复工具")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="API 基础 URL (默认: http://localhost:8000)"
    )
    parser.add_argument(
        "--action",
        choices=["check", "score", "fix"],
        default="check",
        help="操作: check(检查配置), score(触发评分), fix(检查+评分)"
    )
    parser.add_argument(
        "--scope",
        choices=["all", "current_week"],
        default="all",
        help="评分范围: all(所有数据), current_week(仅本周数据)"
    )

    args = parser.parse_args()

    print(f"=" * 60)
    print(f"评分系统修复工具")
    print(f"=" * 60)
    print(f"API URL: {args.url}")
    print(f"操作: {args.action}")
    print(f"范围: {args.scope}")
    print(f"=" * 60)

    if args.action in ["check", "fix"]:
        print("\n[LIST] 检查评分配置...")
        config_result = check_scoring_config(args.url)

        if config_result["status"] == "success":
            print(f"[OK] 评分配置正常")
            print(f"   - 评分维度数: {config_result['dimensions']}")
            print(f"   - 等级阈值数: {config_result['grades']}")

            if config_result['dimensions'] == 0:
                print(f"\n[WARN]  警告: 评分维度配置为空！")
                print(f"   请执行 SQL 文件: backend/migrations/init_scoring_system.sql")
            if config_result['grades'] == 0:
                print(f"\n[WARN]  警告: 等级阈值配置为空！")
                print(f"   请执行 SQL 文件: backend/migrations/init_scoring_system.sql")
        else:
            print(f"[FAIL] 检查评分配置失败")
            print(f"   {config_result.get('message', '未知错误')}")

    if args.action in ["score", "fix"]:
        print(f"\n[SYNC] 触发评分计算 (范围: {args.scope})...")
        score_result = trigger_scoring(args.url, args.scope)

        if score_result["status"] == "success":
            print(f"[OK] 评分完成!")
            print(f"   - 评分产品数: {score_result['total_scored']}")

            if score_result["grade_stats"]:
                print(f"\n[CHART] 等级分布:")
                for stat in score_result["grade_stats"]:
                    grade = stat.get("grade", "N/A")
                    count = stat.get("count", 0)
                    color = stat.get("color", "#909399")
                    print(f"   [{color}] {grade}: {count} 个产品")
            else:
                print(f"\n[WARN]  没有评分的统计数据")
        else:
            print(f"[FAIL] 评分失败")
            print(f"   {score_result.get('message', '未知错误')}")
            if "text" in score_result:
                print(f"   响应: {score_result['text'][:500]}")

    print(f"\n{'=' * 60}")
    print(f"完成")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
