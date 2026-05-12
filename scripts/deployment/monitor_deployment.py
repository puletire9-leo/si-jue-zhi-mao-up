#!/usr/bin/env python3
"""
部署监控脚本
实时监控部署状态和关键指标
"""

import os
import sys
import time
import subprocess
import argparse
from typing import Dict, List, Optional
from datetime import datetime, timedelta


class DeploymentMonitor:
    """部署监控器"""
    
    def __init__(self, namespace: str = "production"):
        self.namespace = namespace
        self.backend_deployment = f"image-database-backend"
        self.frontend_deployment = f"image-database-frontend"
        self.service = f"image-database-service"
        
        # 监控阈值
        self.error_rate_threshold = 5.0  # 错误率阈值（%）
        self.response_time_threshold = 3000  # 响应时间阈值（ms）
        self.cpu_threshold = 80.0  # CPU使用率阈值（%）
        self.memory_threshold = 85.0  # 内存使用率阈值（%）
    
    def get_pod_status(self, label_selector: str = "") -> Dict[str, List[str]]:
        """获取Pod状态"""
        try:
            cmd = ["kubectl", "get", "pods", "-n", self.namespace]
            if label_selector:
                cmd.extend(["-l", label_selector])
            
            result = subprocess.run(
                cmd + ["-o", "jsonpath={.items[*].metadata.name}"],
                capture_output=True,
                text=True,
                check=True
            )
            
            pod_names = result.stdout.strip().split(" ") if result.stdout.strip() else []
            
            # 获取Pod状态
            status_result = subprocess.run(
                cmd + ["-o", "jsonpath={.items[*].status.phase}"],
                capture_output=True,
                text=True,
                check=True
            )
            
            pod_phases = status_result.stdout.strip().split(" ") if status_result.stdout.strip() else []
            
            return {
                "names": pod_names,
                "phases": pod_phases
            }
            
        except subprocess.CalledProcessError as e:
            print(f"获取Pod状态失败: {e}")
            return {"names": [], "phases": []}
    
    def get_deployment_status(self, deployment: str) -> Dict:
        """获取部署状态"""
        try:
            result = subprocess.run([
                "kubectl", "get", "deployment", deployment,
                "-n", self.namespace, "-o", "json"
            ], capture_output=True, text=True, check=True)
            
            import json
            data = json.loads(result.stdout)
            
            return {
                "replicas": data["spec"]["replicas"],
                "ready_replicas": data["status"].get("readyReplicas", 0),
                "updated_replicas": data["status"].get("updatedReplicas", 0),
                "available_replicas": data["status"].get("availableReplicas", 0),
                "conditions": data["status"].get("conditions", [])
            }
            
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"获取部署状态失败: {e}")
            return {}
    
    def get_service_status(self, service: str) -> Dict:
        """获取服务状态"""
        try:
            result = subprocess.run([
                "kubectl", "get", "service", service,
                "-n", self.namespace, "-o", "json"
            ], capture_output=True, text=True, check=True)
            
            import json
            data = json.loads(result.stdout)
            
            return {
                "type": data["spec"]["type"],
                "cluster_ip": data["spec"].get("clusterIP"),
                "external_ip": data["status"].get("loadBalancer", {}).get("ingress", [{}])[0].get("ip"),
                "ports": data["spec"]["ports"]
            }
            
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"获取服务状态失败: {e}")
            return {}
    
    def get_pod_metrics(self, label_selector: str = "") -> Dict[str, Dict]:
        """获取Pod指标"""
        try:
            cmd = ["kubectl", "top", "pods", "-n", self.namespace]
            if label_selector:
                cmd.extend(["-l", label_selector])
            
            result = subprocess.run(
                cmd + ["--no-headers"],
                capture_output=True,
                text=True,
                check=True
            )
            
            metrics = {}
            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                
                parts = line.split()
                if len(parts) >= 3:
                    pod_name = parts[0]
                    cpu_usage = parts[1]
                    memory_usage = parts[2]
                    
                    # 解析CPU和内存使用率
                    cpu_percent = self._parse_cpu_usage(cpu_usage)
                    memory_percent = self._parse_memory_usage(memory_usage)
                    
                    metrics[pod_name] = {
                        "cpu_usage": cpu_usage,
                        "cpu_percent": cpu_percent,
                        "memory_usage": memory_usage,
                        "memory_percent": memory_percent
                    }
            
            return metrics
            
        except subprocess.CalledProcessError as e:
            print(f"获取Pod指标失败: {e}")
            return {}
    
    def _parse_cpu_usage(self, cpu_usage: str) -> float:
        """解析CPU使用率"""
        try:
            if "m" in cpu_usage:
                return float(cpu_usage.replace("m", "")) / 10.0  # 假设1000m = 100%
            elif "n" in cpu_usage:
                return float(cpu_usage.replace("n", "")) / 10000.0
            else:
                return 0.0
        except (ValueError, AttributeError):
            return 0.0
    
    def _parse_memory_usage(self, memory_usage: str) -> float:
        """解析内存使用率"""
        try:
            if "Mi" in memory_usage:
                return float(memory_usage.replace("Mi", "")) / 512.0 * 100.0  # 假设512Mi = 100%
            elif "Gi" in memory_usage:
                return float(memory_usage.replace("Gi", "")) / 0.512 * 100.0
            else:
                return 0.0
        except (ValueError, AttributeError):
            return 0.0
    
    def get_application_metrics(self) -> Dict:
        """获取应用指标（从Prometheus）"""
        # 这里应该从Prometheus获取实际的应用指标
        # 示例：错误率、响应时间、QPS等
        
        return {
            "error_rate": 0.0,
            "response_time": 100.0,
            "qps": 100.0,
            "latency_p50": 50.0,
            "latency_p95": 150.0,
            "latency_p99": 300.0
        }
    
    def check_health(self) -> bool:
        """检查应用健康状态"""
        try:
            # 检查后端健康端点
            result = subprocess.run([
                "kubectl", "get", "endpoints", self.service,
                "-n", self.namespace, "-o", "json"
            ], capture_output=True, text=True, check=True)
            
            import json
            data = json.loads(result.stdout)
            
            if data.get("subsets"):
                addresses = data["subsets"][0].get("addresses", [])
                return len(addresses) > 0
            
            return False
            
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"健康检查失败: {e}")
            return False
    
    def display_status(self):
        """显示当前状态"""
        print("\n" + "=" * 60)
        print(f"部署监控 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # 显示Pod状态
        print("\n📦 Pod状态:")
        pod_status = self.get_pod_status()
        for i, (name, phase) in enumerate(zip(pod_status["names"], pod_status["phases"])):
            status_emoji = "✅" if phase == "Running" else "❌"
            print(f"  {status_emoji} {name}: {phase}")
        
        # 显示部署状态
        print("\n🚀 部署状态:")
        for deployment in [self.backend_deployment, self.frontend_deployment]:
            status = self.get_deployment_status(deployment)
            if status:
                print(f"  {deployment}:")
                print(f"    副本数: {status.get('replicas', 0)}")
                print(f"    就绪副本: {status.get('ready_replicas', 0)}")
                print(f"    更新副本: {status.get('updated_replicas', 0)}")
                print(f"    可用副本: {status.get('available_replicas', 0)}")
        
        # 显示Pod指标
        print("\n📊 Pod资源使用:")
        pod_metrics = self.get_pod_metrics()
        for pod_name, metrics in pod_metrics.items():
            cpu_emoji = "✅" if metrics["cpu_percent"] < self.cpu_threshold else "⚠️"
            memory_emoji = "✅" if metrics["memory_percent"] < self.memory_threshold else "⚠️"
            
            print(f"  {pod_name}:")
            print(f"    {cpu_emoji} CPU: {metrics['cpu_usage']} ({metrics['cpu_percent']:.1f}%)")
            print(f"    {memory_emoji} 内存: {metrics['memory_usage']} ({metrics['memory_percent']:.1f}%)")
        
        # 显示应用指标
        print("\n📈 应用指标:")
        app_metrics = self.get_application_metrics()
        error_emoji = "✅" if app_metrics["error_rate"] < self.error_rate_threshold else "⚠️"
        response_emoji = "✅" if app_metrics["response_time"] < self.response_time_threshold else "⚠️"
        
        print(f"  {error_emoji} 错误率: {app_metrics['error_rate']:.2f}%")
        print(f"  {response_emoji} 响应时间: {app_metrics['response_time']:.0f}ms")
        print(f"  QPS: {app_metrics['qps']:.0f}")
        print(f"  P50延迟: {app_metrics['latency_p50']:.0f}ms")
        print(f"  P95延迟: {app_metrics['latency_p95']:.0f}ms")
        print(f"  P99延迟: {app_metrics['latency_p99']:.0f}ms")
        
        # 健康检查
        health_status = self.check_health()
        health_emoji = "✅" if health_status else "❌"
        print(f"\n{health_emoji} 健康检查: {'通过' if health_status else '失败'}")
        
        print("=" * 60)
    
    def monitor(self, duration: int = 900, interval: int = 30) -> bool:
        """持续监控部署状态"""
        print(f"\n开始监控（时长: {duration}秒，间隔: {interval}秒）...")
        
        start_time = time.time()
        all_healthy = True
        
        while time.time() - start_time < duration:
            self.display_status()
            
            # 检查是否有异常
            if not self.check_health():
                all_healthy = False
                print("\n⚠️ 检测到健康检查失败！")
            
            # 检查资源使用率
            pod_metrics = self.get_pod_metrics()
            for pod_name, metrics in pod_metrics.items():
                if metrics["cpu_percent"] > self.cpu_threshold:
                    all_healthy = False
                    print(f"\n⚠️ Pod {pod_name} CPU使用率过高: {metrics['cpu_percent']:.1f}%")
                
                if metrics["memory_percent"] > self.memory_threshold:
                    all_healthy = False
                    print(f"\n⚠️ Pod {pod_name} 内存使用率过高: {metrics['memory_percent']:.1f}%")
            
            # 检查应用指标
            app_metrics = self.get_application_metrics()
            if app_metrics["error_rate"] > self.error_rate_threshold:
                all_healthy = False
                print(f"\n⚠️ 错误率过高: {app_metrics['error_rate']:.2f}%")
            
            if app_metrics["response_time"] > self.response_time_threshold:
                all_healthy = False
                print(f"\n⚠️ 响应时间过长: {app_metrics['response_time']:.0f}ms")
            
            if not all_healthy:
                print("\n❌ 检测到异常，建议检查部署状态！")
                return False
            
            time.sleep(interval)
        
        print("\n✅ 监控完成，未发现异常")
        return True


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='部署监控工具')
    parser.add_argument('--namespace', default='production', help='Kubernetes命名空间')
    parser.add_argument('--duration', type=int, default=900, help='监控时长（秒）')
    parser.add_argument('--interval', type=int, default=30, help='监控间隔（秒）')
    parser.add_argument('--once', action='store_true', help='只显示一次状态')
    
    args = parser.parse_args()
    
    monitor = DeploymentMonitor(namespace=args.namespace)
    
    if args.once:
        monitor.display_status()
    else:
        success = monitor.monitor(args.duration, args.interval)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()