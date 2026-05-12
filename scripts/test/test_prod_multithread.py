#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生产模式多线程稳定性测试脚本
测试生产模式的多线程稳定性和性能
"""
import os
import sys
import time
import threading
import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

# 添加项目根目录到Python路径
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

# 测试配置
TEST_CONFIG = {
    "base_url": "http://localhost:8000",
    "test_duration": 60,  # 测试持续时间（秒）
    "concurrent_users": 5,  # 并发用户数
    "requests_per_user": 100,  # 每个用户的请求数
    "endpoints": [
        "/health",
        "/docs",
        "/api/v1/images",
        "/api/v1/search"
    ]
}

class ProductionStabilityTester:
    """生产模式稳定性测试器"""
    
    def __init__(self, config):
        self.config = config
        self.results = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "response_times": [],
            "errors": []
        }
        self.test_start_time = None
        self.test_end_time = None
    
    def test_endpoint(self, endpoint, user_id):
        """测试单个端点"""
        url = f"{self.config['base_url']}{endpoint}"
        
        try:
            start_time = time.time()
            response = requests.get(url, timeout=10)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # 转换为毫秒
            
            with threading.Lock():
                self.results["total_requests"] += 1
                self.results["response_times"].append(response_time)
                
                if response.status_code == 200:
                    self.results["successful_requests"] += 1
                    return True, response_time
                else:
                    self.results["failed_requests"] += 1
                    self.results["errors"].append({
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "response_time": response_time
                    })
                    return False, response_time
                    
        except Exception as e:
            with threading.Lock():
                self.results["total_requests"] += 1
                self.results["failed_requests"] += 1
                self.results["errors"].append({
                    "endpoint": endpoint,
                    "error": str(e),
                    "response_time": 0
                })
            return False, 0
    
    def simulate_user(self, user_id):
        """模拟单个用户行为"""
        user_results = {
            "user_id": user_id,
            "requests_sent": 0,
            "requests_successful": 0,
            "requests_failed": 0,
            "total_response_time": 0
        }
        
        for i in range(self.config["requests_per_user"]):
            # 随机选择端点
            import random
            endpoint = random.choice(self.config["endpoints"])
            
            success, response_time = self.test_endpoint(endpoint, user_id)
            
            user_results["requests_sent"] += 1
            user_results["total_response_time"] += response_time
            
            if success:
                user_results["requests_successful"] += 1
            else:
                user_results["requests_failed"] += 1
            
            # 随机延迟，模拟真实用户行为
            time.sleep(random.uniform(0.1, 1.0))
        
        return user_results
    
    def run_stability_test(self):
        """运行稳定性测试"""
        print("=" * 60)
        print("生产模式多线程稳定性测试")
        print("=" * 60)
        print(f"测试配置:")
        print(f"  基础URL: {self.config['base_url']}")
        print(f"  测试时长: {self.config['test_duration']}秒")
        print(f"  并发用户数: {self.config['concurrent_users']}")
        print(f"  每个用户请求数: {self.config['requests_per_user']}")
        print(f"  测试端点: {', '.join(self.config['endpoints'])}")
        print("=" * 60)
        
        self.test_start_time = time.time()
        
        # 使用线程池模拟并发用户
        with ThreadPoolExecutor(max_workers=self.config["concurrent_users"]) as executor:
            # 提交所有用户任务
            future_to_user = {
                executor.submit(self.simulate_user, user_id): user_id 
                for user_id in range(self.config["concurrent_users"])
            }
            
            # 收集结果
            user_results = []
            for future in as_completed(future_to_user):
                user_id = future_to_user[future]
                try:
                    result = future.result()
                    user_results.append(result)
                    print(f"用户 {user_id} 测试完成: {result['requests_successful']}/{result['requests_sent']} 成功")
                except Exception as e:
                    print(f"用户 {user_id} 测试失败: {e}")
        
        self.test_end_time = time.time()
        
        # 计算测试结果
        self.calculate_results(user_results)
        
    def calculate_results(self, user_results):
        """计算测试结果"""
        total_duration = self.test_end_time - self.test_start_time
        
        # 计算平均响应时间
        if self.results["response_times"]:
            avg_response_time = sum(self.results["response_times"]) / len(self.results["response_times"])
            max_response_time = max(self.results["response_times"])
            min_response_time = min(self.results["response_times"])
        else:
            avg_response_time = max_response_time = min_response_time = 0
        
        # 计算成功率
        success_rate = (self.results["successful_requests"] / self.results["total_requests"]) * 100 if self.results["total_requests"] > 0 else 0
        
        # 计算吞吐量
        throughput = self.results["total_requests"] / total_duration if total_duration > 0 else 0
        
        # 输出测试报告
        print("\n" + "=" * 60)
        print("生产模式多线程稳定性测试报告")
        print("=" * 60)
        print(f"测试时长: {total_duration:.2f}秒")
        print(f"总请求数: {self.results['total_requests']}")
        print(f"成功请求: {self.results['successful_requests']}")
        print(f"失败请求: {self.results['failed_requests']}")
        print(f"成功率: {success_rate:.2f}%")
        print(f"平均响应时间: {avg_response_time:.2f}ms")
        print(f"最大响应时间: {max_response_time:.2f}ms")
        print(f"最小响应时间: {min_response_time:.2f}ms")
        print(f"吞吐量: {throughput:.2f} 请求/秒")
        print(f"并发用户数: {self.config['concurrent_users']}")
        
        # 稳定性评估
        print("\n稳定性评估:")
        if success_rate >= 99.5:
            print("  ✅ 极稳定 - 生产环境可用")
        elif success_rate >= 99:
            print("  ✅ 稳定 - 生产环境可用")
        elif success_rate >= 95:
            print("  ⚠️ 基本稳定 - 需要优化")
        else:
            print("  ❌ 不稳定 - 需要修复")
        
        # 性能评估
        print("\n性能评估:")
        if avg_response_time <= 100:
            print("  ✅ 极快 - 响应时间优秀")
        elif avg_response_time <= 500:
            print("  ✅ 快速 - 响应时间良好")
        elif avg_response_time <= 1000:
            print("  ⚠️ 一般 - 需要优化")
        else:
            print("  ❌ 慢 - 需要优化")
        
        # 输出错误详情
        if self.results["errors"]:
            print(f"\n错误详情 (前10个):")
            for i, error in enumerate(self.results["errors"][:10]):
                print(f"  {i+1}. 端点: {error.get('endpoint', 'N/A')}, "
                      f"状态码: {error.get('status_code', 'N/A')}, "
                      f"错误: {error.get('error', 'N/A')}")
        
        print("=" * 60)
        
        # 保存测试结果到文件
        self.save_test_results(total_duration, success_rate, avg_response_time, throughput)
    
    def save_test_results(self, duration, success_rate, avg_response_time, throughput):
        """保存测试结果到文件"""
        results_file = os.path.join(PROJECT_ROOT, "logs", "prod_stability_test.json")
        
        # 确保日志目录存在
        os.makedirs(os.path.dirname(results_file), exist_ok=True)
        
        results_data = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "test_config": self.config,
            "test_results": {
                "duration": duration,
                "total_requests": self.results["total_requests"],
                "successful_requests": self.results["successful_requests"],
                "failed_requests": self.results["failed_requests"],
                "success_rate": success_rate,
                "avg_response_time": avg_response_time,
                "throughput": throughput,
                "concurrent_users": self.config["concurrent_users"]
            },
            "errors": self.results["errors"][:20]  # 保存前20个错误
        }
        
        try:
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(results_data, f, indent=2, ensure_ascii=False)
            print(f"\n测试结果已保存到: {results_file}")
        except Exception as e:
            print(f"保存测试结果失败: {e}")

def main():
    """主函数"""
    # 检查服务是否可用
    try:
        response = requests.get(f"{TEST_CONFIG['base_url']}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ 服务健康检查失败: 状态码 {response.status_code}")
            return
    except Exception as e:
        print(f"❌ 无法连接到服务: {e}")
        print("请确保生产模式服务正在运行:")
        print("  python scripts/startup/start_with_hot_reload.py --mode prod --multithread")
        return
    
    # 运行稳定性测试
    tester = ProductionStabilityTester(TEST_CONFIG)
    tester.run_stability_test()

if __name__ == "__main__":
    main()